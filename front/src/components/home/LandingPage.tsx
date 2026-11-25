import React from 'react';
import { motion } from 'motion/react';
import {
  GraduationCap,
  Users,
  Award,
  CalendarCheck,
  Zap,
  ArrowLeft,
  Sparkles,
  BookOpen,
  CheckCircle2,
  Cpu,
  LogIn,
  UserPlus,
  BellRing,
  BrainCircuit,
  BarChart3,
  Wallet,
} from 'lucide-react';
import { EduFlowLogo } from '../common/EduFlowLogo';

interface LandingPageProps {
  onNavigateToLogin: (initialTab?: 'student' | 'teacher' | 'parent' | 'register') => void;
}

const fadeUp = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-60px' },
  transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] as const },
};

interface RoleAccent {
  borderHover: string;
  iconBox: string;
  titleHover: string;
  ctaText: string;
}

const ACCENTS: Record<'blue' | 'emerald' | 'purple', RoleAccent> = {
  blue: {
    borderHover: 'hover:border-blue-500/60',
    iconBox: 'bg-blue-600/10 border-blue-500/20 text-blue-400 group-hover:bg-blue-600',
    titleHover: 'group-hover:text-blue-400',
    ctaText: 'text-blue-400',
  },
  emerald: {
    borderHover: 'hover:border-emerald-500/60',
    iconBox: 'bg-emerald-600/10 border-emerald-500/20 text-emerald-400 group-hover:bg-emerald-600',
    titleHover: 'group-hover:text-emerald-400',
    ctaText: 'text-emerald-400',
  },
  purple: {
    borderHover: 'hover:border-purple-500/60',
    iconBox: 'bg-purple-600/10 border-purple-500/20 text-purple-400 group-hover:bg-purple-600',
    titleHover: 'group-hover:text-purple-400',
    ctaText: 'text-purple-400',
  },
};

const roles = [
  {
    tab: 'student' as const,
    icon: GraduationCap,
    title: 'بوابة الطالب',
    desc: 'محاضرات تفاعلية، امتحانات ذاتية التصحيح، بطاقات استذكار 3D، ومساعد دراسي بالذكاء الاصطناعي.',
    cta: 'دخول الطالب',
    accent: 'blue' as const,
  },
  {
    tab: 'parent' as const,
    icon: Users,
    title: 'بوابة ولي الأمر',
    desc: 'ادخل رقم هاتف ابنك لمتابعة نسبة الحضور، تقارير الغياب، درجات الاختبارات، وحالة المصروفات مباشرة.',
    cta: 'متابعة الطالب فوراً',
    accent: 'emerald' as const,
    badge: 'دخول برقم الطالب 📱',
  },
  {
    tab: 'teacher' as const,
    icon: BookOpen,
    title: 'المعلم والإدارة',
    desc: 'إدارة المجموعات والحصص، رصد غياب الطلاب، إعداد الامتحانات، وحساب العائد المالي للمحاضر.',
    cta: 'لوحة المعلم والمساعد',
    accent: 'purple' as const,
  },
];

const features = [
  { icon: CheckCircle2, color: 'text-emerald-400', title: 'دخول سريع لولي الأمر', desc: 'بدون تعقيد كلمة مرور؛ فقط ادخل رقم هاتف الطالب واستعرض تقريره الكامل.' },
  { icon: Cpu, color: 'text-purple-400', title: 'أتمتة كاملة عبر n8n', desc: 'إرسال رسائل الغياب والشهادات لأولياء الأمور تلقائياً عبر خطوط الـ Webhook.' },
  { icon: Award, color: 'text-blue-400', title: 'امتحانات تفاعلية', desc: 'تصحيح فوري، شرح الإجابات بالذكاء الاصطناعي، وشهادات إلكترونية للمتفوقين.' },
  { icon: CalendarCheck, color: 'text-amber-400', title: 'انضباط الحضور', desc: 'تنبيهات فورية لولي الأمر عند تكرار الغياب مع خطة متابعة للمساعد الأكاديمي.' },
];

const stats = [
  { value: '4', label: 'بوابات متكاملة في منصة واحدة' },
  { value: '7', label: 'مسارات أتمتة n8n تعمل لحظياً' },
  { value: '24/7', label: 'مساعد ذكاء اصطناعي للطالب' },
  { value: '100%', label: 'متابعة لحظية لولي الأمر' },
];

const steps = [
  { icon: UserPlus, title: 'سجّل حسابك', desc: 'طالب أو معلم أو ولي أمر في أقل من دقيقة.' },
  { icon: BrainCircuit, title: 'اتعلّم بذكاء', desc: 'حصص وفيديوهات واختبارات وملخصات مدعومة بالـ AI.' },
  { icon: BellRing, title: 'تابع كل جديد', desc: 'إشعارات فورية بالغياب والدرجات والمصروفات.' },
];

export const LandingPage: React.FC<LandingPageProps> = ({ onNavigateToLogin }) => {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans relative overflow-hidden" dir="rtl">
      {/* Ambient background glows */}
      <div className="absolute top-0 right-1/4 w-[500px] h-[500px] bg-blue-600/15 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute top-1/3 left-10 w-[450px] h-[450px] bg-indigo-600/15 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-[500px] h-[500px] bg-emerald-600/10 rounded-full blur-[160px] pointer-events-none" />
      {/* Subtle grid overlay */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.15]"
        style={{
          backgroundImage:
            'linear-gradient(rgb(148 163 184 / 0.08) 1px, transparent 1px), linear-gradient(90deg, rgb(148 163 184 / 0.08) 1px, transparent 1px)',
          backgroundSize: '44px 44px',
          maskImage: 'radial-gradient(ellipse 80% 60% at 50% 20%, black, transparent)',
          WebkitMaskImage: 'radial-gradient(ellipse 80% 60% at 50% 20%, black, transparent)',
        }}
      />

      {/* Top Navigation */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-slate-950/75 border-b border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 min-h-[4.5rem] py-3 flex items-center justify-between gap-2 sm:gap-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <EduFlowLogo size="md" theme="dark" showSubtitle={false} />
            <span className="hidden sm:inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">
              LMS 2.0 الذكي
            </span>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            <button
              onClick={() => onNavigateToLogin('parent')}
              className="px-2.5 py-2 sm:px-4 sm:py-2.5 rounded-xl bg-slate-900 border border-slate-700/80 hover:border-emerald-500/60 text-slate-200 hover:text-emerald-300 text-xs sm:text-sm font-bold transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Users className="w-4 h-4 text-emerald-400" />
              <span>دخول ولي الأمر</span>
            </button>

            <button
              onClick={() => onNavigateToLogin('student')}
              className="px-3 py-2 sm:px-5 sm:py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs sm:text-sm font-bold shadow-lg shadow-emerald-600/25 transition-all flex items-center gap-1.5 sm:gap-2 cursor-pointer"
            >
              <LogIn className="w-4 h-4" />
              <span>تسجيل الدخول</span>
            </button>
          </div>
        </div>
      </header>

      {/* HERO SECTION */}
      <section className="relative z-10 pt-12 sm:pt-16 pb-14 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto text-center flex flex-col justify-center items-center">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 rounded-full bg-slate-900/90 border border-slate-700 text-emerald-300 text-[11px] sm:text-xs font-semibold mb-6 shadow-inner backdrop-blur-md max-w-[95vw] truncate"
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-pulse shrink-0" />
          <span className="truncate">المنظومة التعليمية الذكية الأكثر تكاملاً لعام 2026</span>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 26 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.08 }}
          className="text-3xl sm:text-5xl lg:text-6xl font-black text-white tracking-tight leading-[1.35] sm:leading-[1.25] max-w-4xl mb-4 sm:mb-6"
        >
          تعليم ذكي، متابعة لحظية،{' '}
          <span className="text-gradient-night">وتجربة تعليمية استثنائية</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 26 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.16 }}
          className="text-slate-300 text-sm sm:text-lg max-w-2xl mx-auto mb-10 leading-relaxed font-normal"
        >
          منصة <strong className="text-white">EduFlow</strong> تربط الطالب والمعلم والمساعد الإداري وولي الأمر في بيئة متكاملة مدعومة بأتمتة <span className="text-purple-400 font-bold">n8n</span> الفورية والذكاء الاصطناعي.
        </motion.p>

        {/* Quick Role Entrance Cards */}
        <div className="w-full max-w-4xl grid grid-cols-1 sm:grid-cols-3 gap-4 mb-14">
          {roles.map((role, i) => {
            const Icon = role.icon;
            const ac = ACCENTS[role.accent];
            return (
              <motion.div
                key={role.tab}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.55, delay: 0.24 + i * 0.1 }}
                onClick={() => onNavigateToLogin(role.tab)}
                className={`group p-6 rounded-3xl bg-slate-900/80 border border-slate-800 ${ac.borderHover} hover:bg-slate-900/95 transition-all duration-300 cursor-pointer text-right flex flex-col justify-between shadow-xl shadow-black/40 hover:-translate-y-1.5 relative overflow-hidden`}
              >
                {role.badge && (
                  <div className="absolute top-3 left-3 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold">
                    {role.badge}
                  </div>
                )}
                <div>
                  <div className={`w-12 h-12 rounded-2xl border flex items-center justify-center mb-4 group-hover:scale-110 group-hover:text-white transition-all ${ac.iconBox}`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <h3 className={`text-lg font-black text-white mb-2 transition-colors ${ac.titleHover}`}>
                    {role.title}
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed">{role.desc}</p>
                </div>
                <div className={`mt-5 flex items-center gap-1.5 text-xs font-bold group-hover:-translate-x-1 transition-transform ${ac.ctaText}`}>
                  <span>{role.cta}</span>
                  <ArrowLeft className="w-4 h-4" />
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Stats strip */}
        <motion.div
          {...fadeUp}
          className="w-full max-w-4xl grid grid-cols-2 md:grid-cols-4 gap-3 mb-14"
        >
          {stats.map((s) => (
            <div key={s.label} className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/70 backdrop-blur-sm text-center">
              <div className="text-2xl sm:text-3xl font-black text-gradient-night mb-1">{s.value}</div>
              <div className="text-[11px] sm:text-xs text-slate-400 font-semibold leading-relaxed">{s.label}</div>
            </div>
          ))}
        </motion.div>

        {/* How it works */}
        <motion.div {...fadeUp} className="w-full max-w-4xl mb-14">
          <div className="flex items-center justify-center gap-2 mb-6">
            <Zap className="w-5 h-5 text-amber-400" />
            <h2 className="text-base sm:text-lg font-black text-white">تبدأ في ثلاث خطوات</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 stagger">
            {steps.map((step, i) => {
              const Icon = step.icon;
              return (
                <div key={step.title} className="relative p-5 rounded-2xl bg-slate-900/60 border border-slate-800/70 text-right">
                  <div className="absolute -top-3 right-4 w-7 h-7 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-white text-xs font-black flex items-center justify-center shadow-lg shadow-emerald-900/50">
                    {i + 1}
                  </div>
                  <Icon className="w-6 h-6 text-emerald-400 mb-3" />
                  <h4 className="text-sm font-black text-white mb-1">{step.title}</h4>
                  <p className="text-[11px] text-slate-400 leading-relaxed">{step.desc}</p>
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* Feature Highlights Grid */}
        <motion.div
          {...fadeUp}
          className="w-full max-w-4xl p-6 sm:p-8 rounded-3xl bg-gradient-to-b from-slate-900/60 to-slate-900/30 border border-slate-800/80 backdrop-blur-md mb-10"
        >
          <div className="flex items-center justify-center gap-2 mb-6">
            <BarChart3 className="w-5 h-5 text-emerald-400" />
            <h2 className="text-base sm:text-lg font-black text-white">لماذا تختار منظومة EduFlow؟</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-right stagger">
            {features.map((f) => {
              const Icon = f.icon;
              return (
                <div key={f.title} className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/60 hover:border-slate-700 transition-colors">
                  <div className={`${f.color} mb-2`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <h4 className="text-sm font-bold text-white mb-1">{f.title}</h4>
                  <p className="text-[11px] text-slate-400 leading-relaxed">{f.desc}</p>
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* CTA Banner */}
        <motion.div {...fadeUp} className="flex flex-wrap items-center justify-center gap-4">
          <button
            onClick={() => onNavigateToLogin('register')}
            className="px-7 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-sm transition-all flex items-center gap-2 cursor-pointer shadow-xl shadow-emerald-600/30 hover:scale-[1.03]"
          >
            <UserPlus className="w-4 h-4" />
            <span>تسجيل طالب جديد في المنصة</span>
          </button>
          <button
            onClick={() => onNavigateToLogin('student')}
            className="px-6 py-3 rounded-2xl bg-slate-800/80 hover:bg-slate-700 text-white font-bold text-sm border border-slate-700 transition-all flex items-center gap-2 cursor-pointer"
          >
            <Wallet className="w-4 h-4 text-amber-400" />
            <span>استعرض حسابك الحالي</span>
          </button>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-slate-800/80 bg-slate-950 py-6 text-center text-xs text-slate-500 mt-auto">
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
