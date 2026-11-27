import React from 'react';
import { RefreshCw } from 'lucide-react';
import type { fetchAdminMonitor } from '../../services/accessService';
import { Profile } from '../../types/database';

type Monitor = Awaited<ReturnType<typeof fetchAdminMonitor>>;

interface Props {
  data: Monitor | null;
  loading: boolean;
  profiles: Profile[];
  onRefresh: () => void;
}

const KIND_LABEL: Record<string, string> = { lesson: 'حصة', subscription: 'اشتراك شهري', bundle: 'باقة' };
const METHOD_LABEL: Record<string, string> = { cash: 'نقدي', instapay: 'إنستاباي', vodafone_cash: 'فودافون كاش', bank_transfer: 'تحويل بنكي', other: 'أخرى' };
const CODE_LABEL: Record<string, string> = { active: 'نشط', used: 'مستخدم', revoked: 'ملغي' };

/** Read-only monitoring for the admin. Prices, codes and payments are managed by teachers. */
export const AdminCommerceMonitor: React.FC<Props> = ({ data, loading, profiles, onRefresh }) => {
  const nameOf = (id?: string | null) => profiles.find((p) => p.id === id)?.full_name || (id ? id.slice(0, 8) : '—');
  const groupName = (id: string) => data?.groups.find((g) => g.id === id)?.name || id.slice(0, 8);
  const lessonTitle = (id?: string | null) => {
    const l = data?.lessons.find((x) => x.id === id);
    return l ? `حصة ${l.session_number}: ${l.title}` : '—';
  };

  const total = (data?.payments || []).reduce((a, p) => a + Number(p.amount), 0);
  const byTeacher: Record<string, number> = {};
  (data?.payments || []).forEach((p) => {
    const t = data?.groups.find((g) => g.id === p.group_id)?.teacher_id || '';
    byTeacher[t] = (byTeacher[t] || 0) + Number(p.amount);
  });
  const codes = data?.codes || [];
  const used = codes.filter((c) => c.status === 'used').length;
  const active = codes.filter((c) => c.status === 'active').length;
  const exhausted = (data?.access || []).filter((a) => a.views_used >= a.view_limit).length;

  return (
    <div className="space-y-6">
      <div className="bg-white border-2 border-slate-200 rounded-3xl p-6 shadow-sm">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h3 className="text-lg font-black text-slate-900">🔑 مراقبة المدفوعات والأكواد</h3>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              عرض فقط. المدرس هو اللي يحدد أسعار الحصص والاشتراك والباقات ويولّد الأكواد ويسجل الدفع. السيرفر هو اللي بيتحقق من الكود وعدد المشاهدات.
            </p>
          </div>
          <button
            type="button"
            onClick={onRefresh}
            className="px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>تحديث</span>
          </button>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200">
            <span className="text-[11px] font-bold text-emerald-800 block">إجمالي المدفوعات المسجلة</span>
            <span className="text-xl font-black text-emerald-700">{total} ج.م</span>
          </div>
          <div className="p-4 rounded-2xl bg-blue-50 border border-blue-200">
            <span className="text-[11px] font-bold text-blue-800 block">اشتراكات شهرية فعالة</span>
            <span className="text-xl font-black text-blue-700">{(data?.subscriptions || []).length}</span>
          </div>
          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200">
            <span className="text-[11px] font-bold text-amber-800 block">الأكواد (نشط / مستخدم)</span>
            <span className="text-xl font-black text-amber-700">{active} / {used}</span>
          </div>
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
            <span className="text-[11px] font-bold text-slate-700 block">حصص استنفدت مشاهداتها</span>
            <span className="text-xl font-black text-slate-800">{exhausted}</span>
          </div>
        </div>

        {Object.keys(byTeacher).length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2 text-xs">
            {Object.entries(byTeacher).map(([t, v]) => (
              <span key={t} className="px-3 py-1.5 rounded-full bg-slate-100 border border-slate-200 font-bold text-slate-700">
                {nameOf(t)}: {v} ج.م
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white border-2 border-slate-200 rounded-3xl p-6 shadow-sm">
        <h4 className="font-black text-slate-900 text-sm mb-3">💳 سجل المدفوعات</h4>
        {(data?.payments || []).length === 0 ? (
          <p className="text-xs text-slate-500">مفيش مدفوعات مسجلة لسه. المدرس يسجلها من تاب "الأسعار والأكواد".</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 font-bold">
                  <th className="pb-3">الطالب</th>
                  <th className="pb-3">المجموعة</th>
                  <th className="pb-3">النوع</th>
                  <th className="pb-3">التفاصيل</th>
                  <th className="pb-3">المبلغ</th>
                  <th className="pb-3">الطريقة</th>
                  <th className="pb-3">سجّلها</th>
                  <th className="pb-3">التاريخ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(data?.payments || []).map((p) => (
                  <tr key={p.id}>
                    <td className="py-3 font-bold text-slate-900">{nameOf(p.student_id)}</td>
                    <td className="py-3 text-slate-600">{groupName(p.group_id)}</td>
                    <td className="py-3">{KIND_LABEL[p.kind] || p.kind}</td>
                    <td className="py-3 text-slate-600">{p.kind === 'lesson' ? lessonTitle(p.session_id) : p.kind === 'subscription' ? p.period : 'باقة'}</td>
                    <td className="py-3 font-bold text-emerald-700">{p.amount} ج.م</td>
                    <td className="py-3">{METHOD_LABEL[p.method] || p.method}</td>
                    <td className="py-3 text-slate-600">{nameOf(p.recorded_by)}</td>
                    <td className="py-3 text-slate-500">{new Date(p.created_at).toLocaleDateString('ar-EG')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border-2 border-slate-200 rounded-3xl p-6 shadow-sm">
          <h4 className="font-black text-slate-900 text-sm mb-3">🎟️ الأكواد</h4>
          {codes.length === 0 ? (
            <p className="text-xs text-slate-500">مفيش أكواد اتولدت لسه.</p>
          ) : (
            <div className="overflow-x-auto max-h-80 overflow-y-auto">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 font-bold">
                    <th className="pb-2">الكود</th>
                    <th className="pb-2">يفتح</th>
                    <th className="pb-2">الحالة</th>
                    <th className="pb-2">استخدمه</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {codes.map((c) => (
                    <tr key={c.id}>
                      <td className="py-2 font-mono font-bold">{c.code}</td>
                      <td className="py-2 text-slate-600">{c.session_id ? lessonTitle(c.session_id) : 'باقة'} ({c.view_limit} مشاهدات)</td>
                      <td className="py-2">{CODE_LABEL[c.status]}</td>
                      <td className="py-2 text-slate-600">{c.redeemed_by ? nameOf(c.redeemed_by) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="bg-white border-2 border-slate-200 rounded-3xl p-6 shadow-sm">
          <h4 className="font-black text-slate-900 text-sm mb-3">👁️ المشاهدات لكل طالب</h4>
          {(data?.access || []).length === 0 ? (
            <p className="text-xs text-slate-500">لسه محدش شاف حصة.</p>
          ) : (
            <div className="overflow-x-auto max-h-80 overflow-y-auto">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 font-bold">
                    <th className="pb-2">الطالب</th>
                    <th className="pb-2">الحصة</th>
                    <th className="pb-2">المصدر</th>
                    <th className="pb-2">المشاهدات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(data?.access || []).map((a) => (
                    <tr key={a.id}>
                      <td className="py-2 font-bold text-slate-900">{nameOf(a.student_id)}</td>
                      <td className="py-2 text-slate-600">{lessonTitle(a.session_id)}</td>
                      <td className="py-2">{({ free: 'مجانية', payment: 'دفع', subscription: 'اشتراك', bundle: 'باقة', code: 'كود' } as Record<string, string>)[a.source] || a.source}</td>
                      <td className="py-2 font-bold">{a.views_used} / {a.view_limit}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
