import React, { useState } from 'react';
import {
  GraduationCap,
  Users,
  BookOpen,
  UserPlus,
  ArrowRight,
  ArrowLeft,
  Lock,
  Mail,
  User,
  Phone,
  CheckCircle,
  AlertCircle,
  Eye,
  EyeOff,
  Sparkles,
  KeyRound,
  Shield,
  Laptop,
} from 'lucide-react';
import { Profile, CourseGroup } from '../../types/database';
import { db } from '../../services/mockDatabase';
import { EduFlowLogo } from '../common/EduFlowLogo';

interface LoginPageProps {
  onLoginSuccess: (profile: Profile) => void;
  onBackToHome?: () => void;
  initialRoleTab?: 'student' | 'teacher' | 'parent' | 'register';
}

export const LoginPage: React.FC<LoginPageProps> = ({
  onLoginSuccess,
  onBackToHome,
  initialRoleTab = 'student',
}) => {
  const [activeTab, setActiveTab] = useState<'student' | 'teacher' | 'parent' | 'register'>(initialRoleTab);

  // Common login state
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Parent specific login state (Student Phone / ID)
  const [studentPhoneForParent, setStudentPhoneForParent] = useState('');

  // Register form state (Student, Teacher, Parent)
  const [regRole, setRegRole] = useState<'student' | 'teacher' | 'parent'>('student');
  const [regName, setRegName] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regGrade, setRegGrade] = useState('الصف الثاني الإعدادي');
  const [regTeacherId, setRegTeacherId] = useState('tea-1');
  const [regGroupId, setRegGroupId] = useState('g-1');
  const [regSubject, setRegSubject] = useState('العلوم والفيزياء');
  const [regLinkedStudentPhone, setRegLinkedStudentPhone] = useState('');
  const [regSuccess, setRegSuccess] = useState('');

  const registeredStudents = db.getStudents();
  const latestStudent = registeredStudents[registeredStudents.length - 1];

  const groups = db.getGroups();

  // Reset errors when changing tabs
  const handleTabChange = (tab: 'student' | 'teacher' | 'parent' | 'register') => {
    setActiveTab(tab);
    setLoginError('');
    setRegSuccess('');
    setIdentifier('');
    setPassword('');
    setStudentPhoneForParent('');
  };

  // Standard Login (Student & Teacher/Staff)
  const handleStandardLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setIsLoading(true);

    setTimeout(() => {
      const res = db.login(identifier, password);
      const applyResult = (r: { success: boolean; profile?: any; error?: string }) => {
        setIsLoading(false);
        if (r.success && r.profile) {
          // Verify role match if student/teacher tab
          if (activeTab === 'student' && r.profile.role !== 'student') {
            setLoginError('هذا الحساب ليس حساب طالب. يرجى اختيار التبويب المناسب لحسابك.');
            return;
          }
          if (activeTab === 'teacher' && r.profile.role === 'student') {
            setLoginError('هذا الحساب مسجل كطالب. يرجى تسجيل الدخول من تبويب الطالب.');
            return;
          }
          onLoginSuccess(r.profile);
        } else {
          setLoginError(r.error || 'فشل تسجيل الدخول. يرجى التحقق من صحة البيانات.');
        }
      };
      if (res.success) {
        applyResult(res);
      } else {
        // Not found locally: staff accounts created by the admin live in
        // Supabase, so verify against the server (works from any device).
        db.loginRemote(identifier, password)
          .then(applyResult)
          .catch(() => applyResult(res));
      }
    }, 250);
  };

  // Parent Login by Student Phone / Code
  const handleParentLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setIsLoading(true);

    // Try the live Supabase lookup first (works from any device, not just
    // the browser where the student registered), then fall back to local.
    setTimeout(() => {
      db.findStudentByPhoneRemote(studentPhoneForParent)
        .catch(() => null)
        .then(() => {
          const res = db.loginParentByStudentIdentifier(studentPhoneForParent);
          setIsLoading(false);
          if (res.success && res.profile) {
            onLoginSuccess(res.profile);
          } else {
            setLoginError(res.error || 'لم يتم العثور على طالب مسجل بهذا الرقم.');
          }
        });
    }, 250);
  };

  // Standalone Registration (Student, Teacher, Parent)
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regName.trim()) {
      setLoginError(`يرجى كتابة الاسم الكامل ${regRole === 'student' ? 'للطالب' : regRole === 'teacher' ? 'للمعلم' : 'لولي الأمر'}`);
      return;
    }
    if (!regPhone.trim()) {
      setLoginError('يرجى إدخال رقم الهاتف للتواصل وتسجيل الدخول');
      return;
    }
    if (!regPassword.trim()) {
      setLoginError('يرجى كتابة كلمة مرور لحسابك لتتمكن من الدخول بها');
      return;
    }

    setIsLoading(true);
    setLoginError('');

    try {
      const pwd = regPassword.trim() || '123456';
      const newProfile = await db.registerUserStandalone({
        full_name: regName.trim(),
        phone: regPhone.trim(),
        email: regEmail.trim(),
        password: pwd,
        role: regRole,
        grade_level: regGrade,
        group_id: regGroupId,
        teacher_id: regTeacherId,
        subject: regSubject,
        student_phone_for_parent: regLinkedStudentPhone.trim(),
      });

      setIsLoading(false);
      const roleLabel = regRole === 'student' ? 'طالب' : regRole === 'teacher' ? 'معلم' : 'ولي أمر';
      setRegSuccess(`🎉 مبارك يا ${newProfile.full_name}! تم إنشاء حسابك (${roleLabel}) بنجاح وربطه بالسحابة و n8n. جاري نقلك إلى لوحة التحكم...`);

      setTimeout(() => {
        onLoginSuccess(newProfile);
      }, 1200);
    } catch (err: any) {
      setIsLoading(false);
      setLoginError(err?.message || 'حدث خطأ أثناء التسجيل، يرجى المحاولة مرة أخرى.');
    }
  };

  return (
    <div
      className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center px-4 py-8 relative overflow-hidden selection:bg-blue-600 selection:text-white"
      dir="rtl"
    >
      {/* Background ambient lighting */}
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.15]"
        style={{
          backgroundImage:
            'linear-gradient(rgb(148 163 184 / 0.08) 1px, transparent 1px), linear-gradient(90deg, rgb(148 163 184 / 0.08) 1px, transparent 1px)',
          backgroundSize: '44px 44px',
          maskImage: 'radial-gradient(ellipse 75% 60% at 50% 35%, black, transparent)',
          WebkitMaskImage: 'radial-gradient(ellipse 75% 60% at 50% 35%, black, transparent)',
        }}
      />

      {/* Top back button */}
      {onBackToHome && (
        <div className="absolute top-6 right-6 z-20">
          <button
            onClick={onBackToHome}
            className="px-4 py-2 rounded-xl bg-slate-900/80 border border-slate-800 text-slate-300 hover:text-white hover:border-slate-700 text-xs sm:text-sm font-bold transition-all flex items-center gap-2 cursor-pointer shadow-lg backdrop-blur-md"
          >
            <ArrowRight className="w-4 h-4" />
            <span>العودة للرئيسية</span>
          </button>
        </div>
      )}

      <div className="w-full max-w-xl relative z-10">
        {/* Brand Header */}
        <div className="flex flex-col items-center justify-center text-center mb-6 animate-fade-up">
          <EduFlowLogo size="hero" theme="dark" showSubtitle={true} className="mb-2" />
          <p className="text-slate-400 text-xs sm:text-sm mt-2 max-w-md mx-auto leading-relaxed">
            منظومة التعليم والمتابعة الأذكى — تسجيل الدخول المباشر
          </p>
        </div>

        {/* Clean Center Auth Card */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-black/50 backdrop-blur-xl animate-fade-up" style={{ animationDelay: '0.12s' }}>
          {/* Main Role Selector Tabs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 p-1 bg-slate-950/80 rounded-2xl mb-6 border border-slate-800/80 text-xs font-bold">
            <button
              type="button"
              onClick={() => handleTabChange('student')}
              className={`py-2.5 px-2 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'student'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <GraduationCap className="w-4 h-4" />
              <span>طالب</span>
            </button>

            <button
              type="button"
              onClick={() => handleTabChange('parent')}
              className={`py-2.5 px-2 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'parent'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>ولي أمر</span>
            </button>

            <button
              type="button"
              onClick={() => handleTabChange('teacher')}
              className={`py-2.5 px-2 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'teacher'
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <BookOpen className="w-4 h-4" />
              <span>معلم / إدارة</span>
            </button>

            <button
              type="button"
              onClick={() => handleTabChange('register')}
              className={`py-2.5 px-2 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'register'
                  ? 'bg-teal-600 text-white shadow-md shadow-teal-600/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <UserPlus className="w-4 h-4" />
              <span>حساب جديد</span>
            </button>
          </div>

          {/* Messages */}
          {loginError && (
            <div className="mb-5 p-3.5 rounded-xl bg-rose-950/60 border border-rose-800/60 text-rose-300 text-xs sm:text-sm flex items-center gap-2.5 animate-in fade-in">
              <AlertCircle className="w-5 h-5 shrink-0 text-rose-400" />
              <span>{loginError}</span>
            </div>
          )}

          {regSuccess && (
            <div className="mb-5 p-4 rounded-xl bg-emerald-950/70 border border-emerald-800 text-emerald-300 text-xs sm:text-sm leading-relaxed animate-in fade-in">
              <div className="flex items-center gap-2 font-bold mb-1">
                <CheckCircle className="w-5 h-5 text-emerald-400" />
                <span>تم التسجيل بنجاح!</span>
              </div>
              <p>{regSuccess}</p>
            </div>
          )}

          {/* 1. STUDENT LOGIN FORM */}
          {activeTab === 'student' && (
            <form onSubmit={handleStandardLogin} className="space-y-4">
              <div className="p-3 bg-blue-950/30 border border-blue-900/40 rounded-xl text-xs text-blue-300 flex items-center gap-2">
                <GraduationCap className="w-4 h-4 text-blue-400 shrink-0" />
                <span>تسجيل دخول الطلاب: ادخل رقم هاتفك أو كودك مع كلمة المرور.</span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  رقم هاتف الطالب / كود الطالب / البريد
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    required
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="مثال: 01012345678 أو stu-1"
                    className="w-full pr-10 pl-4 py-2.5 rounded-xl bg-slate-950/80 border border-slate-700 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-slate-300">
                    كلمة المرور
                  </label>
                  <span className="text-[11px] text-slate-400">الافتراضية: 123456</span>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pr-10 pl-10 py-2.5 rounded-xl bg-slate-950/80 border border-slate-700 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 hover:text-slate-200"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-sm shadow-lg shadow-blue-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isLoading ? (
                    <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <span>الدخول إلى منصة الطالب</span>
                      <ArrowLeft className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>

              {/* Quick sample student fill */}
              <div className="pt-1 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400 border-t border-slate-800/80 pt-3">
                {latestStudent ? (
                  <button
                    type="button"
                    onClick={() => {
                      setIdentifier(latestStudent.phone || latestStudent.id);
                      setPassword(latestStudent.password || '123456');
                    }}
                    className="text-blue-400 hover:text-blue-300 underline underline-offset-4 cursor-pointer"
                  >
                    تجربة سريعة: الطالب {latestStudent.full_name} ({latestStudent.phone || latestStudent.id})
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleTabChange('register')}
                    className="text-blue-400 hover:text-blue-300 underline underline-offset-4 cursor-pointer"
                  >
                    سجّل أول طالب في المنصة الآن ➔
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleTabChange('register')}
                  className="text-slate-400 hover:text-white cursor-pointer"
                >
                  تسجيل طالب جديد ➔
                </button>
              </div>
            </form>
          )}

          {/* 2. PARENT LOGIN FORM (BY STUDENT PHONE / CODE) */}
          {activeTab === 'parent' && (
            <form onSubmit={handleParentLogin} className="space-y-4">
              <div className="p-3.5 bg-emerald-950/30 border border-emerald-800/40 rounded-xl text-xs text-emerald-300 flex items-start gap-2.5">
                <Users className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div className="leading-relaxed">
                  <strong>مرحباً بولي الأمر:</strong> لمتابعة نتائج ابنك والغياب والمصروفات، كل ما عليك هو إدخال <strong>رقم هاتف الطالب</strong> المسجل في المنصة أو كوده الأكاديمي.
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  رقم هاتف الطالب أو الكود الأكاديمي *
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400">
                    <Phone className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    required
                    value={studentPhoneForParent}
                    onChange={(e) => setStudentPhoneForParent(e.target.value)}
                    placeholder="مثال: 01012345678 أو stu-1"
                    className="w-full pr-10 pl-4 py-3 rounded-xl bg-slate-950/80 border border-slate-700 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all font-mono"
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-1.5">
                  {latestStudent ? (
                    <>
                      💡 للتجربة المباشرة: اضغط على رقم هاتف الطالب ({latestStudent.full_name}):{' '}
                      <button
                        type="button"
                        onClick={() => setStudentPhoneForParent(latestStudent.phone || latestStudent.id)}
                        className="text-emerald-400 hover:underline font-mono font-bold cursor-pointer"
                      >
                        {latestStudent.phone || latestStudent.id}
                      </button>
                    </>
                  ) : (
                    <>💡 للتجربة: يرجى تسجيل طالب أولاً من تبويب "حساب جديد" ثم إدخال رقم هاتفه هنا.</>
                  )}
                </p>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-sm shadow-lg shadow-emerald-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isLoading ? (
                    <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <span>فتح تقرير متابعة الطالب</span>
                      <ArrowLeft className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* 3. TEACHER & STAFF LOGIN FORM */}
          {activeTab === 'teacher' && (
            <form onSubmit={handleStandardLogin} className="space-y-4">
              <div className="p-3 bg-purple-950/30 border border-purple-900/40 rounded-xl text-xs text-purple-300 flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-purple-400 shrink-0" />
                <span>لوحة المعلمين، المساعدين الإداريين، وإدارة المنصة الأكاديمية.</span>
              </div>

              {/* QUICK CREDENTIALS GUIDE FOR USER */}
              <div className="p-3.5 bg-slate-950/80 border border-slate-800 rounded-2xl text-xs space-y-2">
                <div className="flex items-center gap-1.5 font-bold text-slate-300">
                  <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                  <span>بيانات الدخول المعتمدة:</span>
                </div>
                <div className="grid grid-cols-1 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIdentifier('admin@gmail.com');
                      setPassword('123456');
                    }}
                    className="p-2.5 rounded-xl bg-indigo-950/40 hover:bg-indigo-900/40 border border-indigo-800/50 hover:border-indigo-500 text-right transition-all cursor-pointer"
                  >
                    <div className="font-bold text-indigo-300 flex items-center gap-1.5">
                      <Shield className="w-3.5 h-3.5" />
                      <span>م. سيف عمرو (إدارة عامة)</span>
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                      البريد: admin@gmail.com | السر: 123456
                    </div>
                  </button>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  المعلمون والمساعدون بيتعمل لهم حساب من لوحة الأدمن (تاب «إضافة معلم / مساعد») وبيدخلوا بالبريد أو رقم الهاتف وكلمة المرور اللي الأدمن حددها. الحساب بتتأكد من السيرفر مباشرة، فيشتغل من أي جهاز.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  الكود / البريد الإلكتروني / رقم الهاتف
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    required
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="مثال: admin@gmail.com أو البريد / رقم الهاتف اللي الأدمن سجله"
                    className="w-full pr-10 pl-4 py-2.5 rounded-xl bg-slate-950/80 border border-slate-700 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-slate-300">
                    كلمة المرور
                  </label>
                  <span className="text-[11px] text-slate-400">مقبول: 123456 أو admin123</span>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pr-10 pl-10 py-2.5 rounded-xl bg-slate-950/80 border border-slate-700 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 hover:text-slate-200"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-sm shadow-lg shadow-purple-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isLoading ? (
                    <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <span>الدخول للوحة التحكم</span>
                      <ArrowLeft className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* 4. UNIFIED REGISTRATION FORM (STUDENT / TEACHER / PARENT) */}
          {activeTab === 'register' && (
            <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
              <div className="p-3 bg-teal-950/30 border border-teal-900/40 rounded-xl text-xs text-teal-300 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-teal-400 shrink-0" />
                <span>
                  {regRole === 'student' && 'تسجيل طالب جديد: اكتب بياناتك الشخصية واختر كلمة مرور لحسابك.'}
                  {regRole === 'teacher' && 'تسجيل معلم جديد: سجل بياناتك ومادة التخصص لتفعيل لوحة المعلم.'}
                  {regRole === 'parent' && 'تسجيل ولي أمر: سجل بياناتك واربط حسابك برقم هاتف ابنك للمتابعة.'}
                </span>
              </div>

              {/* Role Selector Pills */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  نوع الحساب المراد إنشاؤه *
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setRegRole('student')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      regRole === 'student'
                        ? 'bg-blue-600 text-white border-blue-500 shadow-lg shadow-blue-600/30'
                        : 'bg-slate-900/60 text-slate-400 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <span>👨‍🎓</span>
                    <span>طالب</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setRegRole('teacher')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      regRole === 'teacher'
                        ? 'bg-teal-600 text-white border-teal-500 shadow-lg shadow-teal-600/30'
                        : 'bg-slate-900/60 text-slate-400 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <span>👨‍🏫</span>
                    <span>معلم</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setRegRole('parent')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      regRole === 'parent'
                        ? 'bg-emerald-600 text-white border-emerald-500 shadow-lg shadow-emerald-600/30'
                        : 'bg-slate-900/60 text-slate-400 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <span>👨‍👩‍👧</span>
                    <span>ولي أمر</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  {regRole === 'student' ? 'الاسم الرباعي للطالب *' : regRole === 'teacher' ? 'اسم المعلم الكامل *' : 'اسم ولي الأمر الكامل *'}
                </label>
                <div className="relative">
                  <User className="absolute right-3.5 top-3 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    placeholder={regRole === 'student' ? 'مثال: يوسف حسام الدين السيد' : regRole === 'teacher' ? 'مثال: أ. محمد أحمد محمود' : 'مثال: حسام الدين السيد'}
                    className="w-full pr-10 pl-3 py-2.5 rounded-xl bg-slate-950/80 border border-slate-700 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    رقم الهاتف للتواصل والدخول *
                  </label>
                  <div className="relative">
                    <Phone className="absolute right-3.5 top-3 w-4 h-4 text-slate-400" />
                    <input
                      type="tel"
                      required
                      value={regPhone}
                      onChange={(e) => setRegPhone(e.target.value)}
                      placeholder="010XXXXXXXX"
                      className="w-full pr-10 pl-3 py-2 rounded-xl bg-slate-950/80 border border-slate-700 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 font-mono"
                    />
                  </div>
                </div>

                {regRole === 'student' && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      الصف الدراسي *
                    </label>
                    <select
                      value={regGrade}
                      onChange={(e) => setRegGrade(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-950/80 border border-slate-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                    >
                      <option value="الصف الأول الإعدادي">الصف الأول الإعدادي</option>
                      <option value="الصف الثاني الإعدادي">الصف الثاني الإعدادي</option>
                      <option value="الصف الثالث الإعدادي">الصف الثالث الإعدادي</option>
                      <option value="الصف الأول الثانوي">الصف الأول الثانوي</option>
                      <option value="الصف الثاني الثانوي">الصف الثاني الثانوي</option>
                      <option value="الصف الثالث الثانوي">الصف الثالث الثانوي</option>
                    </select>
                  </div>
                )}

                {regRole === 'teacher' && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      مادة التخصص *
                    </label>
                    <input
                      type="text"
                      required
                      value={regSubject}
                      onChange={(e) => setRegSubject(e.target.value)}
                      placeholder="مثال: مادة الفيزياء والعلوم"
                      className="w-full px-3 py-2 rounded-xl bg-slate-950/80 border border-slate-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                )}

                {regRole === 'parent' && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      رقم هاتف الطالب المراد متابعته (اختياري)
                    </label>
                    <input
                      type="tel"
                      value={regLinkedStudentPhone}
                      onChange={(e) => setRegLinkedStudentPhone(e.target.value)}
                      placeholder="010XXXXXXXX"
                      className="w-full px-3 py-2 rounded-xl bg-slate-950/80 border border-slate-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 font-mono"
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  كلمة المرور للحساب (Password) *
                </label>
                <div className="relative">
                  <Lock className="absolute right-3.5 top-3 w-4 h-4 text-slate-400" />
                  <input
                    type="password"
                    required
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    placeholder="اكتب كلمة مرور من اختيارك (مثال: 123456)"
                    className="w-full pr-10 pl-3 py-2 rounded-xl bg-slate-950/80 border border-slate-700 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  💡 تذكر كلمة المرور هذه لتسجيل الدخول بها لاحقاً مع رقم هاتفك.
                </p>
              </div>

              {regRole === 'student' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    اختر المعلم والمادة التي ترغب بدراستها *
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => {
                        setRegTeacherId('tea-1');
                        setRegGroupId('g-1');
                      }}
                      className={`p-3 rounded-2xl border text-right transition-all cursor-pointer flex items-center gap-3 ${
                        regTeacherId === 'tea-1'
                          ? 'bg-blue-950/70 border-blue-500 ring-2 ring-blue-500/30'
                          : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="w-10 h-10 rounded-xl bg-blue-600/20 text-blue-400 flex items-center justify-center text-xl shrink-0">
                        👨‍🏫
                      </div>
                      <div>
                        <div className="font-bold text-xs sm:text-sm text-white">أ. أحمد رضوان</div>
                        <div className="text-[11px] text-blue-400">مادة العلوم والفيزياء</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">مجموعة الأوائل</div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setRegTeacherId('tea-2');
                        setRegGroupId('g-2');
                      }}
                      className={`p-3 rounded-2xl border text-right transition-all cursor-pointer flex items-center gap-3 ${
                        regTeacherId === 'tea-2'
                          ? 'bg-purple-950/70 border-purple-500 ring-2 ring-purple-500/30'
                          : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="w-10 h-10 rounded-xl bg-purple-600/20 text-purple-400 flex items-center justify-center text-xl shrink-0">
                        👩‍🏫
                      </div>
                      <div>
                        <div className="font-bold text-xs sm:text-sm text-white">د. مروة محمود</div>
                        <div className="text-[11px] text-purple-400">مادة الرياضيات والجبر</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">مجموعة المتفوقين</div>
                      </div>
                    </button>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  البريد الإلكتروني (اختياري)
                </label>
                <div className="relative">
                  <Mail className="absolute right-3.5 top-3 w-4 h-4 text-slate-400" />
                  <input
                    type="email"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    placeholder={regRole === 'student' ? 'student@example.com' : regRole === 'teacher' ? 'teacher@example.com' : 'parent@example.com'}
                    className="w-full pr-10 pl-3 py-2 rounded-xl bg-slate-950/80 border border-slate-700 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white font-bold text-sm shadow-lg shadow-teal-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isLoading ? (
                    <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <span>
                        {regRole === 'student' && 'إنشاء حساب الطالب وتفعيل المنصة فوراً'}
                        {regRole === 'teacher' && 'إنشاء حساب المعلم وتفعيل المنظومة فوراً'}
                        {regRole === 'parent' && 'إنشاء حساب ولي الأمر وتفعيل المتابعة فوراً'}
                      </span>
                      <CheckCircle className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => handleTabChange('student')}
                  className="text-xs text-teal-400 hover:text-teal-300 underline underline-offset-4 cursor-pointer"
                >
                  لديك حساب بالفعل؟ تسجيل الدخول
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
