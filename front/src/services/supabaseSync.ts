/**
 * Supabase Sync Layer
 * -------------------
 * Bridges the in-memory app store (mockDatabase) with the real Supabase
 * database. Every local mutation is diffed and pushed (upsert/delete) to
 * the matching table, and on startup the full database is hydrated back
 * into the local store so data follows the user across devices.
 *
 * Uses the service-role client so writes pass RLS without an auth session.
 * (Acceptable for the graduation demo only - move behind n8n for production.)
 */
import { supabaseAdmin } from './supabaseClient';

// ---------- ID helpers ----------

export function newUuid(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
  } catch {
    // fall through
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (v: any): v is string => typeof v === 'string' && UUID_RE.test(v);
const u = (v: any): string | null => (isUuid(v) ? v : null);

// ---------- Entity -> DB row mappers (return null to skip syncing) ----------

type Row = Record<string, any> | null;

const mappers: Record<string, (r: any) => Row> = {
  profiles: (p) =>
    isUuid(p.id)
      ? pick({
          id: p.id,
          full_name: p.full_name,
          email: p.email,
          phone: p.phone ?? null,
          role: p.role,
          avatar: p.avatar ?? null,
          grade_level: p.grade_level ?? null,
          teacher_id: u(p.teacher_id),
          parent_id: u(p.parent_id),
          created_at: p.created_at,
        })
      : null,

  courses: (c) =>
    isUuid(c.id)
      ? pick({
          id: c.id,
          title: c.title,
          description: c.description ?? null,
          created_by: u(c.created_by),
          status: c.status || 'draft',
          created_at: c.created_at,
        })
      : null,

  course_groups: (g) =>
    isUuid(g.id) && isUuid(g.course_id) && isUuid(g.teacher_id)
      ? pick({
          id: g.id,
          course_id: g.course_id,
          teacher_id: g.teacher_id,
          name: g.name,
          start_date: g.start_date ?? null,
          end_date: g.end_date ?? null,
          status: g.status || 'active',
          created_at: g.created_at,
        })
      : null,

  enrollments: (e) =>
    isUuid(e.id) && isUuid(e.student_id) && isUuid(e.group_id)
      ? pick({
          id: e.id,
          student_id: e.student_id,
          group_id: e.group_id,
          enrolled_at: e.enrolled_at,
          status: e.status || 'active',
        })
      : null,

  sessions: (s) =>
    isUuid(s.id) && isUuid(s.group_id)
      ? pick({
          id: s.id,
          group_id: s.group_id,
          title: s.title,
          description: s.description ?? null,
          session_number: s.session_number ?? 1,
          video_url: s.video_url ?? null,
          materials_url: s.materials_url ?? null,
          scheduled_at: s.scheduled_at ?? null,
          is_published: !!s.is_published,
          created_at: s.created_at,
        })
      : null,

  video_plays: (v) =>
    isUuid(v.id) && isUuid(v.session_id) && isUuid(v.student_id)
      ? pick({
          id: v.id,
          session_id: v.session_id,
          student_id: v.student_id,
          started_at: v.started_at,
          ended_at: v.ended_at ?? null,
          play_number: v.play_number ?? 1,
          created_at: v.created_at,
        })
      : null,

  exams: (e) =>
    isUuid(e.id) && isUuid(e.session_id)
      ? pick({
          id: e.id,
          session_id: e.session_id,
          title: e.title,
          passing_score: e.passing_score ?? 70,
          duration_minutes: e.duration_minutes ?? null,
          is_published: !!e.is_published,
          subject: e.subject ?? null,
          grade_level: e.grade_level ?? null,
          deadline: e.deadline ?? null,
          creator_role: e.creator_role ?? null,
          creation_mode: e.creation_mode ?? null,
          curriculum_type: e.curriculum_type ?? null,
          material_url: e.material_url ?? null,
          created_at: e.created_at,
        })
      : null,

  questions: (q) =>
    isUuid(q.id) && isUuid(q.exam_id)
      ? pick({
          id: q.id,
          exam_id: q.exam_id,
          question_text: q.question_text,
          question_type: q.question_type || 'mcq',
          options: Array.isArray(q.options) ? q.options : [],
          correct_answer: q.correct_answer ?? '',
          points: q.points ?? 1,
          explanation: q.explanation ?? null,
        })
      : null,

  exam_attempts: (a) =>
    isUuid(a.id) && isUuid(a.exam_id) && isUuid(a.student_id)
      ? pick({
          id: a.id,
          exam_id: a.exam_id,
          student_id: a.student_id,
          score: a.score ?? null,
          total_score: a.total_score ?? null,
          passed: !!a.passed,
          started_at: a.started_at,
          submitted_at: a.submitted_at ?? null,
        })
      : null,

  assignments: (a) =>
    isUuid(a.id) && isUuid(a.group_id)
      ? pick({
          id: a.id,
          group_id: a.group_id,
          session_id: u(a.session_id),
          title: a.title,
          description: a.description ?? null,
          due_at: a.due_at ?? null,
          max_score: a.max_score ?? 100,
          is_published: !!a.is_published,
          created_by: u(a.created_by),
          created_at: a.created_at,
        })
      : null,

  assignment_submissions: (s) =>
    isUuid(s.id) && isUuid(s.assignment_id) && isUuid(s.student_id)
      ? pick({
          id: s.id,
          assignment_id: s.assignment_id,
          student_id: s.student_id,
          submission_text: s.submission_text ?? null,
          file_url: s.file_url ?? null,
          score: s.score ?? null,
          teacher_feedback: s.teacher_feedback ?? null,
          status: s.status || 'submitted',
          submitted_at: s.submitted_at,
          graded_at: s.graded_at ?? null,
          graded_by: u(s.graded_by),
        })
      : null,

  attendance: (a) =>
    isUuid(a.id) && isUuid(a.session_id) && isUuid(a.student_id)
      ? pick({
          id: a.id,
          session_id: a.session_id,
          student_id: a.student_id,
          status: a.status,
          recorded_by: u(a.recorded_by),
          recorded_at: a.recorded_at,
        })
      : null,

  student_payments: (p) =>
    isUuid(p.id) && isUuid(p.student_id) && isUuid(p.group_id)
      ? pick({
          id: p.id,
          student_id: p.student_id,
          group_id: p.group_id,
          session_id: u(p.session_id),
          amount: p.amount ?? p.amount_due ?? 0,
          currency: p.currency || 'EGP',
          period_label: p.period_label ?? p.cycle_month ?? null,
          due_date: p.due_date ?? null,
          status: p.status || 'unpaid',
          payment_method: p.payment_method ?? null,
          paid_at: p.paid_at ?? null,
          recorded_by: u(p.recorded_by),
          notes: p.notes ?? null,
          waived_reason: p.waived_reason ?? null,
          waived_at: p.waived_at ?? null,
          waived_by: u(p.waived_by),
          paid_amount: p.paid_amount ?? p.amount_paid ?? 0,
          created_at: p.created_at,
        })
      : null,

  payment_transactions: (t) =>
    isUuid(t.id) && isUuid(t.student_payment_id)
      ? pick({
          id: t.id,
          student_payment_id: t.student_payment_id,
          amount: t.amount ?? 0,
          payment_method: t.payment_method || 'cash',
          paid_at: t.paid_at,
          recorded_by: u(t.recorded_by),
          notes: t.notes ?? null,
          reference_number: t.reference_number ?? null,
          created_at: t.created_at,
        })
      : null,

  group_billing_settings: (b) =>
    isUuid(b.id) && isUuid(b.group_id)
      ? pick({
          id: b.id,
          group_id: b.group_id,
          payment_type: b.payment_type || 'monthly',
          amount: b.amount ?? 0,
          currency: b.currency || 'EGP',
          created_at: b.created_at,
        })
      : null,

  teacher_compensation: (t) =>
    isUuid(t.id) && isUuid(t.group_id) && isUuid(t.teacher_id)
      ? pick({
          id: t.id,
          group_id: t.group_id,
          teacher_id: t.teacher_id,
          compensation_type: t.compensation_type || 'per_session',
          amount: t.amount ?? 0,
          currency: t.currency || 'EGP',
          created_at: t.created_at,
        })
      : null,

  teacher_earnings: (t) =>
    isUuid(t.id) && isUuid(t.teacher_id) && isUuid(t.group_id)
      ? pick({
          id: t.id,
          teacher_id: t.teacher_id,
          group_id: t.group_id,
          session_id: u(t.session_id),
          amount: t.amount ?? 0,
          currency: t.currency || 'EGP',
          description: t.description ?? null,
          status: t.status || 'pending',
          calculated_at: t.calculated_at,
          paid_at: t.paid_at ?? null,
          notes: t.notes ?? null,
        })
      : null,

  notifications: (n) =>
    isUuid(n.id) && isUuid(n.user_id)
      ? pick({
          id: n.id,
          user_id: n.user_id,
          title: n.title,
          message: n.message,
          notification_type: n.notification_type || n.type || 'general',
          is_read: !!n.is_read,
          related_url: n.related_url ?? null,
          created_at: n.created_at,
        })
      : null,

  complaints: (c) =>
    isUuid(c.id) && isUuid(c.submitted_by)
      ? pick({
          id: c.id,
          submitted_by: c.submitted_by,
          subject: c.subject,
          description: c.description,
          category: c.category ?? null,
          priority: c.priority || 'normal',
          status: c.status || 'open',
          assigned_to: u(c.assigned_to),
          admin_response: c.admin_response ?? null,
          created_at: c.created_at,
          resolved_at: c.resolved_at ?? null,
        })
      : null,

  course_materials: (m) =>
    isUuid(m.id) && (isUuid(m.course_id) || isUuid(m.session_id) || isUuid(m.group_id) || !!m.grade_level)
      ? pick({
          id: m.id,
          course_id: u(m.course_id),
          session_id: u(m.session_id),
          group_id: u(m.group_id),
          grade_level: m.grade_level ?? null,
          title: m.title,
          description: m.description ?? null,
          file_url: m.file_url || '',
          file_type: m.file_type ?? null,
          uploaded_by: u(m.uploaded_by),
          rag_status: m.rag_status ?? 'pending',
          rag_error: m.rag_error ?? null,
          rag_processed_at: m.rag_processed_at ?? null,
          rag_chunk_count: m.rag_chunk_count ?? 0,
          download_count: m.download_count ?? 0,
          created_at: m.created_at,
        })
      : null,

  student_notes: (n) =>
    isUuid(n.id) && isUuid(n.student_id) && isUuid(n.teacher_id) && isUuid(n.group_id)
      ? pick({
          id: n.id,
          student_id: n.student_id,
          teacher_id: n.teacher_id,
          group_id: n.group_id,
          note: n.note,
          created_at: n.created_at,
        })
      : null,

  parent_student_links: (l) =>
    isUuid(l.id) && isUuid(l.parent_id) && isUuid(l.student_id)
      ? pick({
          id: l.id,
          parent_id: l.parent_id,
          student_id: l.student_id,
          status: l.status || 'pending',
          created_at: l.created_at,
        })
      : null,

  ai_conversations: (c) =>
    isUuid(c.id) && isUuid(c.user_id)
      ? pick({
          id: c.id,
          user_id: c.user_id,
          group_id: u(c.group_id),
          title: c.title ?? null,
          created_at: c.created_at,
          updated_at: c.updated_at,
        })
      : null,

  ai_messages: (m) =>
    isUuid(m.id) && isUuid(m.conversation_id)
      ? pick({
          id: m.id,
          conversation_id: m.conversation_id,
          sender: m.sender,
          message: m.message,
          metadata: m.metadata ?? {},
          created_at: m.created_at,
        })
      : null,
};

/** state collection name -> supabase table (same name unless listed) */
const COLLECTION_TO_TABLE: Record<string, string> = {
  profiles: 'profiles',
  courses: 'courses',
  groups: 'course_groups',
  enrollments: 'enrollments',
  sessions: 'sessions',
  videoPlays: 'video_plays',
  exams: 'exams',
  examAttempts: 'exam_attempts',
  assignments: 'assignments',
  submissions: 'assignment_submissions',
  attendance: 'attendance',
  studentPayments: 'student_payments',
  paymentTransactions: 'payment_transactions',
  billingSettings: 'group_billing_settings',
  teacherComp: 'teacher_compensation',
  teacherEarnings: 'teacher_earnings',
  complaints: 'complaints',
  notifications: 'notifications',
  courseMaterials: 'course_materials',
  studentNotes: 'student_notes',
  parentLinks: 'parent_student_links',
  aiConversations: 'ai_conversations',
  aiMessages: 'ai_messages',
};

// Removes undefined values so PostgREST applies column defaults.
function pick(obj: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) out[k] = v;
  }
  return out;
}

function stableStringify(v: any): string {
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return '[' + v.map(stableStringify).join(',') + ']';
  return (
    '{' +
    Object.keys(v)
      .sort()
      .map((k) => JSON.stringify(k) + ':' + stableStringify(v[k]))
      .join(',') +
    '}'
  );
}

export interface SyncCollection {
  name: string; // state collection key
  table: string;
  rows: { id: string; row: Record<string, any> }[]; // already mapped, nulls removed
}

/** Map the whole app state to syncable DB rows per table. */
export function collectSyncRows(state: any): SyncCollection[] {
  const out: SyncCollection[] = [];
  for (const [name, table] of Object.entries(COLLECTION_TO_TABLE)) {
    const mapper = mappers[table];
    const list: any[] = Array.isArray(state?.[name]) ? state[name] : [];
    const rows: { id: string; row: Record<string, any> }[] = [];
    for (const item of list) {
      try {
        const row = mapper(item);
        if (row && row.id) rows.push({ id: row.id, row });
      } catch (err) {
        console.warn(`[SupabaseSync] mapper failed for ${table}:`, err);
      }
    }
    // Exam questions are nested inside each exam object in the app state.
    if (name === 'exams') {
      const qRows: { id: string; row: Record<string, any> }[] = [];
      for (const exam of list) {
        for (const q of exam?.questions || []) {
          try {
            const row = mappers.questions(q);
            if (row && row.id) qRows.push({ id: row.id, row });
          } catch {
            // skip
          }
        }
      }
      out.push({ name: 'questions', table: 'questions', rows: qRows });
    }
    out.push({ name, table, rows });
  }
  return out;
}

// ---------- Push (write-through) ----------

export interface SyncOp {
  table: string;
  type: 'upsert' | 'delete';
  id: string;
  row?: Record<string, any>;
}

const failedOnce = new Set<string>();

async function runOps(ops: SyncOp[]): Promise<void> {
  const byTable = new Map<string, SyncOp[]>();
  for (const op of ops) {
    const arr = byTable.get(op.table) || [];
    arr.push(op);
    byTable.set(op.table, arr);
  }
  for (const [table, tableOps] of byTable) {
    const upserts = tableOps.filter((o) => o.type === 'upsert').map((o) => o.row!);
    const deletes = tableOps.filter((o) => o.type === 'delete').map((o) => o.id);
    try {
      if (upserts.length) {
        const { error } = await supabaseAdmin.from(table).upsert(upserts, { onConflict: 'id' });
        if (error) logSyncError(table, 'upsert', error);
        else failedOnce.delete(table + ':upsert');
      }
      if (deletes.length) {
        const { error } = await supabaseAdmin.from(table).delete().in('id', deletes);
        if (error) logSyncError(table, 'delete', error);
        else failedOnce.delete(table + ':delete');
      }
    } catch (err) {
      logSyncError(table, 'network', err);
    }
  }
}

function logSyncError(table: string, op: string, err: any) {
  const key = `${table}:${op}`;
  if (failedOnce.has(key)) return; // avoid console spam on repeated failures
  failedOnce.add(key);
  const msg = err?.message || err?.error_description || String(err);
  console.warn(`[SupabaseSync] ${op} on "${table}" failed: ${msg}`, err);
}

/**
 * Diff current state against the previous synced snapshot and push the
 * changes. Returns the new snapshot. Deletes can be suppressed (used by
 * the local "reset data" button so a demo reset never wipes the cloud).
 */
export function diffAndPush(
  state: any,
  snapshot: Record<string, Map<string, string>>,
  opts: { suppressDeletes?: boolean } = {}
): Record<string, Map<string, string>> {
  const next: Record<string, Map<string, string>> = {};
  const ops: SyncOp[] = [];
  for (const col of collectSyncRows(state)) {
    const prev = snapshot[col.table] || new Map<string, string>();
    const cur = new Map<string, string>();
    for (const { id, row } of col.rows) {
      const hash = stableStringify(row);
      cur.set(id, hash);
      if (prev.get(id) !== hash) {
        ops.push({ table: col.table, type: 'upsert', id, row });
      }
    }
    if (!opts.suppressDeletes) {
      for (const oldId of prev.keys()) {
        if (!cur.has(oldId)) {
          ops.push({ table: col.table, type: 'delete', id: oldId });
        }
      }
    }
    next[col.table] = cur;
  }
  if (ops.length) {
    runOps(ops).catch((err) => console.warn('[SupabaseSync] push failed:', err));
  }
  return next;
}

/** Snapshot the current state without pushing anything. */
export function snapshotOnly(state: any): Record<string, Map<string, string>> {
  const snap: Record<string, Map<string, string>> = {};
  for (const col of collectSyncRows(state)) {
    const m = new Map<string, string>();
    for (const { id, row } of col.rows) m.set(id, stableStringify(row));
    snap[col.table] = m;
  }
  return snap;
}

// ---------- Pull (hydration) ----------

const PULL_ORDER = [
  'profiles',
  'courses',
  'course_groups',
  'enrollments',
  'sessions',
  'video_plays',
  'exams',
  'questions',
  'exam_attempts',
  'assignments',
  'assignment_submissions',
  'attendance',
  'student_payments',
  'payment_transactions',
  'group_billing_settings',
  'teacher_compensation',
  'teacher_earnings',
  'complaints',
  'notifications',
  'course_materials',
  'student_notes',
  'parent_student_links',
  'ai_conversations',
  'ai_messages',
];

/** Download every table. Returns { table: rows[] } (empty on failure). */
export async function pullAll(): Promise<Record<string, any[]>> {
  const out: Record<string, any[]> = {};
  await Promise.all(
    PULL_ORDER.map(async (table) => {
      try {
        const { data, error } = await supabaseAdmin.from(table).select('*').limit(5000);
        if (error) {
          logSyncError(table, 'pull', error);
          out[table] = [];
        } else {
          out[table] = data || [];
          failedOnce.delete(table + ':pull');
        }
      } catch (err) {
        logSyncError(table, 'pull', err);
        out[table] = [];
      }
    })
  );
  return out;
}

// ---------- DB row -> app shape mappers (for hydration) ----------

export const fromDb: Record<string, (r: any) => any> = {
  profiles: (r) => ({
    id: r.id,
    full_name: r.full_name,
    email: r.email,
    phone: r.phone || '',
    role: r.role,
    avatar: r.avatar || undefined,
    grade_level: r.grade_level || undefined,
    teacher_id: r.teacher_id || undefined,
    parent_id: r.parent_id || undefined,
    created_at: r.created_at,
  }),
  courses: (r) => ({
    id: r.id,
    title: r.title,
    description: r.description || '',
    created_by: r.created_by || undefined,
    status: r.status || 'draft',
    created_at: r.created_at,
  }),
  course_groups: (r) => ({
    id: r.id,
    course_id: r.course_id,
    teacher_id: r.teacher_id,
    name: r.name,
    start_date: r.start_date || undefined,
    end_date: r.end_date || undefined,
    status: r.status || 'active',
    created_at: r.created_at,
    active_students: 0,
  }),
  enrollments: (r) => ({
    id: r.id,
    student_id: r.student_id,
    group_id: r.group_id,
    enrolled_at: r.enrolled_at,
    status: r.status || 'active',
  }),
  sessions: (r) => ({
    id: r.id,
    group_id: r.group_id,
    title: r.title,
    description: r.description || undefined,
    session_number: r.session_number ?? 1,
    video_url: r.video_url || undefined,
    materials_url: r.materials_url || undefined,
    scheduled_at: r.scheduled_at || undefined,
    is_published: !!r.is_published,
    created_at: r.created_at,
  }),
  video_plays: (r) => ({
    id: r.id,
    session_id: r.session_id,
    student_id: r.student_id,
    started_at: r.started_at,
    ended_at: r.ended_at || undefined,
    play_number: r.play_number ?? 1,
    created_at: r.created_at,
  }),
  exams: (r) => ({
    id: r.id,
    session_id: r.session_id,
    title: r.title,
    passing_score: r.passing_score ?? 70,
    duration_minutes: r.duration_minutes ?? 15,
    is_published: !!r.is_published,
    subject: r.subject || undefined,
    grade_level: r.grade_level || undefined,
    deadline: r.deadline || undefined,
    creator_role: r.creator_role || undefined,
    creation_mode: r.creation_mode || undefined,
    curriculum_type: r.curriculum_type || undefined,
    material_url: r.material_url || undefined,
    created_at: r.created_at,
    questions: [],
  }),
  questions: (r) => ({
    id: r.id,
    exam_id: r.exam_id,
    question_text: r.question_text,
    question_type: r.question_type || 'mcq',
    options: Array.isArray(r.options) ? r.options : [],
    correct_answer: r.correct_answer ?? '',
    points: r.points ?? 1,
    explanation: r.explanation || undefined,
  }),
  exam_attempts: (r) => ({
    id: r.id,
    exam_id: r.exam_id,
    student_id: r.student_id,
    score: r.score ?? 0,
    total_score: r.total_score ?? 0,
    passed: !!r.passed,
    started_at: r.started_at,
    submitted_at: r.submitted_at || undefined,
  }),
  assignments: (r) => ({
    id: r.id,
    group_id: r.group_id,
    session_id: r.session_id || undefined,
    title: r.title,
    description: r.description || undefined,
    due_at: r.due_at || undefined,
    max_score: r.max_score ?? 100,
    is_published: !!r.is_published,
    created_by: r.created_by || undefined,
    created_at: r.created_at,
  }),
  assignment_submissions: (r) => ({
    id: r.id,
    assignment_id: r.assignment_id,
    student_id: r.student_id,
    submission_text: r.submission_text || undefined,
    file_url: r.file_url || undefined,
    score: r.score ?? undefined,
    teacher_feedback: r.teacher_feedback || undefined,
    status: r.status || 'submitted',
    submitted_at: r.submitted_at,
    graded_at: r.graded_at || undefined,
    graded_by: r.graded_by || undefined,
  }),
  attendance: (r) => ({
    id: r.id,
    session_id: r.session_id,
    student_id: r.student_id,
    status: r.status,
    recorded_by: r.recorded_by || undefined,
    recorded_at: r.recorded_at,
  }),
  student_payments: (r) => ({
    id: r.id,
    student_id: r.student_id,
    group_id: r.group_id,
    session_id: r.session_id || undefined,
    amount: Number(r.amount ?? 0),
    currency: r.currency || 'EGP',
    period_label: r.period_label || undefined,
    due_date: r.due_date || undefined,
    status: r.status || 'unpaid',
    payment_method: r.payment_method || undefined,
    paid_at: r.paid_at || undefined,
    recorded_by: r.recorded_by || undefined,
    notes: r.notes || undefined,
    waived_reason: r.waived_reason || undefined,
    waived_at: r.waived_at || undefined,
    waived_by: r.waived_by || undefined,
    paid_amount: Number(r.paid_amount ?? 0),
    amount_due: Number(r.amount ?? 0),
    amount_paid: Number(r.paid_amount ?? 0),
    remaining_amount: Math.max(0, Number(r.amount ?? 0) - Number(r.paid_amount ?? 0)),
    created_at: r.created_at,
  }),
  payment_transactions: (r) => ({
    id: r.id,
    student_payment_id: r.student_payment_id,
    amount: Number(r.amount ?? 0),
    payment_method: r.payment_method || 'cash',
    paid_at: r.paid_at,
    recorded_by: r.recorded_by || '',
    notes: r.notes || undefined,
    reference_number: r.reference_number || undefined,
    created_at: r.created_at,
  }),
  group_billing_settings: (r) => ({
    id: r.id,
    group_id: r.group_id,
    payment_type: r.payment_type || 'monthly',
    amount: Number(r.amount ?? 0),
    currency: r.currency || 'EGP',
    created_at: r.created_at,
  }),
  teacher_compensation: (r) => ({
    id: r.id,
    group_id: r.group_id,
    teacher_id: r.teacher_id,
    compensation_type: r.compensation_type || 'per_session',
    amount: Number(r.amount ?? 0),
    currency: r.currency || 'EGP',
    created_at: r.created_at,
  }),
  teacher_earnings: (r) => ({
    id: r.id,
    teacher_id: r.teacher_id,
    group_id: r.group_id,
    session_id: r.session_id || undefined,
    amount: Number(r.amount ?? 0),
    currency: r.currency || 'EGP',
    description: r.description || undefined,
    status: r.status || 'pending',
    calculated_at: r.calculated_at,
    paid_at: r.paid_at || undefined,
    notes: r.notes || undefined,
  }),
  complaints: (r) => ({
    id: r.id,
    submitted_by: r.submitted_by,
    subject: r.subject,
    description: r.description,
    category: r.category || undefined,
    priority: r.priority || 'normal',
    status: r.status || 'open',
    assigned_to: r.assigned_to || undefined,
    admin_response: r.admin_response || undefined,
    created_at: r.created_at,
    resolved_at: r.resolved_at || undefined,
  }),
  notifications: (r) => ({
    id: r.id,
    user_id: r.user_id,
    title: r.title,
    message: r.message,
    notification_type: r.notification_type || 'general',
    type: r.notification_type || 'general',
    is_read: !!r.is_read,
    related_url: r.related_url || undefined,
    created_at: r.created_at,
  }),
  course_materials: (r) => ({
    id: r.id,
    course_id: r.course_id || undefined,
    session_id: r.session_id || undefined,
    group_id: r.group_id || undefined,
    grade_level: r.grade_level || undefined,
    title: r.title,
    description: r.description || undefined,
    file_url: r.file_url,
    file_type: r.file_type || undefined,
    uploaded_by: r.uploaded_by || undefined,
    rag_status: r.rag_status || 'pending',
    rag_error: r.rag_error || undefined,
    rag_processed_at: r.rag_processed_at || undefined,
    rag_chunk_count: r.rag_chunk_count ?? 0,
    download_count: r.download_count ?? 0,
    created_at: r.created_at,
  }),
  student_notes: (r) => ({
    id: r.id,
    student_id: r.student_id,
    teacher_id: r.teacher_id,
    group_id: r.group_id,
    note: r.note,
    created_at: r.created_at,
  }),
  parent_student_links: (r) => ({
    id: r.id,
    parent_id: r.parent_id,
    student_id: r.student_id,
    status: r.status || 'pending',
    created_at: r.created_at,
  }),
  ai_conversations: (r) => ({
    id: r.id,
    user_id: r.user_id,
    group_id: r.group_id || undefined,
    title: r.title || 'مساعد EduFlow الذكي',
    created_at: r.created_at,
    updated_at: r.updated_at,
  }),
  ai_messages: (r) => ({
    id: r.id,
    conversation_id: r.conversation_id,
    sender: r.sender,
    message: r.message,
    metadata: r.metadata || {},
    created_at: r.created_at,
  }),
};
