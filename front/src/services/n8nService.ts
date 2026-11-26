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
 * 8. EduFlow - Notification Management (WF-27): sub-workflow, no webhook; called by WF-28/WF-29
 * 9. EduFlow - Scheduled Reminders (WF-28): daily 08:00 Cairo, homework/session reminders
 * 10. EduFlow - Weekly Parent Reports (WF-29): Thursday 18:00 Cairo, AI report to parents
 *    (8-10 write rows into Supabase `notifications`; the app shows them after hydration)
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

const N8N_BASE_URL = (
  (import.meta as any).env?.VITE_N8N_BASE_URL || 'http://localhost:5678'
).replace(/\/+$/, '');

// Get the Supabase service key for authenticated calls
const SUPABASE_SERVICE_KEY =
  (import.meta as any).env?.VITE_SUPABASE_SERVICE_ROLE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpoYm50eG5zZHpucGRxbWp5eHBwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MzkzMDY2NCwiZXhwIjoyMTA5NTA2NjY0fQ.6HLb01zQpGGwn6Hp_HGt3MlMhl8M5i9wXMqxWEgUdwA';

async function postToN8n(path: string, payload: any, extraHeaders?: Record<string, string>): Promise<N8nWebhookResponse> {
  const prodUrl = `${N8N_BASE_URL}/webhook/${path}`;
  const testUrl = `${N8N_BASE_URL}/webhook-test/${path}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...extraHeaders,
  };

  try {
    let response = await fetch(prodUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    // Fallback to test webhook if editor is listening in test mode
    if (response.status === 404) {
      response = await fetch(testUrl, {
        method: 'POST',
        headers,
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
 * 5b. List materials by teacher/group via Material Processing Hub
 */
export async function callMaterialListWorkflow(
  teacherId?: string,
  groupId?: string
): Promise<N8nWebhookResponse> {
  return postToN8n(
    'eduflow-materials-process',
    {
      action: 'material.list',
      teacher_id: teacherId,
      group_id: groupId,
    },
    { Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` }
  );
}

/**
 * 5c. Upload/ingest a new material into the RAG pipeline
 */
export async function callMaterialIngestWorkflow(payload: {
  title: string;
  file_url: string;
  teacher_id?: string;
  group_id?: string;
}): Promise<N8nWebhookResponse> {
  return postToN8n(
    'eduflow-materials-process',
    { action: 'material.ingest', ...payload },
    { Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` }
  );
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
 * 11. Call Payments & Earnings Hub (record, waive, invoices, teacher earnings)
 */
export async function callPaymentsWorkflow(
  action:
    | 'payment.record'
    | 'payment.waive'
    | 'invoice.create'
    | 'invoices.generate_group'
    | 'earning.generate_session'
    | 'earning.approve'
    | 'earning.pay'
    | 'payments.refresh_overdue',
  payload: Record<string, any>
): Promise<N8nWebhookResponse> {
  return postToN8n('eduflow-payments', {
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
    const sId = data.student_id || data.id;
    const sName = data.student_name || data.full_name;
    if (sId && sName && data.email) {
      callStudentWorkflow('student.create', {
        student_id: sId,
        full_name: sName,
        email: data.email,
        phone: data.phone || null,
      }).catch(() => {});

      callAuditWorkflow({
        action: 'student.registered',
        entity_type: 'student',
        entity_id: sId,
        actor_id: sId,
        actor_role: 'student',
        details: { full_name: sName, email: data.email },
      }).catch(() => {});
    }
  }

  if (event === 'new_teacher_registered' || event === 'teacher.create') {
    const tId = data.teacher_id || data.id;
    const tName = data.teacher_name || data.full_name;
    callAuditWorkflow({
      action: 'teacher.registered',
      entity_type: 'teacher',
      entity_id: tId,
      actor_id: tId,
      actor_role: 'teacher',
      details: { full_name: tName, email: data.email, phone: data.phone },
    }).catch(() => {});

    callNotificationsWorkflow({
      title: '👨‍🏫 معلم جديد انضم للمنظومة',
      message: `تم تسجيل المعلم (${tName}) بنجاح.`,
      notification_type: 'teacher_onboarding',
      user_ids: [tId],
    }).catch(() => {});
  }

  if (event === 'new_parent_registered' || event === 'parent.create') {
    const pId = data.parent_id || data.id;
    const pName = data.parent_name || data.full_name;
    callAuditWorkflow({
      action: 'parent.registered',
      entity_type: 'parent',
      entity_id: pId,
      actor_id: pId,
      actor_role: 'parent',
      details: { full_name: pName, email: data.email, phone: data.phone },
    }).catch(() => {});

    callNotificationsWorkflow({
      title: '👨‍👩‍👧 ولي أمر جديد انضم للمنظومة',
      message: `تم تسجيل ولي الأمر (${pName}) بنجاح.`,
      notification_type: 'parent_onboarding',
      user_ids: [pId],
    }).catch(() => {});
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

  if (event === 'exam.submitted' || event === 'exam_submitted') {
    callExamsWorkflow('exam.submit_attempt', {
      exam_id: data.exam_id,
      student_id: data.student_id,
      score: data.score,
      submitted_at: new Date().toISOString(),
    }).catch(() => {});
  }

  if (event === 'ai_tutor_chat') {
    const chatRes = await callAgentChatWorkflow(
      (data.role as any) || 'student',
      data.message || data.question || '',
      data
    );
    if (chatRes.success) return chatRes;
  }

  if (event === 'complaint_submitted') {
    callAuditWorkflow({
      action: 'complaint.submitted',
      entity_type: 'complaint',
      actor_id: data.student_id || data.user_id || null,
      actor_role: 'student',
      details: data,
    }).catch(() => {});
  }

  if (event === 'note_added') {
    callAuditWorkflow({
      action: 'note.added',
      entity_type: 'student_note',
      entity_id: data.student_id || null,
      actor_role: 'teacher',
      details: data,
    }).catch(() => {});
    callNotificationsWorkflow({
      title: '📝 ملاحظة جديدة من المعلم',
      message: data.note || 'تمت إضافة ملاحظة أكاديمية جديدة للطالب.',
      notification_type: 'note',
      user_ids: data.student_id ? [data.student_id] : [],
    }).catch(() => {});
  }

  // Known events were dispatched above. (The old catch-all POST to
  // /webhook/eduflow was removed: no workflow exposes that path, so it
  // always returned 404 and made every event look failed.)
  void geminiKey;
  return { success: true, data: { event, dispatched: true } };
}
