import React, { useCallback, useEffect, useState } from 'react';
import { Profile } from '../../types/database';
import {
  fetchGroupCommerce,
  setSessionPrice,
  setGroupMonthlyPrice,
  createBundle,
  generateCodes,
  revokeCode,
  recordPayment,
} from '../../services/accessService';

interface Props {
  teacher: Profile;
  groupId: string;
  groupName: string;
  students: Profile[];
}

type Commerce = Awaited<ReturnType<typeof fetchGroupCommerce>>;
type Msg = { ok: boolean; text: string } | null;

const CODE_LABEL: Record<string, string> = { active: 'نشط', used: 'مستخدم', revoked: 'ملغي' };
const KIND_LABEL: Record<string, string> = { lesson: 'حصة', subscription: 'اشتراك شهري', bundle: 'باقة' };

const Banner: React.FC<{ msg: Msg }> = ({ msg }) =>
  msg ? (
    <div className={`mt-3 p-3 rounded-xl text-xs font-bold border ${msg.ok ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-700'}`}>
      {msg.text}
    </div>
  ) : null;

const STUDIO_HINT = 'اعمل أو انشر حصة من "إدارة الحصص 📚" (الزرار تحت على اليمين) وهتظهر هنا تلقائياً.';

const card = 'bg-white border-2 border-slate-200 rounded-3xl p-6 shadow-sm';
const input = 'p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold';
const btn = 'px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-bold text-xs cursor-pointer';

export const TeacherPricingPanel: React.FC<Props> = ({ teacher, groupId, groupName, students }) => {
  const [data, setData] = useState<Commerce | null>(null);
  const [msg, setMsg] = useState<Msg>(null);
  const [busy, setBusy] = useState(false);
  const [priceDrafts, setPriceDrafts] = useState<Record<string, string>>({});
  const [monthlyDraft, setMonthlyDraft] = useState<string | null>(null);

  const [bundleName, setBundleName] = useState('');
  const [bundlePrice, setBundlePrice] = useState('');
  const [bundleLessons, setBundleLessons] = useState<string[]>([]);

  const [codeTarget, setCodeTarget] = useState(''); // "s:<id>" or "b:<id>"
  const [codeCount, setCodeCount] = useState('5');
  const [codeViews, setCodeViews] = useState('3');
  const [newCodes, setNewCodes] = useState<string[]>([]);

  const [payStudent, setPayStudent] = useState('');
  const [payKind, setPayKind] = useState<'lesson' | 'bundle' | 'subscription'>('lesson');
  const [payTarget, setPayTarget] = useState('');
  const [payMethod, setPayMethod] = useState('cash');

  const refresh = useCallback(async () => {
    setData(await fetchGroupCommerce([groupId]));
  }, [groupId]);
  useEffect(() => {
    setMonthlyDraft(null);
    setPriceDrafts({});
    setNewCodes([]);
    refresh();
  }, [refresh]);

  const lessons = data?.lessons || [];
  const bundles = data?.bundles || [];
  const monthly = data?.monthly?.[0] ? Number(data.monthly[0].amount) : 0;
  const studentName = (id: string) => students.find((s) => s.id === id)?.full_name || id.slice(0, 8);
  const lessonLabel = (id?: string | null) => {
    const l = lessons.find((x) => x.id === id);
    return l ? `حصة ${l.session_number}: ${l.title}` : '—';
  };

  const run = async (fn: () => Promise<{ success: boolean; message: string }>, after?: () => void) => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fn();
      setMsg({ ok: !!res.success, text: res.message });
      if (res.success) {
        after?.();
        await refresh();
      }
    } finally {
      setBusy(false);
    }
  };

  const copy = (text: string) => {
    try { navigator.clipboard?.writeText(text); } catch { /* ignore */ }
  };

  return (
    <div className="space-y-6">
      <div className={card}>
        <h3 className="text-lg font-black text-slate-900">🏷️ الأسعار والأكواد: {groupName}</h3>
        <p className="text-xs text-slate-500 mt-1 leading-relaxed">
          إنت اللي بتحدد السعر. الطالب يفتح الحصة بالدفع (حصة، اشتراك شهري، أو باقة) أو بكود يستخدمه مرة واحدة. السيرفر هو اللي بيتحقق من الكود وبيحسب المشاهدات. الحصة اللي ملهاش سعر مجانية.
        </p>
        <Banner msg={msg} />
      </div>

      <div className={card}>
        <h4 className="font-black text-slate-900 text-sm mb-1">📅 الاشتراك الشهري للمجموعة</h4>
        <p className="text-[11px] text-slate-500 mb-3">بيفتح كل حصص المجموعة المدفوعة طول الشهر. سيبه فاضي (أو 0) لو مفيش اشتراك.</p>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="number" min={0}
            value={monthlyDraft ?? (monthly ? String(monthly) : '')}
            onChange={(e) => setMonthlyDraft(e.target.value)}
            placeholder="السعر بالجنيه"
            className={`${input} w-36`}
          />
          <button
            type="button" disabled={busy} className={btn}
            onClick={() => run(() => setGroupMonthlyPrice(teacher.id, groupId, Number(monthlyDraft ?? monthly) || null), () => setMonthlyDraft(null))}
          >
            حفظ
          </button>
          <span className={`text-[11px] font-bold ${monthly ? 'text-emerald-700' : 'text-slate-500'}`}>
            {monthly ? `الحالي: ${monthly} ج.م شهرياً` : 'مفيش اشتراك شهري'}
          </span>
        </div>
        <Banner msg={msg} />
      </div>

      <div className={card}>
        <h4 className="font-black text-slate-900 text-sm mb-3">🎬 سعر كل حصة</h4>
        {lessons.length === 0 ? (
          <p className="text-xs text-slate-500">مفيش حصص للمجموعة دي لسه. {STUDIO_HINT}</p>
        ) : (
          <div className="space-y-2">
            {lessons.map((l) => {
              const cur = l.price ? Number(l.price) : 0;
              const draft = priceDrafts[l.id] ?? (cur ? String(cur) : '');
              return (
                <div key={l.id} className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-bold text-slate-800 min-w-[200px]">حصة {l.session_number}: {l.title}</span>
                  <input
                    type="number" min={0} value={draft} placeholder="مجانية"
                    onChange={(e) => setPriceDrafts((d) => ({ ...d, [l.id]: e.target.value }))}
                    className={`${input} w-28`}
                  />
                  <button
                    type="button" disabled={busy} className={btn}
                    onClick={() => run(() => setSessionPrice(teacher.id, l.id, Number(draft) || null), () => setPriceDrafts((d) => { const n = { ...d }; delete n[l.id]; return n; }))}
                  >
                    حفظ
                  </button>
                  <span className={`text-[11px] font-bold ${cur ? 'text-emerald-700' : 'text-slate-500'}`}>{cur ? `${cur} ج.م` : 'مجانية'}</span>
                </div>
              );
            })}
          </div>
        )}
        <Banner msg={msg} />
      </div>

      <div className={card}>
        <h4 className="font-black text-slate-900 text-sm mb-3">📦 الباقات</h4>
        {bundles.map((b) => (
          <div key={b.id} className="mb-2 p-3 rounded-xl bg-indigo-50 border border-indigo-200 text-xs">
            <span className="font-black text-indigo-950">{b.name}</span> · {Number(b.price)} ج.م · {b.session_ids.map((id) => lessonLabel(id)).join('، ')}
          </div>
        ))}
        <div className="mt-3 space-y-2">
          <div className="flex flex-wrap gap-2">
            <input value={bundleName} onChange={(e) => setBundleName(e.target.value)} placeholder="اسم الباقة (مثال: مراجعة شهر ١١)" className={`${input} w-48`} />
            <input type="number" min={1} value={bundlePrice} onChange={(e) => setBundlePrice(e.target.value)} placeholder="السعر بالجنيه" className={`${input} w-28`} />
          </div>
          {lessons.length === 0 && (
            <p className="text-[11px] text-slate-500">مفيش حصص تتحط في الباقة لسه. {STUDIO_HINT}</p>
          )}
          <div className="flex flex-wrap gap-3 text-xs">
            {lessons.map((l) => (
              <label key={l.id} className="flex items-center gap-1.5 font-semibold text-slate-700 cursor-pointer">
                <input
                  type="checkbox" checked={bundleLessons.includes(l.id)}
                  onChange={(e) => setBundleLessons((cur) => (e.target.checked ? [...cur, l.id] : cur.filter((x) => x !== l.id)))}
                />
                حصة {l.session_number}
              </label>
            ))}
          </div>
          <button
            type="button" disabled={busy} className={btn}
            onClick={() => {
              const name = bundleName.trim();
              const price = Number(bundlePrice);
              if (!name) {
                setMsg({ ok: false, text: 'اكتب اسم الباقة الأول في الخانة الأولى (مثال: باقة مراجعة شهر ١١).' });
                return;
              }
              if (!bundlePrice.trim() || !Number.isFinite(price) || price <= 0) {
                setMsg({ ok: false, text: 'اكتب سعر الباقة بالجنيه في خانة السعر (رقم أكبر من صفر).' });
                return;
              }
              if (bundleLessons.length === 0) {
                setMsg({ ok: false, text: 'اختار حصة واحدة على الأقل من مربعات الاختيار فوق عشان تدخل في الباقة.' });
                return;
              }
              run(() => createBundle(teacher.id, groupId, name, price, bundleLessons), () => { setBundleName(''); setBundlePrice(''); setBundleLessons([]); });
            }}
          >
            إنشاء الباقة
          </button>
          <Banner msg={msg} />
        </div>
      </div>

      <div className={card}>
        <h4 className="font-black text-slate-900 text-sm mb-1">🎟️ أكواد الفتح</h4>
        <p className="text-[11px] text-slate-500 mb-3">كل كود يتستخدم مرة واحدة، ويفتح الحصة (أو الباقة) لطالب واحد بعدد المشاهدات اللي تحدده.</p>
        <div className="flex flex-wrap items-center gap-2">
          <select value={codeTarget} onChange={(e) => setCodeTarget(e.target.value)} className={`${input} min-w-[200px]`}>
            <option value="">-- اختار حصة أو باقة --</option>
            {lessons.map((l) => <option key={l.id} value={`s:${l.id}`}>حصة {l.session_number}: {l.title}</option>)}
            {bundles.map((b) => <option key={b.id} value={`b:${b.id}`}>باقة: {b.name}</option>)}
          </select>
          <label className="text-xs font-bold text-slate-700 flex items-center gap-1">العدد
            <input type="number" min={1} max={100} value={codeCount} onChange={(e) => setCodeCount(e.target.value)} className={`${input} w-20`} />
          </label>
          <label className="text-xs font-bold text-slate-700 flex items-center gap-1">المشاهدات
            <input type="number" min={1} max={20} value={codeViews} onChange={(e) => setCodeViews(e.target.value)} className={`${input} w-20`} />
          </label>
          <button
            type="button" disabled={busy || !codeTarget} className={btn}
            onClick={async () => {
              if (busy) return;
              setBusy(true);
              try {
                const t = codeTarget.startsWith('s:') ? { sessionId: codeTarget.slice(2) } : { bundleId: codeTarget.slice(2) };
                const res = await generateCodes(teacher.id, t, Number(codeCount), Number(codeViews));
                setMsg({ ok: !!res.success, text: res.message });
                if (res.success) { setNewCodes(res.codes || []); await refresh(); }
              } finally { setBusy(false); }
            }}
          >
            توليد الأكواد
          </button>
        </div>
        {!codeTarget && (
          <p className="mt-2 text-[11px] text-slate-400">زرار "توليد الأكواد" بيفضل متعطل لحد ما تختار حصة أو باقة من القايمة اللي على الشمال.</p>
        )}
        {lessons.length === 0 && bundles.length === 0 && (
          <p className="mt-1 text-[11px] text-slate-500">مفيش حصص أو باقات تتعملها أكواد لسه. {STUDIO_HINT}</p>
        )}
        <Banner msg={msg} />

        {newCodes.length > 0 && (
          <div className="mt-3 p-3 rounded-xl bg-amber-50 border border-amber-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-black text-amber-900">الأكواد الجديدة</span>
              <button type="button" onClick={() => copy(newCodes.join('\n'))} className="text-[11px] font-bold text-amber-800 underline cursor-pointer">نسخ الكل</button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 font-mono text-xs font-bold text-amber-950" dir="ltr">
              {newCodes.map((c) => <span key={c}>{c}</span>)}
            </div>
          </div>
        )}

        <div className="mt-4 overflow-x-auto max-h-72 overflow-y-auto">
          <table className="w-full text-right text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 font-bold">
                <th className="pb-2">الكود</th><th className="pb-2">يفتح</th><th className="pb-2">الحالة</th><th className="pb-2">استخدمه</th><th className="pb-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(data?.codes || []).map((c) => (
                <tr key={c.id}>
                  <td className="py-2 font-mono font-bold" dir="ltr">{c.code}</td>
                  <td className="py-2 text-slate-600">{c.session_id ? lessonLabel(c.session_id) : `باقة: ${bundles.find((b) => b.id === c.bundle_id)?.name || ''}`} ({c.view_limit} مشاهدات)</td>
                  <td className="py-2">{CODE_LABEL[c.status]}</td>
                  <td className="py-2 text-slate-600">{c.redeemed_by ? studentName(c.redeemed_by) : '—'}</td>
                  <td className="py-2">
                    {c.status === 'active' && (
                      <button type="button" disabled={busy} onClick={() => run(() => revokeCode(teacher.id, c.code))} className="text-[11px] font-bold text-red-600 underline cursor-pointer">إلغاء</button>
                    )}
                  </td>
                </tr>
              ))}
              {(data?.codes || []).length === 0 && <tr><td colSpan={5} className="py-3 text-slate-400">مفيش أكواد لسه.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <div className={card}>
        <h4 className="font-black text-slate-900 text-sm mb-1">💵 تسجيل دفع طالب</h4>
        <p className="text-[11px] text-slate-500 mb-3">لما الطالب يدفعلك (نقدي أو إنستاباي أو فودافون كاش) سجل هنا، والحصة بتتفتح له فوراً. المبلغ بياخده السيرفر من السعر المسجل.</p>
        <div className="flex flex-wrap items-center gap-2">
          <select value={payStudent} onChange={(e) => setPayStudent(e.target.value)} className={`${input} min-w-[160px]`}>
            <option value="">-- الطالب --</option>
            {students.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
          </select>
          <select value={payKind} onChange={(e) => { setPayKind(e.target.value as typeof payKind); setPayTarget(''); }} className={input}>
            <option value="lesson">حصة</option>
            <option value="bundle">باقة</option>
            <option value="subscription">اشتراك شهري</option>
          </select>
          {payKind === 'lesson' && (
            <select value={payTarget} onChange={(e) => setPayTarget(e.target.value)} className={`${input} min-w-[180px]`}>
              <option value="">-- الحصة --</option>
              {lessons.filter((l) => l.price && Number(l.price) > 0).map((l) => <option key={l.id} value={l.id}>حصة {l.session_number}: {l.title} ({Number(l.price)} ج.م)</option>)}
            </select>
          )}
          {payKind === 'bundle' && (
            <select value={payTarget} onChange={(e) => setPayTarget(e.target.value)} className={`${input} min-w-[180px]`}>
              <option value="">-- الباقة --</option>
              {bundles.map((b) => <option key={b.id} value={b.id}>{b.name} ({Number(b.price)} ج.م)</option>)}
            </select>
          )}
          <select value={payMethod} onChange={(e) => setPayMethod(e.target.value)} className={input}>
            <option value="cash">نقدي</option>
            <option value="instapay">إنستاباي</option>
            <option value="vodafone_cash">فودافون كاش</option>
            <option value="bank_transfer">تحويل بنكي</option>
            <option value="other">أخرى</option>
          </select>
          <button
            type="button"
            disabled={busy || !payStudent || (payKind !== 'subscription' && !payTarget)}
            className={btn}
            onClick={() => run(() => recordPayment(teacher.id, payStudent, payKind, payKind === 'subscription' ? groupId : payTarget, payMethod), () => setPayTarget(''))}
          >
            تسجيل الدفع
          </button>
        </div>
        {(!payStudent || (payKind !== 'subscription' && !payTarget)) && (
          <p className="mt-2 text-[11px] text-slate-400">
            {!payStudent
              ? 'اختار الطالب من القايمة الأول عشان الزرار يشتغل. لو مفيش طلاب، لسه محدش اتسجل في المجموعة دي.'
              : 'اختار الحصة أو الباقة اللي دفع عليها عشان الزرار يشتغل. لو القايمة فاضية، سعّر الحصة الأول من فوق.'}
          </p>
        )}
        <Banner msg={msg} />

        <div className="mt-4 overflow-x-auto max-h-60 overflow-y-auto">
          <table className="w-full text-right text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 font-bold">
                <th className="pb-2">الطالب</th><th className="pb-2">النوع</th><th className="pb-2">التفاصيل</th><th className="pb-2">المبلغ</th><th className="pb-2">التاريخ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(data?.payments || []).map((p) => (
                <tr key={p.id}>
                  <td className="py-2 font-bold text-slate-900">{studentName(p.student_id)}</td>
                  <td className="py-2">{KIND_LABEL[p.kind]}</td>
                  <td className="py-2 text-slate-600">{p.kind === 'lesson' ? lessonLabel(p.session_id) : p.kind === 'subscription' ? `شهر ${p.period}` : bundles.find((b) => b.id === p.bundle_id)?.name || 'باقة'}</td>
                  <td className="py-2 font-bold text-emerald-700">{Number(p.amount)} ج.م</td>
                  <td className="py-2 text-slate-500">{new Date(p.created_at).toLocaleDateString('ar-EG')}</td>
                </tr>
              ))}
              {(data?.payments || []).length === 0 && <tr><td colSpan={5} className="py-3 text-slate-400">مفيش مدفوعات مسجلة.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
