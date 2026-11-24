/**
 * Service to dispatch real-time events to local n8n instance (http://localhost:5678)
 * Connects seamlessly to the 7 Master Workflows:
 * 1. EduFlow - Student Management (/webhook/eduflow-students)
 * 2. EduFlow - Authentication & Authorization (/webhook/eduflow-auth)
 * 3. EduFlow - Audit Logging (/webhook/eduflow-audit)
 * 4. EduFlow - AI Agents Multi-Persona Hub (/webhook/eduflow-agent-chat)
 * 5. EduFlow - Material Processing & RAG Hub (/webhook/eduflow-material-processing & /webhook/eduflow-rag-search)
 * 6. EduFlow - Exams & Assessment Hub (/webhook/eduflow-exams)
 * 7. EduFlow - Notifications & Scheduled Reports (/webhook/eduflow-notifications)
 */

export interface N8nWebhookResponse {
  success: boolean;
  data?: any;
  error?: string;
}

export type StudentWorkflowAction =
  | 'student.create'
  | 'student.update'
  | 'student.get'
  | 'student.search'
  | 'student.enroll'
  | 'student.enrollment.update'
  | 'student.enrollments.list'
  | 'student.enrollment.remove';

export interface StudentWorkflowPayload {
  action: StudentWorkflowAction;
  student_id?: string;
  full_name?: string;
  email?: string;
  phone?: string | null;
  group_id?: string;
  enrollment_id?: string;
  status?: 'active' | 'completed' | 'cancelled';
  search?: string;
  limit?: number;
  [key: string]: any;
}

export interface AuditLogPayload {
  action: string;
  entity_type: string;
  entity_id?: string | null;
  actor_id?: string | null;
  actor_role?: string | null;
  workspace_id?: string | null;
  source?: string;
  details?: Record<string, any>;
  before_data?: Record<string, any> | null;
  after_data?: Record<string, any> | null;
}

export interface AuthCheckPayload {
  access_token: string;
  required_roles?: string[];
  group_id?: string | null;
  group_requirement?: string | null;
}

const N8N_BASE_URL = 'http://localhost:5678';

async function postToN8n(path: string, payload: any): Promise<N8nWebhookResponse> {
  const prodUrl = `${N8N_BASE_URL}/webhook/${path}`;
  const testUrl = `${N8N_BASE_URL}/webhook-test/${path}`;

  try {
    let response = await fetch(prodUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    // Fallback to test webhook if editor is listening in test mode
    if (response.status === 404) {
      response = await fetch(testUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    }

    if (!response.ok) {
      let errMsg = `n8n returned status ${response.status}`;
      try {
        const errJson = await response.json();
        if (errJson?.message) {
          errMsg = `${errMsg} (${errJson.message})`;
        }
      } catch {
        // ignore
      }
      return {
        success: false,
        error: errMsg,
      };
    }

    const resJson = await response.json();
    return {
      success: true,
      data: resJson,
    };
  } catch (err: any) {
    console.info(`n8n dispatch note (${path}):`, err?.message);
    return {
      success: false,
      error: err?.message || 'Network error reaching n8n',
    };
  }
}

/**
 * 1. Call Student Management Workflow (SW-08)
 */
export async function callStudentWorkflow(
  action: StudentWorkflowAction,
  params: Omit<StudentWorkflowPayload, 'action'>
): Promise<N8nWebhookResponse> {
  const payload = { action, ...params };
  const res = await postToN8n('eduflow-students', payload);

  // If student created, updated, or enrolled, also fire an audit log
  if (res.success && (action === 'student.create' || action === 'student.update' || action === 'student.enroll')) {
    callAuditWorkflow({
      action: action,
      entity_type: 'student',
      entity_id: params.student_id || null,
      actor_role: 'system',
      source: 'EduFlow Web Portal',
      details: { params, timestamp: new Date().toISOString() },
    }).catch(() => {});
  }

  return res;
}

/**
 * 2. Call Audit Logging Workflow (SW-06)
 */
export async function callAuditWorkflow(payload: AuditLogPayload): Promise<N8nWebhookResponse> {
  return postToN8n('eduflow-audit', {
    ...payload,
    source: payload.source || 'EduFlow Web Portal',
  });
}

/**
 * 3. Call Auth & Access Authorization Workflow (WF-03)
 */
export async function callAuthWorkflow(payload: AuthCheckPayload): Promise<N8nWebhookResponse> {
  return postToN8n('eduflow-auth', payload);
}

/**
 * 4. Call Multi-Persona AI Agent Chat (WF-10, WF-11, WF-12, WF-13)
 */
export async function callAgentChatWorkflow(
  role: 'teacher' | 'student' | 'parent' | 'assistant',
  message: string,
  contextData: Record<string, any> = {}
): Promise<N8nWebhookResponse> {
  return postToN8n('eduflow-agent-chat', {
    role,
    message,
    ...contextData,
  });
}

/**
 * 5. Call RAG Semantic Search over curriculum materials
 */
export async function callRagSearchWorkflow(
  query: string,
  groupId?: string
): Promise<N8nWebhookResponse> {
  return postToN8n('eduflow-rag-search', {
    query,
    group_id: groupId,
  });
}

/**
 * 6. Call Exams & Assessment Hub (Draft, Publish, Attempt Submission)
 */
export async function callExamsWorkflow(
  action: 'exam.create_draft' | 'exam.publish' | 'exam.start_attempt' | 'exam.submit_attempt',
  payload: Record<string, any>
): Promise<N8nWebhookResponse> {
  return postToN8n('eduflow-exams', {
    action,
    ...payload,
  });
}

/**
 * 7. Call Notifications Hub On-Demand
 */
export async function callNotificationsWorkflow(payload: Record<string, any>): Promise<N8nWebhookResponse> {
  return postToN8n('eduflow-notifications', payload);
}

/**
 * Backwards compatible & unified event dispatcher
 */
export async function sendN8nEvent(event: string, data: Record<string, any>): Promise<N8nWebhookResponse> {
  const geminiKey =
    (import.meta as any).env?.VITE_GEMINI_API_KEY ||
    (import.meta as any).env?.GEMINI_API_KEY ||
    '';

  // Smart route to specific team workflows
  if (event === 'new_student_registered' || event === 'student.create') {
    if (data.student_id && data.student_name && data.email) {
      callStudentWorkflow('student.create', {
        student_id: data.student_id,
        full_name: data.student_name || data.full_name,
        email: data.email,
        phone: data.phone || null,
      }).catch(() => {});
    }
  }

  if (event === 'attendance_marked') {
    callAuditWorkflow({
      action: 'attendance.marked',
      entity_type: 'session',
      actor_id: data.teacher_id || null,
      actor_role: 'teacher',
      details: {
        session_title: data.session_title,
        group_name: data.group_name,
        date: data.date,
        records_count: data.records?.length || 0,
      },
    }).catch(() => {});
  }

  // Also dispatch to general eduflow webhook if active
  return postToN8n('eduflow', {
    event,
    timestamp: new Date().toISOString(),
    gemini_key: geminiKey,
    data,
  });
}
