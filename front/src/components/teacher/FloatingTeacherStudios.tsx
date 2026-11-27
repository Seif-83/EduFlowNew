import React, { useState } from 'react';
import {
  BookOpen,
  HelpCircle,
  Plus,
  X,
  Sparkles,
  Video,
  FileText,
  Clock,
  Trash2,
  CheckCircle,
  AlertCircle,
  Minimize2,
  ExternalLink,
} from 'lucide-react';
import { Profile, CourseGroup, Session, Exam } from '../../types/database';
import { db } from '../../services/mockDatabase';

interface FloatingTeacherStudiosProps {
  currentTeacher: Profile;
  selectedGroupId: string;
  groups: CourseGroup[];
  onSessionCreated?: () => void;
  onExamCreated?: () => void;
}

export const FloatingTeacherStudios: React.FC<FloatingTeacherStudiosProps> = ({
  currentTeacher,
  selectedGroupId,
  groups,
  onSessionCreated,
  onExamCreated,
}) => {
  const [isSessionStudioOpen, setIsSessionStudioOpen] = useState(false);
  const [isExamStudioOpen, setIsExamStudioOpen] = useState(false);

  // Active group
  const currentGroup = groups.find((g) => g.id === selectedGroupId) || groups[0];
  const sessions = db.getSessions(selectedGroupId);
  const exams = db.getExams();

  // Session Studio Form State
  const [sessionActiveTab, setSessionActiveTab] = useState<'create' | 'list'>('create');
  const [sessionTitle, setSessionTitle] = useState('');
  const [sessionDesc, setSessionDesc] = useState('');
  const [sessionNumber, setSessionNumber] = useState(sessions.length + 1);
  const [sessionVideoUrl, setSessionVideoUrl] = useState('');
  const [sessionSuccessMsg, setSessionSuccessMsg] = useState('');

  // Exam Studio Form State
  const [examActiveTab, setExamActiveTab] = useState<'create' | 'bank'>('create');
  const [examMode, setExamMode] = useState<'ai' | 'manual' | 'upload'>('ai');
  const [examCurriculum, setExamCurriculum] = useState<'languages' | 'arabic'>('languages');
  const [examTitle, setExamTitle] = useState('');
  const [examDuration, setExamDuration] = useState(15);
  const [examPassing, setExamPassing] = useState(70);
  const [examSubject, setExamSubject] = useState('العلوم والفيزياء (Sciences)');
  const [examTopicPrompt, setExamTopicPrompt] = useState('التركيب الذري والجدول الدوري الحديث');
  const [manualQText, setManualQText] = useState('');
  const [manualOptA, setManualOptA] = useState('');
  const [manualOptB, setManualOptB] = useState('');
  const [manualOptC, setManualOptC] = useState('');
  const [manualOptD, setManualOptD] = useState('');
  const [manualCorrect, setManualCorrect] = useState('');
  const [manualExpl, setManualExpl] = useState('');
  const [examPdfUrl, setExamPdfUrl] = useState('');
  const [examSuccessMsg, setExamSuccessMsg] = useState('');

  // Create Session Handler
  const handleAddSession = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionTitle.trim()) return;

    db.addSession({
      group_id: selectedGroupId,
      title: sessionTitle.trim(),
      description: sessionDesc.trim() || 'شرح تفاعلي لموضوع الحصة وأهم النقاط الأساسية.',
      session_number: Number(sessionNumber),
      video_url:
        sessionVideoUrl.trim() ||
        'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      materials_url: 'https://example.com/materials.pdf',
      is_published: true,
    });

    setSessionSuccessMsg(`تم نشر الحصة "${sessionTitle}" بنجاح وإتاحتها لطلاب المجموعة! 🚀`);
    setSessionTitle('');
    setSessionDesc('');
    setSessionVideoUrl('');
    setSessionNumber(db.getSessions(selectedGroupId).length + 1);
    setSessionActiveTab('list');
    onSessionCreated?.();
    setTimeout(() => setSessionSuccessMsg(''), 4500);
  };

  // Create Exam Handler
  const handleAddExam = (e: React.FormEvent) => {
    e.preventDefault();
    if (!examTitle.trim()) return;

    let questionsPayload = [
      {
        question_text: `ما هو المفهوم العلمي الجوهري المرتبط بـ "${examTitle}"؟`,
        question_type: 'mcq' as const,
        options: ['قانون حفظ الطاقة والمادة', 'التفاعل العشوائي غير المتزن', 'الحالة الانتقالية المتغيرة', 'لا توجد إجابة صحيحة'],
        correct_answer: 'قانون حفظ الطاقة والمادة',
        points: 1,
        explanation: 'ينص القانون على أن المادة والطاقة لا تفنيان ولا تستحدثان من عدم بل تتحولان من صورة لأخرى.',
      },
      {
        question_text: 'تتطابق النتائج العملية للتجربة مع الفرضيات الرياضية عند ثبات المتغيرات الحاكمة.',
        question_type: 'true_false' as const,
        options: ['True (صواب)', 'False (خطأ)'],
        correct_answer: 'True (صواب)',
        points: 1,
        explanation: 'تثبيت العوامل التجريبية يضمن دقة القياس وقابلية تكرار التجربة علمياً.',
      },
      {
        question_text: 'أي الكميات الفيزيائية التالية تمثل المعدل الزمني للتغير في الإزاحة؟',
        question_type: 'mcq' as const,
        options: ['السرعة المتجهة (Velocity)', 'الكتلة (Mass)', 'الحجم (Volume)', 'الشحنة الكهربية (Charge)'],
        correct_answer: 'السرعة المتجهة (Velocity)',
        points: 1,
        explanation: 'تُعرَّف السرعة المتجهة بأنها المشتقة الزمنية الأولى للإزاحة.',
      },
    ];

    if (examMode === 'manual' && manualQText.trim()) {
      questionsPayload = [
        {
          question_text: manualQText.trim(),
          question_type: 'mcq' as const,
          options: [
            manualOptA.trim() || 'الاختيار أ',
            manualOptB.trim() || 'الاختيار ب',
            manualOptC.trim() || 'الاختيار ج',
            manualOptD.trim() || 'الاختيار د',
          ],
          correct_answer: manualCorrect.trim() || manualOptA.trim() || 'الاختيار أ',
          points: 1,
          explanation: manualExpl.trim() || 'نموذج الإجابة المعتمد في الاختبار.',
        },
      ];
    }

    const created = db.createExamWithQuestions({
      session_id: sessions[0]?.id || '',
      title: examTitle.trim(),
      duration_minutes: Number(examDuration),
      passing_score: Number(examPassing),
      subject: examSubject,
      creator_role: 'teacher',
      creation_mode:
        examMode === 'ai'
          ? 'ai_generated'
          : examMode === 'manual'
          ? 'manual'
          : 'material_upload',
      curriculum_type: examCurriculum,
      material_url: examPdfUrl.trim() || undefined,
      grade_level: 'الصف الثاني الإعدادي',
      questions: questionsPayload,
    });

    setExamSuccessMsg(`تم نشر الاختبار "${created.title}" وإضافته لبنك الأسئلة! 🎯`);
    setExamTitle('');
    setManualQText('');
    setManualOptA('');
    setManualOptB('');
    setManualOptC('');
    setManualOptD('');
    setManualCorrect('');
    setManualExpl('');
    setExamActiveTab('bank');
    onExamCreated?.();
    setTimeout(() => setExamSuccessMsg(''), 4500);
  };

  return (
    <>
      {/* ======================================================== */}
      {/* 1. FLOATING SESSION STUDIO MODAL / DRAWER                */}
      {/* ======================================================== */}
      {isSessionStudioOpen && (
        <div
          className="fixed bottom-24 right-4 sm:right-6 z-50 w-[calc(100vw-2rem)] sm:w-[580px] max-h-[82vh] bg-white/95 backdrop-blur-xl border-2 border-teal-200/90 rounded-3xl shadow-2xl shadow-teal-950/20 flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-8 zoom-in-95 duration-250 ease-out"
          dir="rtl"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-teal-700 via-emerald-700 to-cyan-700 text-white p-4 flex items-center justify-between shrink-0 shadow-md">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-white/15 border border-white/20 backdrop-blur-md flex items-center justify-center text-xl shadow-inner">
                📚
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-black text-sm text-white">استوديو إدارة الحصص والمحتوى</h3>
                  <span className="bg-teal-400/20 text-teal-200 border border-teal-400/30 text-[10px] font-bold px-2 py-0.5 rounded-full">
                    {currentGroup?.name}
                  </span>
                </div>
                <p className="text-[11px] text-teal-100 opacity-90 mt-0.5">
                  رفع المحاضرات المرئية، المذكرات، وضبط تسلسل الحصص
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setIsSessionStudioOpen(false)}
                className="p-1.5 rounded-xl hover:bg-white/15 text-teal-100 hover:text-white transition-colors cursor-pointer"
                title="تصغير"
              >
                <Minimize2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setIsSessionStudioOpen(false)}
                className="p-1.5 rounded-xl hover:bg-rose-500/30 text-teal-100 hover:text-white transition-colors cursor-pointer"
                title="إغلاق"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Subheader Tabs */}
          <div className="bg-teal-50/70 border-b border-teal-100 p-2 flex items-center gap-2 shrink-0">
            <button
              onClick={() => setSessionActiveTab('create')}
              className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                sessionActiveTab === 'create'
                  ? 'bg-teal-600 text-white shadow-xs'
                  : 'bg-white text-teal-800 hover:bg-teal-100/60 border border-teal-200/60'
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>➕ نشر حصة جديدة</span>
            </button>
            <button
              onClick={() => setSessionActiveTab('list')}
              className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                sessionActiveTab === 'list'
                  ? 'bg-teal-600 text-white shadow-xs'
                  : 'bg-white text-teal-800 hover:bg-teal-100/60 border border-teal-200/60'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>📋 الحصص المنشورة ({sessions.length})</span>
            </button>
          </div>

          {/* Body Content */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
            {sessionSuccessMsg && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold rounded-2xl flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{sessionSuccessMsg}</span>
              </div>
            )}

            {sessionActiveTab === 'create' ? (
              <form onSubmit={handleAddSession} className="space-y-3.5 text-right">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">عنوان الحصة الدراسية:</label>
                  <input
                    required
                    type="text"
                    value={sessionTitle}
                    onChange={(e) => setSessionTitle(e.target.value)}
                    placeholder="مثال: الحصة 1: مدخل إلى التركيب الذري والجدول الدوري..."
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold focus:bg-white focus:border-teal-600 outline-hidden"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">رقم الحصة في الترتيب:</label>
                    <input
                      type="number"
                      min={1}
                      value={sessionNumber}
                      onChange={(e) => setSessionNumber(Number(e.target.value))}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold focus:bg-white focus:border-teal-600 outline-hidden"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">المجموعة المستهدفة:</label>
                    <input
                      disabled
                      type="text"
                      value={currentGroup?.name || ''}
                      className="w-full p-2.5 bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-600"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">رابط الفيديو أو المحاضرة المسجلة:</label>
                  <input
                    type="url"
                    value={sessionVideoUrl}
                    onChange={(e) => setSessionVideoUrl(e.target.value)}
                    placeholder="https://... (رابط الفيديو على Google Drive أو YouTube أو السيرفر)"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:border-teal-600 outline-hidden"
                  />
                  <p className="text-[11px] text-slate-400">إذا تُرك فارغاً سيتم استخدام فيديو تعليمي تجريبي تلقائياً.</p>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">ملخص وملاحظات الحصة للطلاب:</label>
                  <textarea
                    rows={2}
                    value={sessionDesc}
                    onChange={(e) => setSessionDesc(e.target.value)}
                    placeholder="اكتب النقاط الأساسية التي ستتم مناقشتها مع الطلاب في هذه الحصة..."
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:border-teal-600 outline-hidden resize-none"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-3 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs sm:text-sm transition-all shadow-md shadow-teal-600/20 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>اعتماد ونشر الحصة فوراً 🚀</span>
                </button>
              </form>
            ) : (
              <div className="space-y-2.5">
                {sessions.length === 0 ? (
                  <div className="text-center py-8 px-4 rounded-2xl border-2 border-dashed border-teal-200 bg-teal-50/40">
                    <p className="text-xs font-bold text-slate-600">لا توجد حصص منشورة بعد لهذه المجموعة</p>
                    <button
                      onClick={() => setSessionActiveTab('create')}
                      className="mt-3 px-3 py-1.5 bg-teal-600 text-white text-xs font-bold rounded-xl"
                    >
                      أضف الحصة الأولى الآن
                    </button>
                  </div>
                ) : (
                  sessions.map((s) => (
                    <div
                      key={s.id}
                      className="p-3.5 rounded-2xl border border-slate-200 bg-white hover:border-teal-300 transition-all flex items-center justify-between gap-3 text-right"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-teal-50 text-teal-700 font-black text-xs flex items-center justify-center shrink-0">
                          #{s.session_number}
                        </div>
                        <div>
                          <h4 className="text-xs sm:text-sm font-bold text-slate-900">{s.title}</h4>
                          <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">{s.description}</p>
                        </div>
                      </div>
                      <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold px-2 py-0.5 rounded-md shrink-0">
                        منشورة 🟢
                      </span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 2. FLOATING EXAM STUDIO MODAL / DRAWER                   */}
      {/* ======================================================== */}
      {isExamStudioOpen && (
        <div
          className="fixed bottom-24 right-4 sm:right-6 z-50 w-[calc(100vw-2rem)] sm:w-[600px] max-h-[85vh] bg-white/95 backdrop-blur-xl border-2 border-purple-200/90 rounded-3xl shadow-2xl shadow-purple-950/20 flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-8 zoom-in-95 duration-250 ease-out"
          dir="rtl"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-purple-700 via-indigo-700 to-violet-700 text-white p-4 flex items-center justify-between shrink-0 shadow-md">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-white/15 border border-white/20 backdrop-blur-md flex items-center justify-center text-xl shadow-inner">
                ❓
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-black text-sm text-white">استوديو بنك الأسئلة والامتحانات</h3>
                  <span className="bg-purple-400/20 text-purple-200 border border-purple-400/30 text-[10px] font-bold px-2 py-0.5 rounded-full">
                    معلم معتمد
                  </span>
                </div>
                <p className="text-[11px] text-purple-100 opacity-90 mt-0.5">
                  توليد ذكي بـ Gemini، بنك الأسئلة الشامل، واختبارات تفاعلية
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setIsExamStudioOpen(false)}
                className="p-1.5 rounded-xl hover:bg-white/15 text-purple-100 hover:text-white transition-colors cursor-pointer"
                title="تصغير"
              >
                <Minimize2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setIsExamStudioOpen(false)}
                className="p-1.5 rounded-xl hover:bg-rose-500/30 text-purple-100 hover:text-white transition-colors cursor-pointer"
                title="إغلاق"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Subheader Tabs */}
          <div className="bg-purple-50/70 border-b border-purple-100 p-2 flex items-center gap-2 shrink-0">
            <button
              onClick={() => setExamActiveTab('create')}
              className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                examActiveTab === 'create'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'bg-white text-purple-800 hover:bg-purple-100/60 border border-purple-200/60'
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>➕ إنشاء اختبار جديد</span>
            </button>
            <button
              onClick={() => setExamActiveTab('bank')}
              className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                examActiveTab === 'bank'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'bg-white text-purple-800 hover:bg-purple-100/60 border border-purple-200/60'
              }`}
            >
              <HelpCircle className="w-3.5 h-3.5" />
              <span>📚 بنك الامتحانات ({exams.length})</span>
            </button>
          </div>

          {/* Body Content */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
            {examSuccessMsg && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold rounded-2xl flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{examSuccessMsg}</span>
              </div>
            )}

            {examActiveTab === 'create' ? (
              <form onSubmit={handleAddExam} className="space-y-3.5 text-right">
                {/* Mode Selector */}
                <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 rounded-2xl text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => setExamMode('ai')}
                    className={`py-2 px-2 rounded-xl transition-all flex items-center justify-center gap-1 cursor-pointer ${
                      examMode === 'ai'
                        ? 'bg-purple-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                    <span>توليد ذكي (AI)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setExamMode('manual')}
                    className={`py-2 px-2 rounded-xl transition-all flex items-center justify-center gap-1 cursor-pointer ${
                      examMode === 'manual'
                        ? 'bg-purple-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <span>✍️ يدوي (Manual)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setExamMode('upload')}
                    className={`py-2 px-2 rounded-xl transition-all flex items-center justify-center gap-1 cursor-pointer ${
                      examMode === 'upload'
                        ? 'bg-purple-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <span>📄 شيت (PDF)</span>
                  </button>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">عنوان الاختبار:</label>
                  <input
                    required
                    type="text"
                    value={examTitle}
                    onChange={(e) => setExamTitle(e.target.value)}
                    placeholder="مثال: Quiz 1: Periodic Table & Chemical Bonding"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold focus:bg-white focus:border-purple-600 outline-hidden"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">المدة بالدقائق:</label>
                    <input
                      type="number"
                      min={5}
                      value={examDuration}
                      onChange={(e) => setExamDuration(Number(e.target.value))}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold focus:bg-white focus:border-purple-600 outline-hidden"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">نسبة النجاح (%):</label>
                    <input
                      type="number"
                      min={50}
                      max={100}
                      value={examPassing}
                      onChange={(e) => setExamPassing(Number(e.target.value))}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold focus:bg-white focus:border-purple-600 outline-hidden"
                    />
                  </div>
                </div>

                {examMode === 'ai' && (
                  <div className="space-y-1 p-3 bg-purple-50/60 border border-purple-100 rounded-2xl">
                    <label className="text-xs font-bold text-purple-900 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                      <span>موجه الذكاء الاصطناعي (AI Topic Prompt):</span>
                    </label>
                    <input
                      type="text"
                      value={examTopicPrompt}
                      onChange={(e) => setExamTopicPrompt(e.target.value)}
                      placeholder="اكتب الدرس المطلوب توليد أسئلته..."
                      className="w-full p-2.5 bg-white border border-purple-200 rounded-xl text-xs font-semibold focus:border-purple-600 outline-hidden"
                    />
                  </div>
                )}

                {examMode === 'manual' && (
                  <div className="space-y-2 p-3 bg-slate-50 border border-slate-200 rounded-2xl">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-700">نص السؤال:</label>
                      <input
                        type="text"
                        value={manualQText}
                        onChange={(e) => setManualQText(e.target.value)}
                        placeholder="اكتب نص السؤال بدقة..."
                        className="w-full p-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={manualOptA}
                        onChange={(e) => setManualOptA(e.target.value)}
                        placeholder="اختيار أ"
                        className="p-2 bg-white border border-slate-200 rounded-xl text-xs"
                      />
                      <input
                        type="text"
                        value={manualOptB}
                        onChange={(e) => setManualOptB(e.target.value)}
                        placeholder="اختيار ب"
                        className="p-2 bg-white border border-slate-200 rounded-xl text-xs"
                      />
                      <input
                        type="text"
                        value={manualOptC}
                        onChange={(e) => setManualOptC(e.target.value)}
                        placeholder="اختيار ج"
                        className="p-2 bg-white border border-slate-200 rounded-xl text-xs"
                      />
                      <input
                        type="text"
                        value={manualOptD}
                        onChange={(e) => setManualOptD(e.target.value)}
                        placeholder="اختيار د"
                        className="p-2 bg-white border border-slate-200 rounded-xl text-xs"
                      />
                    </div>
                    <input
                      type="text"
                      value={manualCorrect}
                      onChange={(e) => setManualCorrect(e.target.value)}
                      placeholder="نص الإجابة الصحيحة المطابق تماماً لأحد الاختيارات"
                      className="w-full p-2 bg-emerald-50/70 border border-emerald-300 rounded-xl text-xs font-bold text-emerald-900"
                    />
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full py-3 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs sm:text-sm transition-all shadow-md shadow-purple-600/20 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>نشر الاختبار لطلاب المجموعة فوراً 🎯</span>
                </button>
              </form>
            ) : (
              <div className="space-y-2.5">
                {exams.length === 0 ? (
                  <div className="text-center py-8 px-4 rounded-2xl border-2 border-dashed border-purple-200 bg-purple-50/40">
                    <p className="text-xs font-bold text-slate-600">لا توجد اختبارات منشورة بعد</p>
                    <button
                      onClick={() => setExamActiveTab('create')}
                      className="mt-3 px-3 py-1.5 bg-purple-600 text-white text-xs font-bold rounded-xl"
                    >
                      أنشئ أول اختبار الآن
                    </button>
                  </div>
                ) : (
                  exams.map((ex) => (
                    <div
                      key={ex.id}
                      className="p-3.5 rounded-2xl border border-slate-200 bg-white hover:border-purple-300 transition-all text-right space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-900">{ex.title}</span>
                        <span className="text-[10px] bg-purple-50 text-purple-700 border border-purple-200 font-bold px-2 py-0.5 rounded-md">
                          {ex.questions?.length || 0} أسئلة
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 flex items-center gap-3">
                        <span>المدة: {ex.duration_minutes} دقيقة</span>
                        <span>•</span>
                        <span>درجة النجاح: %{ex.passing_score}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 3. THE FLOATING ACTION BUTTONS AT BOTTOM-RIGHT            */}
      {/* ======================================================== */}
      <div className="fixed bottom-6 right-6 z-40 flex items-center gap-3">
        {/* Floating Button 1: Sessions Studio (Emerald/Teal) */}
        <div className="relative group">
          <button
            onClick={() => {
              setIsSessionStudioOpen(!isSessionStudioOpen);
              if (isExamStudioOpen) setIsExamStudioOpen(false);
            }}
            className={`flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 rounded-full text-white shadow-2xl transition-all duration-300 cursor-pointer ${
              isSessionStudioOpen
                ? 'bg-slate-900 shadow-slate-900/40 rotate-90'
                : 'bg-gradient-to-tr from-emerald-600 via-teal-600 to-cyan-600 hover:scale-110 active:scale-95 shadow-teal-600/40 hover:shadow-teal-600/70'
            }`}
            title="إدارة الحصص والمحتوى"
          >
            {!isSessionStudioOpen && (
              <span className="absolute -inset-1 rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 opacity-60 blur-xs animate-pulse pointer-events-none group-hover:opacity-100 transition-opacity" />
            )}
            {isSessionStudioOpen ? (
              <X className="w-6 h-6 text-white relative z-10" />
            ) : (
              <div className="relative z-10 flex flex-col items-center justify-center">
                <BookOpen className="w-6 h-6 sm:w-7 sm:h-7 group-hover:scale-110 transition-transform" />
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-amber-400 border-2 border-emerald-600 rounded-full" />
              </div>
            )}
          </button>
          {!isSessionStudioOpen && !isExamStudioOpen && (
            <span className="absolute -top-8 right-1/2 translate-x-1/2 whitespace-nowrap bg-slate-900/90 text-white text-[10px] font-bold px-2.5 py-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-md">
              إدارة الحصص 📚
            </span>
          )}
        </div>

        {/* Floating Button 2: Exam & Question Bank Studio (Violet/Purple) */}
        <div className="relative group">
          <button
            onClick={() => {
              setIsExamStudioOpen(!isExamStudioOpen);
              if (isSessionStudioOpen) setIsSessionStudioOpen(false);
            }}
            className={`flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 rounded-full text-white shadow-2xl transition-all duration-300 cursor-pointer ${
              isExamStudioOpen
                ? 'bg-slate-900 shadow-slate-900/40 rotate-90'
                : 'bg-gradient-to-tr from-violet-600 via-purple-600 to-pink-600 hover:scale-110 active:scale-95 shadow-purple-600/40 hover:shadow-purple-600/70'
            }`}
            title="بنك الأسئلة والامتحانات"
          >
            {!isExamStudioOpen && (
              <span className="absolute -inset-1 rounded-full bg-gradient-to-r from-violet-500 to-pink-500 opacity-60 blur-xs animate-pulse pointer-events-none group-hover:opacity-100 transition-opacity" />
            )}
            {isExamStudioOpen ? (
              <X className="w-6 h-6 text-white relative z-10" />
            ) : (
              <div className="relative z-10 flex flex-col items-center justify-center">
                <HelpCircle className="w-6 h-6 sm:w-7 sm:h-7 group-hover:scale-110 transition-transform" />
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-400 border-2 border-purple-600 rounded-full" />
              </div>
            )}
          </button>
          {!isExamStudioOpen && !isSessionStudioOpen && (
            <span className="absolute -top-8 right-1/2 translate-x-1/2 whitespace-nowrap bg-slate-900/90 text-white text-[10px] font-bold px-2.5 py-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-md">
              بنك الامتحانات ❓
            </span>
          )}
        </div>
      </div>
    </>
  );
};
