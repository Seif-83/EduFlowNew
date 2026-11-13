import React from 'react';
import {
  GraduationCap,
  Users,
  Award,
  CalendarCheck,
  ShieldCheck,
  Zap,
  ArrowLeft,
  Sparkles,
  BookOpen,
  PhoneCall,
  CheckCircle2,
  TrendingUp,
  Cpu,
  LogIn,
  UserPlus,
} from 'lucide-react';
import { EduFlowLogo } from '../common/EduFlowLogo';

interface LandingPageProps {
  onNavigateToLogin: (initialTab?: 'student' | 'teacher' | 'parent' | 'register') => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onNavigateToLogin }) => {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-600 selection:text-white relative overflow-hidden" dir="rtl">
      {/* Ambient background glows */}
      <div className="absolute top-0 right-1/4 w-[500px] h-[500px] bg-blue-600/15 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute top-1/3 left-10 w-[450px] h-[450px] bg-indigo-600/15 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-[500px] h-[500px] bg-emerald-600/10 rounded-full blur-[160px] pointer-events-none" />

      {/* Top Navigation */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-slate-950/80 border-b border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <EduFlowLogo size="md" theme="dark" showSubtitle={false} />
            <span className="hidden sm:inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">
              LMS 2.0 الذكي
            </span>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={() => onNavigateToLogin('parent')}
              className="px-3.5 py-2 sm:px-4 sm:py-2.5 rounded-xl bg-slate-900 border border-slate-700/80 hover:border-emerald-500/60 text-slate-200 hover:text-emerald-300 text-xs sm:text-sm font-bold transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Users className="w-4 h-4 text-emerald-400" />
              <span>دخول ولي الأمر</span>
            </button>

            <button
              onClick={() => onNavigateToLogin('student')}
              className="px-4 py-2 sm:px-5 sm:py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs sm:text-sm font-bold shadow-lg shadow-blue-600/25 transition-all flex items-center gap-2 cursor-pointer"
            >
              <LogIn className="w-4 h-4" />
              <span>تسجيل الدخول</span>
            </button>
          </div>
        </div>
      </header>

      {/* HERO SECTION */}
      <section className="relative z-10 pt-12 pb-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto text-center flex-1 flex flex-col justify-center items-center">
        {/* Modern Pill Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-900/90 border border-slate-700 text-indigo-300 text-xs font-semibold mb-6 shadow-inner backdrop-blur-md">
          <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
          <span>المنظومة التعليمية الذكية الأكثر تكاملاً لعام 2026</span>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
        </div>

        {/* Hero Title */}
        <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-white tracking-tight leading-tight max-w-4xl mb-6">
          تعليم ذكي، متابعة لحظية،{' '}
          <span className="bg-gradient-to-r from-blue-400 via-indigo-300 to-emerald-400 bg-clip-text text-transparent">
            وتجربة تعليمية استثنائية
          </span>
        </h1>

        {/* Hero Description */}
        <p className="text-slate-300 text-sm sm:text-lg max-w-2xl mx-auto mb-10 leading-relaxed font-normal">
          منصة <strong className="text-white">EduFlow</strong> تربط الطالب والمعلم والمساعد الإداري وولي الأمر في بيئة متكاملة مدعومة بأتمتة <span className="text-purple-400 font-bold">n8n</span> الفورية والذكاء الاصطناعي.
        </p>

        {/* Quick Role Entrance Cards */}
        <div className="w-full max-w-4xl grid grid-cols-1 sm:grid-cols-3 gap-4 mb-12">
          {/* Student Card */}
          <div
            onClick={() => onNavigateToLogin('student')}
            className="group p-6 rounded-3xl bg-slate-900/80 border border-slate-800 hover:border-blue-500/60 hover:bg-slate-900/95 transition-all duration-300 cursor-pointer text-right flex flex-col justify-between shadow-xl shadow-black/40 hover:-translate-y-1"
          >
            <div>
              <div className="w-12 h-12 rounded-2xl bg-blue-600/10 border border-blue-500/20 text-blue-400 flex items-center justify-center mb-4 group-hover:scale-110 group-hover:bg-blue-600 group-hover:text-white transition-all">
                <GraduationCap className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-black text-white mb-2 group-hover:text-blue-400 transition-colors">
                بوابة الطالب
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                محاضرات تفاعلية، امتحانات ذاتية التصحيح، بطاقات استذكار 3D، ومساعد دراسي بالذكاء الاصطناعي.
              </p>
            </div>
            <div className="mt-5 flex items-center gap-1.5 text-xs font-bold text-blue-400 group-hover:translate-x-[-4px] transition-transform">
              <span>دخول الطالب</span>
              <ArrowLeft className="w-4 h-4" />
            </div>
          </div>

          {/* Parent Card */}
          <div
            onClick={() => onNavigateToLogin('parent')}
            className="group p-6 rounded-3xl bg-slate-900/80 border border-slate-800 hover:border-emerald-500/60 hover:bg-slate-900/95 transition-all duration-300 cursor-pointer text-right flex flex-col justify-between shadow-xl shadow-black/40 hover:-translate-y-1 relative overflow-hidden"
          >
            <div className="absolute top-3 left-3 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold">
              دخول برقم الطالب 📱
            </div>
            <div>
              <div className="w-12 h-12 rounded-2xl bg-emerald-600/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mb-4 group-hover:scale-110 group-hover:bg-emerald-600 group-hover:text-white transition-all">
                <Users className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-black text-white mb-2 group-hover:text-emerald-400 transition-colors">
                بوابة ولي الأمر
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                ادخل رقم هاتف ابنك لمتابعة نسبة الحضور، تقارير الغياب، درجات الاختبارات، وحالة المصروفات مباشرة.
              </p>
            </div>
            <div className="mt-5 flex items-center gap-1.5 text-xs font-bold text-emerald-400 group-hover:translate-x-[-4px] transition-transform">
              <span>متابعة الطالب فوراً</span>
              <ArrowLeft className="w-4 h-4" />
            </div>
          </div>

          {/* Teacher & Staff Card */}
          <div
            onClick={() => onNavigateToLogin('teacher')}
            className="group p-6 rounded-3xl bg-slate-900/80 border border-slate-800 hover:border-purple-500/60 hover:bg-slate-900/95 transition-all duration-300 cursor-pointer text-right flex flex-col justify-between shadow-xl shadow-black/40 hover:-translate-y-1"
          >
            <div>
              <div className="w-12 h-12 rounded-2xl bg-purple-600/10 border border-purple-500/20 text-purple-400 flex items-center justify-center mb-4 group-hover:scale-110 group-hover:bg-purple-600 group-hover:text-white transition-all">
                <BookOpen className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-black text-white mb-2 group-hover:text-purple-400 transition-colors">
                المعلم والإدارة
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                إدارة المجموعات والحصص، رصد غياب الطلاب، إعداد الامتحانات، وحساب العائد المالي للمحاضر.
              </p>
            </div>
            <div className="mt-5 flex items-center gap-1.5 text-xs font-bold text-purple-400 group-hover:translate-x-[-4px] transition-transform">
              <span>لوحة المعلم والمساعد</span>
              <ArrowLeft className="w-4 h-4" />
            </div>
          </div>
        </div>

        {/* Feature Highlights Grid */}
        <div className="w-full max-w-4xl p-6 sm:p-8 rounded-3xl bg-gradient-to-b from-slate-900/60 to-slate-900/30 border border-slate-800/80 backdrop-blur-md mb-8">
          <div className="flex items-center justify-center gap-2 mb-6">
            <Zap className="w-5 h-5 text-amber-400" />
            <h2 className="text-base sm:text-lg font-black text-white">
              لماذا تختار منظومة EduFlow؟
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-right">
            <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/60">
              <div className="text-emerald-400 mb-2">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <h4 className="text-sm font-bold text-white mb-1">دخول سريع لولي الأمر</h4>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                بدون تعقيد كلمة مرور؛ فقط ادخل رقم هاتف الطالب واستعرض تقريره الكامل.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/60">
              <div className="text-purple-400 mb-2">
                <Cpu className="w-5 h-5" />
              </div>
              <h4 className="text-sm font-bold text-white mb-1">أتمتة كاملة عبر n8n</h4>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                إرسال رسائل الغياب والشهادات لأولياء الأمور تلقائياً عبر خطوط الـ Webhook.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/60">
              <div className="text-blue-400 mb-2">
                <Award className="w-5 h-5" />
              </div>
              <h4 className="text-sm font-bold text-white mb-1">امتحانات تفاعلية</h4>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                تصحيح فوري، شرح الإجابات بالذكاء الاصطناعي، وشهادات إلكترونية للمتفوقين.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/60">
              <div className="text-amber-400 mb-2">
                <CalendarCheck className="w-5 h-5" />
              </div>
              <h4 className="text-sm font-bold text-white mb-1">انضباط الحضور</h4>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                تنبيهات فورية لولي الأمر عند تكرار الغياب مع خطة متابعة للمساعد الأكاديمي.
              </p>
            </div>
          </div>
        </div>

        {/* CTA Banner */}
        <div className="flex flex-wrap items-center justify-center gap-4">
          <button
            onClick={() => onNavigateToLogin('register')}
            className="px-6 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-sm border border-slate-700 transition-all flex items-center gap-2 cursor-pointer shadow-lg"
          >
            <UserPlus className="w-4 h-4 text-emerald-400" />
            <span>تسجيل طالب جديد في المنصة</span>
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-slate-800/80 bg-slate-950 py-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p>© 2026 EduFlow LMS — جميع الحقوق محفوظة لمدارس اللغات والتعليم الذكي.</p>
          <div className="flex items-center gap-4 text-slate-400">
            <span>مدعوم بـ n8n Webhook Engine</span>
            <span>•</span>
            <span>بوابة الطالب والمعلم وولي الأمر</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
