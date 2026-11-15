import React, { useState, useEffect } from 'react';
import {
  Users,
  Award,
  CalendarCheck,
  CreditCard,
  MessageSquare,
  LifeBuoy,
  CheckCircle,
  AlertCircle,
  FileText,
  Clock,
  Phone,
  Mail,
  Plus,
  Sparkles,
} from 'lucide-react';
import { Profile } from '../../types/database';
import { db } from '../../services/mockDatabase';

interface ParentPortalProps {
  currentParent: Profile;
}

export const ParentPortal: React.FC<ParentPortalProps> = ({ currentParent }) => {
  const [, setTick] = useState(0);

  // Subscribe to real-time database changes
  useEffect(() => {
    const unsub = db.subscribe(() => {
      setTick((t) => t + 1);
    });
    return unsub;
  }, []);

  // Find linked children
  const linkedStudentIds = [
    ...db.state.parentLinks
      .filter((l) => l.parent_id === currentParent.id && l.status === 'approved')
      .map((l) => l.student_id),
    ...db.state.profiles
      .filter((p) => p.role === 'student' && p.parent_id === currentParent.id)
      .map((p) => p.id),
  ];

  let children = db.getStudents().filter((s) => linkedStudentIds.includes(s.id));

  // If newly created parent ID was derived from a student ID
  if (children.length === 0 && currentParent.id.startsWith('par-')) {
    const inferredStudentId = currentParent.id.replace('par-', 'stu-');
    const matched = db.getStudents().find((s) => s.id === inferredStudentId);
    if (matched) {
      children = [matched];
    }
  }

  const [selectedChildId, setSelectedChildId] = useState(children[0]?.id || '');

  useEffect(() => {
    if (children.length > 0 && (!selectedChildId || !children.some((c) => c.id === selectedChildId))) {
      setSelectedChildId(children[0].id);
    }
  }, [children, selectedChildId]);

  const activeChild = children.find((c) => c.id === selectedChildId) || children[0];

  const [activeTab, setActiveTab] = useState<'exams' | 'attendance' | 'payments' | 'notes' | 'complaints'>('exams');

  // Quick link modal state
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [linkQuery, setLinkQuery] = useState('');
  const [linkMsg, setLinkMsg] = useState<{ text: string; isError: boolean } | null>(null);

  const handleLinkStudent = (e: React.FormEvent) => {
    e.preventDefault();
    const query = linkQuery.trim().toLowerCase();
    if (!query) return;

    const student = db.getStudents().find(
      (s) =>
        (s.phone && s.phone.trim() === query) ||
        s.id.toLowerCase() === query ||
        s.email.toLowerCase() === query ||
        s.full_name.toLowerCase().includes(query)
    );

    if (!student) {
      setLinkMsg({ text: 'لم يتم العثور على طالب بهذا الرقم أو الكود. تأكد من إدخال رقم هاتف الطالب المسجل.', isError: true });
      return;
    }

    // Link student to this parent
    const existing = db.state.parentLinks.find(
      (l) => l.parent_id === currentParent.id && l.student_id === student.id
    );
    if (!existing) {
      db.state.parentLinks.unshift({
        id: 'pl-' + Date.now(),
        parent_id: currentParent.id,
        student_id: student.id,
        status: 'approved',
        created_at: new Date().toISOString(),
      });
      student.parent_id = currentParent.id;
      db.persist();
    }

    setSelectedChildId(student.id);
    setLinkMsg({ text: `تم ربط حساب الطالب (${student.full_name}) بنجاح!`, isError: false });
    setLinkQuery('');
    setTimeout(() => {
      setLinkMsg(null);
      setShowLinkInput(false);
    }, 2000);
  };

  // Child data
  const childAttempts = db.getExamAttempts(activeChild?.id);
  const childAttendance = db.getAttendance(undefined, activeChild?.id);
  const childPayments = db.getStudentPayments(activeChild?.id);
  const childNotes = db.getStudentNotes(activeChild?.id);
  const parentComplaints = db.getComplaints(currentParent.id);

  // Performance calculations
  const totalScore = childAttempts.reduce((acc, a) => acc + a.score, 0);
  const maxScore = childAttempts.reduce((acc, a) => acc + a.total_score, 0);
  const avgExamPct = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 100;

  const presentCount = childAttendance.filter((a) => a.status === 'present').length;
  const lateCount = childAttendance.filter((a) => a.status === 'late').length;
  const attRate = childAttendance.length > 0 ? Math.round(((presentCount + lateCount) / childAttendance.length) * 100) : 100;

  const pendingPaymentsAmount = childPayments
    .filter((p) => p.status === 'unpaid' || p.status === 'partially_paid' || p.status === 'overdue')
    .reduce((acc, p) => acc + (p.remaining_amount ?? p.amount), 0);

  // Complaint Form
  const [subject, setSubject] = useState('');
  const [desc, setDesc] = useState('');
  const [complaintSuccess, setComplaintSuccess] = useState('');

  const handleSubmitComplaint = (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !desc.trim()) return;

    db.submitComplaint({
      submitted_by: currentParent.id,
      subject,
      description: desc,
      category: 'استفسار ومتابعة ولي أمر',
      priority: 'normal',
    });

    setComplaintSuccess('تم إرسال طلبكم لإدارة المنظومة بنجاح وسيتم التواصل معكم. 📩');
    setSubject('');
    setDesc('');
    setTimeout(() => setComplaintSuccess(''), 4000);
  };

  if (!activeChild) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center space-y-6" dir="rtl">
        <div className="w-20 h-20 rounded-3xl bg-amber-50 text-amber-600 border-2 border-amber-200 flex items-center justify-center text-4xl mx-auto shadow-md">
          👨‍👩‍👧‍👦
        </div>
        <div className="space-y-2">
          <h3 className="text-xl font-black text-slate-900">
            مرحباً بك يا {currentParent.full_name} في بوابة أولياء الأمور
          </h3>
          <p className="text-sm text-slate-500 max-w-md mx-auto leading-relaxed">
            لم يتم ربط حساب ابنك بعد. أدخل رقم هاتف الطالب المسجل في المنصة أو كوده لمتابعة درجاته وحضوره فوراً:
          </p>
        </div>
        <form onSubmit={handleLinkStudent} className="bg-white border-2 border-slate-200 rounded-3xl p-6 sm:p-8 shadow-sm space-y-4 text-right">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              رقم هاتف الطالب أو الكود الأكاديمي:
            </label>
            <input
              type="text"
              required
              value={linkQuery}
              onChange={(e) => setLinkQuery(e.target.value)}
              placeholder="مثال: 010XXXXXXXX"
              className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
          {linkMsg && (
            <div className={`p-3 rounded-xl text-xs font-bold ${linkMsg.isError ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
              {linkMsg.text}
            </div>
          )}
          <button
            type="submit"
            className="w-full py-3.5 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white rounded-xl text-sm font-bold shadow-md shadow-amber-600/20 transition-all cursor-pointer"
          >
            ربط حساب الطالب ومتابعة نتائجه ➔
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      {/* Parent Header */}
      <div className="bg-white border-2 border-slate-200 rounded-3xl p-5 sm:p-6 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-50 to-amber-100 text-amber-700 border-2 border-amber-200 flex items-center justify-center text-3xl shadow-sm shrink-0">
            {currentParent.avatar || '👨‍💼'}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg sm:text-xl font-black text-slate-900">
                {currentParent.full_name}
              </h2>
              <span className="bg-amber-50 text-amber-800 border border-amber-200 text-xs font-bold px-2.5 py-0.5 rounded-full">
                بوابة ولي الأمر المعتمدة
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              متابعة المستوى الأكاديمي، الحضور والغياب، المصروفات، وملاحظات المعلمين
            </p>
          </div>
        </div>

        {/* Children Switcher & Link Button */}
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {children.length > 1 && (
            <div className="flex items-center gap-1.5 bg-slate-50 p-1 rounded-2xl border border-slate-200">
              <span className="text-xs font-bold text-slate-500 px-2 shrink-0">الأبناء:</span>
              <div className="flex gap-1">
                {children.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setSelectedChildId(c.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      c.id === selectedChildId
                        ? 'bg-amber-600 text-white shadow-xs'
                        : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                    }`}
                  >
                    {c.full_name.split(' ')[0]}
                  </button>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={() => setShowLinkInput(!showLinkInput)}
            className="px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all flex items-center gap-1.5 border border-slate-300 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>ربط ابن آخر</span>
          </button>
        </div>
      </div>

      {/* Quick Link Student Drawer/Form */}
      {showLinkInput && (
        <div className="bg-amber-50/70 border-2 border-amber-200 rounded-2xl p-4 animate-in fade-in">
          <form onSubmit={handleLinkStudent} className="flex flex-col sm:flex-row items-center gap-3">
            <div className="flex-1 w-full">
              <label className="block text-xs font-bold text-amber-900 mb-1">
                أدخل رقم هاتف الطالب أو كوده الأكاديمي لربطه بحسابك فوراً:
              </label>
              <input
                type="text"
                value={linkQuery}
                onChange={(e) => setLinkQuery(e.target.value)}
                placeholder="مثال: 01012345678 أو كود الطالب"
                className="w-full px-3.5 py-2 rounded-xl bg-white border border-amber-300 text-slate-900 text-xs sm:text-sm font-mono focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto pt-2 sm:pt-5">
              <button
                type="submit"
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer whitespace-nowrap"
              >
                ربط الحساب
              </button>
              <button
                type="button"
                onClick={() => setShowLinkInput(false)}
                className="px-3 py-2 bg-white text-slate-600 rounded-xl text-xs font-bold border border-slate-200 hover:bg-slate-100 transition-all cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </form>
          {linkMsg && (
            <p className={`text-xs font-bold mt-2 ${linkMsg.isError ? 'text-rose-600' : 'text-emerald-700'}`}>
              {linkMsg.text}
            </p>
          )}
        </div>
      )}

      {/* Selected Child KPI Banner */}
      <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-white rounded-3xl p-6 sm:p-7 shadow-xl border border-slate-800 relative overflow-hidden">
        {/* Glow Effects */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="flex items-center gap-4 sm:gap-5">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white/10 border-2 border-white/20 backdrop-blur-md flex items-center justify-center text-4xl shadow-lg shrink-0">
              {activeChild.avatar || '👨‍🎓'}
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-xl sm:text-2xl font-black text-white">
                  {activeChild.full_name}
                </h2>
                <span className="bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 font-mono text-xs px-2.5 py-0.5 rounded-md font-bold">
                  كود: #{activeChild.id}
                </span>
                <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-xs font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>طالب منتظم</span>
                </span>
              </div>

              <div className="text-xs sm:text-sm text-slate-300 mt-2 flex items-center gap-3 flex-wrap">
                <span className="font-bold text-white bg-white/10 px-2.5 py-0.5 rounded-lg border border-white/10">
                  {activeChild.grade_level}
                </span>
                <span>•</span>
                <span className="bg-amber-500/20 text-amber-300 border border-amber-400/30 px-3 py-0.5 rounded-lg font-bold text-xs flex items-center gap-1.5">
                  <span>👨‍🏫 المعلم المشرف:</span>
                  <strong className="text-white">
                    {activeChild.teacher_name || (activeChild.teacher_id === 'tea-2' ? 'د. مروة محمود (رياضيات)' : 'أ. أحمد رضوان (علوم)')}
                  </strong>
                </span>
                <span>•</span>
                <span className="text-slate-300">
                  📱 هاتف الطالب: <strong className="text-white font-mono">{activeChild.phone || 'مسجل'}</strong>
                </span>
              </div>
            </div>
          </div>

          {/* 4 Stat KPI Widgets */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full lg:w-auto">
            <div className="bg-white/5 hover:bg-white/10 backdrop-blur-md rounded-2xl p-3.5 text-center border border-white/10 transition-all">
              <span className="text-[11px] text-slate-300 block mb-1">نسبة الحضور</span>
              <span className="text-xl font-black text-emerald-400">{attRate}%</span>
              <span className="text-[10px] text-slate-400 block mt-0.5">التزام تام</span>
            </div>

            <div className="bg-white/5 hover:bg-white/10 backdrop-blur-md rounded-2xl p-3.5 text-center border border-white/10 transition-all">
              <span className="text-[11px] text-slate-300 block mb-1">متوسط الامتحانات</span>
              <span className="text-xl font-black text-blue-400">{avgExamPct}%</span>
              <span className="text-[10px] text-slate-400 block mt-0.5">معدل تراكمي</span>
            </div>

            <div className="bg-white/5 hover:bg-white/10 backdrop-blur-md rounded-2xl p-3.5 text-center border border-white/10 transition-all">
              <span className="text-[11px] text-slate-300 block mb-1">الاختبارات المنجزة</span>
              <span className="text-xl font-black text-white">{childAttempts.length}</span>
              <span className="text-[10px] text-slate-400 block mt-0.5">اختبارات وكويزات</span>
            </div>

            <div className="bg-white/5 hover:bg-white/10 backdrop-blur-md rounded-2xl p-3.5 text-center border border-white/10 transition-all">
              <span className="text-[11px] text-slate-300 block mb-1">المستحقات المعلقة</span>
              <span className={`text-xl font-black ${pendingPaymentsAmount > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                {pendingPaymentsAmount > 0 ? `${pendingPaymentsAmount} EGP` : '0 EGP'}
              </span>
              <span className="text-[10px] text-slate-400 block mt-0.5">
                {pendingPaymentsAmount > 0 ? 'مستحق السداد' : 'مسدد بالكامل ✓'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        {[
          { id: 'exams', label: '📈 نتائج الامتحانات', icon: Award },
          { id: 'attendance', label: '📅 سجل الحضور والغياب', icon: CalendarCheck },
          { id: 'payments', label: '💳 المصروفات والمدفوعات', icon: CreditCard },
          { id: 'notes', label: '📝 ملاحظات المعلمين', icon: FileText },
          { id: 'complaints', label: '📩 التواصل مع الإدارة', icon: LifeBuoy },
        ].map((tab) => {
          const TabIcon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm whitespace-nowrap flex items-center gap-2 transition-all cursor-pointer ${
                isActive
                  ? 'bg-amber-600 text-white shadow-md shadow-amber-600/20'
                  : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              <TabIcon className="w-4 h-4 shrink-0" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: Exams */}
      {activeTab === 'exams' && (
        <div className="space-y-4">
          <div className="bg-white border-2 border-slate-200 rounded-3xl p-6 shadow-sm">
            <h3 className="text-lg font-black text-slate-900 mb-1">
              📈 نتائج وتقارير اختبارات الطالب
            </h3>
            <p className="text-xs text-slate-500 mb-6">
              سجل تفصيلي بالاختبارات والدرجات والنسب المئوية المحققة
            </p>

            {childAttempts.length === 0 ? (
              <div className="p-8 text-center bg-slate-50/80 rounded-2xl border-2 border-dashed border-slate-200">
                <Award className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <h4 className="text-base font-bold text-slate-700">لم يتم رصد نتائج اختبارات مكتملة للطالب حتى الآن</h4>
                <p className="text-xs text-slate-500 mt-1.5 max-w-md mx-auto leading-relaxed">
                  عندما يقوم الطالب بحل أي اختبار مخصص أو كويز ذكي من حسابه، سيتم حفظ درجاته وإرسال تقرير فوري لحساب ولي الأمر ليظهر هنا تلقائياً.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    if (activeChild) {
                      db.state.examAttempts.unshift({
                        id: 'att-demo-' + Date.now(),
                        exam_id: 'ex-1',
                        student_id: activeChild.id,
                        score: 3,
                        total_score: 3,
                        passed: true,
                        started_at: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
                        submitted_at: new Date().toISOString(),
                        exam_title: 'اختبار الحصة 1: التركيب الذري والمفاهيم الكيميائية',
                        subject: 'علوم وأحياء',
                      });
                      db.persist();
                    }
                  }}
                  className="mt-4 px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer inline-flex items-center gap-2"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>تسجيل نتيجة اختبار تجريبية للابن (3/3) الآن لتجربة المنظومة</span>
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {childAttempts.map((att) => {
                  const pct = Math.round((att.score / (att.total_score || 1)) * 100);
                  return (
                    <div
                      key={att.id}
                      className="p-5 rounded-2xl border-2 border-slate-200 bg-slate-50/60 flex items-center justify-between gap-4 flex-wrap"
                    >
                      <div>
                        <div className="flex items-center gap-2 text-xs font-bold mb-1">
                          <span className="bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded">
                            {att.subject || 'اختبار تقييمي'}
                          </span>
                          <span className="text-slate-400">
                            تاريخ التسليم: {new Date(att.submitted_at || att.started_at).toLocaleDateString('ar-EG')}
                          </span>
                        </div>
                        <h4 className="font-bold text-slate-900 text-base">{att.exam_title}</h4>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="text-left flex flex-col items-end">
                          <div className="flex items-baseline gap-1.5 text-slate-900">
                            <span className="text-2xl font-black text-indigo-600 font-mono">{att.score}</span>
                            <span className="text-slate-400 font-bold text-xs">من</span>
                            <span className="text-base font-bold text-slate-600 font-mono">{att.total_score}</span>
                          </div>
                          <span
                            className={`text-xs font-bold px-2.5 py-0.5 rounded-full mt-1 ${
                              att.passed
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-red-50 text-red-700 border border-red-200'
                            }`}
                          >
                            {att.passed ? `اجتياز بتفوق (${pct}%) ✓` : `يحتاج تحسين (${pct}%)`}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: Attendance */}
      {activeTab === 'attendance' && (
        <div className="bg-white border-2 border-slate-200 rounded-3xl p-6 shadow-sm">
          <h3 className="text-lg font-black text-slate-900 mb-4">
            📅 سجل حضور وغياب الابن بالحصة
          </h3>

          {childAttendance.length === 0 ? (
            <div className="p-8 text-center text-slate-500 bg-slate-50 rounded-2xl border border-dashed border-slate-300 space-y-2">
              <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center mx-auto text-xl">
                ✓
              </div>
              <h4 className="font-bold text-slate-800 text-sm">سجل الحضور منتظم</h4>
              <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                لم يتم رصد أي حالات غياب للطالب حتى الآن. عندما يقوم المعلم المشرف باعتماد كشف الحضور من لوحة تحكمه، ستظهر تفاصيل الحصة هنا فوراً.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 font-bold">
                    <th className="pb-3">الحصة</th>
                    <th className="pb-3">التاريخ</th>
                    <th className="pb-3">حالة الحضور</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {childAttendance.map((a) => (
                    <tr key={a.id} className="hover:bg-slate-50/50">
                      <td className="py-3.5 font-bold text-slate-900">{a.session_title || `حصة ${a.session_number}`}</td>
                      <td className="py-3.5 text-slate-500">
                        {new Date(a.recorded_at).toLocaleDateString('ar-EG')}
                      </td>
                      <td className="py-3.5">
                        <span
                          className={`px-3 py-1 rounded-full font-bold text-[11px] ${
                            a.status === 'present'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : a.status === 'late'
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-red-50 text-red-700 border border-red-200'
                          }`}
                        >
                          {a.status === 'present' ? 'حاضر ✓' : a.status === 'late' ? 'حاضر بتأخير' : 'غائب ✗'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: Payments */}
      {activeTab === 'payments' && (
        <div className="bg-white border-2 border-slate-200 rounded-3xl p-6 shadow-sm">
          <h3 className="text-lg font-black text-slate-900 mb-1">
            💳 المصروفات والمدفوعات للأبناء
          </h3>
          <p className="text-xs text-slate-500 mb-6">
            بيان الاشتراكات الشهرية والفواتير المستحقة والمسددة
          </p>

          {childPayments.length === 0 ? (
            <div className="p-8 text-center text-slate-500 bg-slate-50 rounded-2xl border border-dashed border-slate-300 space-y-2">
              <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center mx-auto text-xl">
                💳
              </div>
              <h4 className="font-bold text-slate-800 text-sm">لا توجد مستحقات مالية متأخرة</h4>
              <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                حساب الطالب خالٍ من أي مستحقات معلقة حالياً، ويمكن إضافة وسداد اشتراكات الحصص الشهرية بسهولة.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 font-bold">
                    <th className="pb-3">البيان</th>
                    <th className="pb-3">القيمة</th>
                    <th className="pb-3">المسدد</th>
                    <th className="pb-3">المتبقي</th>
                    <th className="pb-3">تاريخ الاستحقاق</th>
                    <th className="pb-3">الحالة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {childPayments.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50/50">
                      <td className="py-3.5 font-bold text-slate-900">{p.period_label || 'اشتراك شهري'}</td>
                      <td className="py-3.5 font-bold">{p.amount} {p.currency}</td>
                      <td className="py-3.5 text-emerald-700 font-bold">{p.paid_amount || 0} {p.currency}</td>
                      <td className="py-3.5 text-red-600 font-bold">{p.remaining_amount || 0} {p.currency}</td>
                      <td className="py-3.5 text-slate-500">{p.due_date}</td>
                      <td className="py-3.5">
                        <span
                          className={`px-2.5 py-0.5 rounded-full font-bold text-[11px] ${
                            p.status === 'paid'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : p.status === 'partially_paid'
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : 'bg-red-50 text-red-700 border border-red-200'
                          }`}
                        >
                          {p.status === 'paid' ? 'مسدد بالكامل ✓' : p.status === 'partially_paid' ? 'مسدد جزئياً' : 'مستحق السداد'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: Notes */}
      {activeTab === 'notes' && (
        <div className="bg-white border-2 border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
          <h3 className="text-lg font-black text-slate-900 mb-1">
            📝 تقارير وملاحظات المعلم الدورية
          </h3>
          <p className="text-xs text-slate-500 mb-4">
            تقييمات المستوى والتفاعل داخل الحصة
          </p>

          {childNotes.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400 bg-slate-50 rounded-2xl">
              لا توجد ملاحظات مسجلة حتى الآن.
            </div>
          ) : (
            <div className="space-y-3">
              {childNotes.map((n) => (
                <div key={n.id} className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-1.5">
                  <div className="flex justify-between items-center text-xs text-slate-500">
                    <span className="font-bold text-slate-800">✍️ {n.teacher_name || 'معلم المادة'}</span>
                    <span>{new Date(n.created_at).toLocaleDateString('ar-EG')}</span>
                  </div>
                  <p className="text-sm text-slate-700 leading-relaxed font-medium">"{n.note}"</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 5: Complaints */}
      {activeTab === 'complaints' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white border-2 border-slate-200 rounded-3xl p-6 shadow-sm">
              <h3 className="text-lg font-black text-slate-900 mb-1">
                📬 تذاكر واستفسارات ولي الأمر
              </h3>
              <p className="text-xs text-slate-500 mb-6">
                سجل المراسلات والردود الرسمية من إدارة EduFlow
              </p>

              <div className="space-y-4">
                {parentComplaints.map((c) => (
                  <div key={c.id} className="p-4 rounded-2xl border-2 border-slate-200 bg-slate-50/50 space-y-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className="bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded font-bold">
                        {c.category}
                      </span>
                      <span
                        className={`px-2.5 py-0.5 rounded-full font-bold ${
                          c.status === 'resolved'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}
                      >
                        {c.status === 'resolved' ? 'تم الرد والحل ✓' : 'قيد المتابعة'}
                      </span>
                    </div>

                    <h4 className="font-bold text-slate-900 text-sm">{c.subject}</h4>
                    <p className="text-xs text-slate-600 leading-relaxed">{c.description}</p>

                    {c.admin_response && (
                      <div className="p-3 bg-white border border-emerald-200 rounded-xl text-xs space-y-1">
                        <strong className="text-emerald-800">رد الإدارة:</strong>
                        <p className="text-slate-700">{c.admin_response}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Form */}
          <div className="bg-white border-2 border-slate-200 rounded-3xl p-6 shadow-sm h-fit">
            <h4 className="font-black text-slate-900 text-base mb-1">
              📩 إرسال استفسار أو طلب
            </h4>
            <p className="text-xs text-slate-500 mb-4">
              يصل مباشرة للإدارة لمتابعته
            </p>

            {complaintSuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold rounded-xl mb-4">
                {complaintSuccess}
              </div>
            )}

            <form onSubmit={handleSubmitComplaint} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">موضوع الطلب:</label>
                <input
                  type="text"
                  required
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="عنوان مختصر..."
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">تفاصيل الرسالة:</label>
                <textarea
                  required
                  rows={4}
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                  placeholder="اكتب استفسارك أو ملاحظتك للإدارة..."
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold resize-y"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                إرسال الطلب الآن
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
