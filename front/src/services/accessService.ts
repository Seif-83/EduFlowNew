/**
 * Lesson pricing, unlock codes and view limits.
 * Every decision (is the code valid, is it already used, how many views are left,
 * who may price / generate / record) is made by Postgres functions in supabase/setup5.sql.
 * This file only calls them. If the server cannot be reached the answer is "denied".
 */
import { supabaseAdmin } from './supabaseClient';
import { isUuid } from './supabaseSync';

export interface ServerResult {
  success: boolean;
  message: string;
  [k: string]: any;
}

export interface ViewResult {
  allowed: boolean;
  reason?: string;
  locked?: boolean;
  price?: number;
  views_used?: number;
  views_remaining?: number;
  view_limit?: number;
  source?: string;
}

export interface LessonRow { id: string; group_id: string; title: string; session_number: number; price: number | null; is_published?: boolean }
export interface BundleRow { id: string; group_id: string; name: string; price: number; session_ids: string[] }
export interface AccessRow { id: string; student_id: string; session_id: string; source: string; view_limit: number; views_used: number }
export interface SubscriptionRow { id: string; student_id: string; group_id: string; period: string; amount: number }
export interface CodeRow { id: string; code: string; group_id: string; session_id: string | null; bundle_id: string | null; view_limit: number; status: 'active' | 'used' | 'revoked'; redeemed_by: string | null; redeemed_at: string | null; created_at: string }
export interface PaymentRow { id: string; student_id: string; group_id: string; kind: 'lesson' | 'subscription' | 'bundle'; session_id: string | null; bundle_id: string | null; period: string | null; amount: number; method: string; recorded_by: string | null; created_at: string }
export interface MonthlyRow { group_id: string; amount: number }

const SETUP_HINT = 'السيرفر مش جاهز. شغّل supabase/setup5.sql في Supabase الأول.';

function friendlyError(error: any): string {
  const msg = String(error?.message || error || '');
  if (/Could not find the function|schema cache|does not exist|relation/i.test(msg)) return SETUP_HINT;
  if (/invalid input syntax for type uuid/i.test(msg)) return 'الحساب ده تجريبي ومش موجود على السيرفر.';
  return 'تعذر الاتصال بالسيرفر: ' + msg;
}

async function rpc(fn: string, args: Record<string, any>): Promise<ServerResult> {
  try {
    const { data, error } = await supabaseAdmin.rpc(fn, args);
    if (error) return { success: false, message: friendlyError(error) };
    return (data || { success: false, message: 'رد غير متوقع من السيرفر' }) as ServerResult;
  } catch (e) {
    return { success: false, message: friendlyError(e) };
  }
}

const needUuid = (...ids: (string | null | undefined)[]): ServerResult | null =>
  ids.every((i) => !i || isUuid(i)) ? null : { success: false, message: 'الحساب أو المجموعة دي تجريبية ومش موجودة على السيرفر.' };

// ---------- teacher ----------
export async function setSessionPrice(teacherId: string, sessionId: string, price: number | null) {
  return needUuid(teacherId, sessionId) || rpc('set_session_price', { p_teacher: teacherId, p_session: sessionId, p_price: price });
}
export async function setGroupMonthlyPrice(teacherId: string, groupId: string, price: number | null) {
  return needUuid(teacherId, groupId) || rpc('set_group_monthly_price', { p_teacher: teacherId, p_group: groupId, p_price: price });
}
export async function createBundle(teacherId: string, groupId: string, name: string, price: number, sessionIds: string[]) {
  return needUuid(teacherId, groupId, ...sessionIds) || rpc('create_lesson_bundle', { p_teacher: teacherId, p_group: groupId, p_name: name, p_price: price, p_sessions: sessionIds });
}
export async function generateCodes(teacherId: string, target: { sessionId?: string; bundleId?: string }, count: number, viewLimit: number) {
  return needUuid(teacherId, target.sessionId, target.bundleId) || rpc('generate_unlock_codes', { p_teacher: teacherId, p_session: target.sessionId || null, p_bundle: target.bundleId || null, p_count: count, p_view_limit: viewLimit });
}
export async function revokeCode(teacherId: string, code: string) {
  return needUuid(teacherId) || rpc('revoke_unlock_code', { p_teacher: teacherId, p_code: code });
}
export async function recordPayment(teacherId: string, studentId: string, kind: 'lesson' | 'subscription' | 'bundle', targetId: string, method: string) {
  return needUuid(teacherId, studentId, targetId) || rpc('record_lesson_payment', { p_teacher: teacherId, p_student: studentId, p_kind: kind, p_target: targetId, p_method: method });
}

// ---------- student ----------
export async function redeemCode(studentId: string, code: string) {
  return needUuid(studentId) || rpc('redeem_unlock_code', { p_student: studentId, p_code: code });
}
export async function consumeView(studentId: string, sessionId: string): Promise<ViewResult> {
  const bad = needUuid(studentId, sessionId);
  if (bad) return { allowed: false, reason: bad.message };
  try {
    const { data, error } = await supabaseAdmin.rpc('consume_lesson_view', { p_student: studentId, p_session: sessionId });
    if (error) return { allowed: false, reason: friendlyError(error) };
    return data as ViewResult;
  } catch (e) {
    return { allowed: false, reason: friendlyError(e) };
  }
}

// ---------- reads ----------
async function select<T>(table: string, build: (q: any) => any): Promise<T[]> {
  try {
    const { data, error } = await build(supabaseAdmin.from(table).select('*'));
    if (error) return [];
    return (data || []) as T[];
  } catch {
    return [];
  }
}

export async function fetchGroupCommerce(groupIds: string[]) {
  const ids = groupIds.filter(isUuid);
  if (ids.length === 0) return { lessons: [] as LessonRow[], bundles: [] as BundleRow[], codes: [] as CodeRow[], payments: [] as PaymentRow[], monthly: [] as MonthlyRow[] };
  const [lessons, bundles, codes, payments, monthly] = await Promise.all([
    select<LessonRow>('sessions', (q) => q.in('group_id', ids).order('session_number')),
    select<BundleRow>('lesson_bundles', (q) => q.in('group_id', ids).order('created_at')),
    select<CodeRow>('unlock_codes', (q) => q.in('group_id', ids).order('created_at', { ascending: false }).limit(500)),
    select<PaymentRow>('lesson_payments', (q) => q.in('group_id', ids).order('created_at', { ascending: false }).limit(500)),
    select<MonthlyRow>('group_billing_settings', (q) => q.in('group_id', ids).eq('payment_type', 'monthly')),
  ]);
  return { lessons, bundles, codes, payments, monthly };
}

export async function fetchStudentCommerce(studentId: string, groupIds: string[]) {
  const ids = groupIds.filter(isUuid);
  if (!isUuid(studentId) || ids.length === 0) {
    return { lessons: [] as LessonRow[], bundles: [] as BundleRow[], access: [] as AccessRow[], subscriptions: [] as SubscriptionRow[], payments: [] as PaymentRow[], monthly: [] as MonthlyRow[] };
  }
  const [lessons, bundles, access, subscriptions, payments, monthly] = await Promise.all([
    select<LessonRow>('sessions', (q) => q.in('group_id', ids).eq('is_published', true).order('session_number')),
    select<BundleRow>('lesson_bundles', (q) => q.in('group_id', ids)),
    select<AccessRow>('lesson_access', (q) => q.eq('student_id', studentId)),
    select<SubscriptionRow>('student_subscriptions', (q) => q.eq('student_id', studentId)),
    select<PaymentRow>('lesson_payments', (q) => q.eq('student_id', studentId).order('created_at', { ascending: false })),
    select<MonthlyRow>('group_billing_settings', (q) => q.in('group_id', ids).eq('payment_type', 'monthly')),
  ]);
  return { lessons, bundles, access, subscriptions, payments, monthly };
}

export async function fetchAdminMonitor() {
  const [payments, codes, access, subscriptions, lessons, groups] = await Promise.all([
    select<PaymentRow>('lesson_payments', (q) => q.order('created_at', { ascending: false }).limit(1000)),
    select<CodeRow>('unlock_codes', (q) => q.order('created_at', { ascending: false }).limit(1000)),
    select<AccessRow>('lesson_access', (q) => q.limit(5000)),
    select<SubscriptionRow>('student_subscriptions', (q) => q.limit(5000)),
    select<LessonRow>('sessions', (q) => q.order('session_number')),
    select<{ id: string; name: string; teacher_id: string }>('course_groups', (q) => q),
  ]);
  return { payments, codes, access, subscriptions, lessons, groups };
}

export const currentPeriod = () => {
  const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'Africa/Cairo' }));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};
