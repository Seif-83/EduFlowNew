import React, { useState } from 'react';
import {
  Users,
  BookOpen,
  FileCheck,
  CalendarCheck,
  DollarSign,
  Plus,
  CheckCircle,
  Clock,
  Award,
  Download,
  Send,
  FileText,
  UserCheck,
  X,
  Upload,
  Trash2,
} from 'lucide-react';
import { Profile, Session, Exam, Question, CourseMaterial } from '../../types/database';
import { db } from '../../services/mockDatabase';
import { sendN8nEvent } from '../../services/n8nService';
import { uploadMaterialFileToSupabase } from '../../services/supabaseClient';
import { FloatingTeacherStudios } from './FloatingTeacherStudios';
import { TeacherPricingPanel } from './TeacherPricingPanel';
import { ModalPortal } from '../common/ModalPortal';

interface TeacherPortalProps {
  currentTeacher: Profile;
}

export const TeacherPortal: React.FC<TeacherPortalProps> = ({ currentTeacher }) => {
  const [refreshKey, setRefreshKey] = useState(0);
  const [activeTab, setActiveTab] = useState<
    'groups' | 'materials' | 'grading' | 'attendance' | 'pricing' | 'earnings'
  >(() => {
    const saved = localStorage.getItem('eduflow_teacher_tab');
    if (saved === 'groups' || saved === 'materials' || saved === 'grading' || saved === 'attendance' || saved === 'pricing' || saved === 'earnings') {
      return saved as 'groups' | 'materials' | 'grading' | 'attendance' | 'pricing' | 'earnings';
    }
    return 'groups';
  });

  const groups = db.getGroupsForTeacher(currentTeacher.id);
  const [selectedGroupId, setSelectedGroupId] = useState(groups[0]?.id || '');

  // Keep the selection valid: no group at all => '' (nothing is auto-created).
  React.useEffect(() => {
    if (!groups.some((g) => g.id === selectedGroupId)) {
      setSelectedGroupId(groups[0]?.id || '');
    }
  }, [groups.map((g) => g.id).join(','), selectedGroupId]);

  const sessions = db.getSessions(selectedGroupId);
  const [selectedSessionId, setSelectedSessionId] = useState(sessions[0]?.id || '');

  React.useEffect(() => {
    if (!selectedSessionId || !sessions.some((s) => s.id === selectedSessionId)) {
      setSelectedSessionId(sessions[0]?.id || '');
    }
  }, [sessions, selectedSessionId]);

  // Enrolled students in this group or under this teacher only.
  // (Removed the old fallback that showed EVERY student to a teacher with an
  // empty group — that made a new student appear under all teachers.)
  const enrollments = db.state.enrollments.filter((e) => e.group_id === selectedGroupId && e.status === 'active');
  const studentProfiles = db.getStudents().filter((s) =>
    enrollments.some((e) => e.student_id === s.id) || s.teacher_id === currentTeacher.id
  );

  // Remove student from this teacher's list
  const [removeStudentMsg, setRemoveStudentMsg] = useState('');
  const handleRemoveStudent = (studentId: string, studentName: string) => {
    if (!window.confirm(`هل أنت متأكد من حذف الطالب (${studentName}) من قائمتك؟ سيبقى حسابه على المنصة لكنه لن يظهر في مجموعاتك.`)) return;
    const res = db.removeStudentFromTeacher(studentId, currentTeacher.id);
    setRemoveStudentMsg(res.message);
    setRefreshKey((k) => k + 1);
    setTimeout(() => setRemoveStudentMsg(''), 3000);
  };

  // Study materials (مذكرات) upload state
  const [matTitle, setMatTitle] = useState('');
  const [matGrade, setMatGrade] = useState('الصف الأول الإعدادي');
  const [matFile, setMatFile] = useState<File | null>(null);
  const [matYoutubeUrl, setMatYoutubeUrl] = useState('');
  const [matDescription, setMatDescription] = useState('');
  const [matUploading, setMatUploading] = useState(false);
  const [matMsg, setMatMsg] = useState('');
  const [matError, setMatError] = useState('');
  const myMaterials = db.getMaterialsByTeacher(currentTeacher.id);
  const [confirmDeleteMatId, setConfirmDeleteMatId] = useState<string | null>(null);
  const [deletingMatId, setDeletingMatId] = useState<string | null>(null);

  const handleDeleteMaterial = async (id: string) => {
    setDeletingMatId(id);
    setMatMsg('');
    setMatError('');
    const res = await db.deleteCourseMaterial(id);
    setDeletingMatId(null);
    setConfirmDeleteMatId(null);
    if (res.success) {
      setMatMsg(res.message);
      setRefreshKey((k) => k + 1);
      setTimeout(() => setMatMsg(''), 5000);
    } else {
      setMatError(res.message);
    }
  };

  const handleUploadMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    setMatError('');
    if (!matTitle.trim()) return;
    const youtube = matYoutubeUrl.trim();
    if (!matFile && !youtube) {
      setMatError('ارفع ملف المذكرة أو ضع لينك يوتيوب على الأقل.');
      return;
    }
    setMatUploading(true);
    let fileUrl = youtube;
    let fileType = youtube ? 'YouTube' : 'PDF';
    if (matFile) {
      const up = await uploadMaterialFileToSupabase(matFile, currentTeacher.id);
      if (!up.success || !up.url) {
        setMatUploading(false);
        setMatError(`فشل رفع الملف إلى Supabase Storage (${up.error || 'خطأ غير معروف'}). تأكد من تشغيل supabase/setup2.sql لإنشاء bucket باسم course-materials.`);
        return;
      }
      fileUrl = up.url;
      const ext = matFile.name.split('.').pop()?.toUpperCase();
      fileType = ext && ext.length <= 5 ? ext : (matFile.type || 'PDF');
    }
    db.uploadMaterialByTeacher({
      title: matTitle.trim(),
      grade_level: matGrade,
      file_url: fileUrl,
      file_type: fileType,
      description: matDescription.trim() || undefined,
      teacher_id: currentTeacher.id,
    });
    setMatUploading(false);
    setMatMsg(`✅ تم رفع المذكرة "${matTitle.trim()}" لـ ${matGrade} بنجاح`);
    setMatTitle('');
    setMatFile(null);
    setMatYoutubeUrl('');
    setMatDescription('');
    setRefreshKey((k) => k + 1);
    setTimeout(() => setMatMsg(''), 4000);
  };

  // Homework grading desk
  const pendingSubmissions = db.state.submissions.filter((s) => s.status === 'submitted');
  const [gradingScore, setGradingScore] = useState<Record<string, number>>({});
  const [gradingFeedback, setGradingFeedback] = useState<Record<string, string>>({});
  const [gradeSuccessMsg, setGradeSuccessMsg] = useState('');

  // Attendance marking
  const [attendanceStatuses, setAttendanceStatuses] = useState<Record<string, 'present' | 'absent' | 'late' | 'excused'>>({});
  const [attendanceSuccessMsg, setAttendanceSuccessMsg] = useState('');

  // Note for student
  const [noteStudentId, setNoteStudentId] = useState('');
  const [noteText, setNoteText] = useState('');
  const [noteSuccessMsg, setNoteSuccessMsg] = useState('');

  // Dynamic Group & Schedule State
  const courses = db.getCourses();
  const [isAddGroupModalOpen, setIsAddGroupModalOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupCourseId, setNewGroupCourseId] = useState(courses[0]?.id || '');
  const [newGroupScheduleTime, setNewGroupScheduleTime] = useState('');
  const [newGroupStartDate, setNewGroupStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [newGroupEndDate, setNewGroupEndDate] = useState('2027-01-30');
  const [newGroupCapacity, setNewGroupCapacity] = useState(25);
  const [groupSuccessMsg, setGroupSuccessMsg] = useState('');

  const handleCreateGroup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;

    // No default course exists: if there is none, create one for this teacher
    // (titled by their subject) so the group has a valid course in Supabase.
    let selectedCourse = db.getCourses().find((c) => c.id === newGroupCourseId) || db.getCourses()[0];
    if (!selectedCourse) {
      selectedCourse = db.addCourse({
        title: (currentTeacher.grade_level || newGroupName.trim() || 'المنهج الدراسي'),
        description: '',
        created_by: currentTeacher.id,
        status: 'published',
      });
    }
    const created = db.createGroup({
      teacher_id: currentTeacher.id,
      course_id: selectedCourse.id,
      name: newGroupName.trim(),
      schedule_time: newGroupScheduleTime.trim(),
      start_date: newGroupStartDate,
      end_date: newGroupEndDate,
      course_title: selectedCourse?.title || 'المنهج الدراسي',
      teacher_name: currentTeacher.full_name,
      max_students: Number(newGroupCapacity),
    });

    setSelectedGroupId(created.id);
    setGroupSuccessMsg(`🎉 تم إنشاء المجموعة وميعاد الحصص "${created.name}" بنجاح!`);
    setNewGroupName('');
    setTimeout(() => {
      setGroupSuccessMsg('');
      setIsAddGroupModalOpen(false);
    }, 2000);
  };

  // KPI calculations
  const totalStudents = studentProfiles.length;
  const publishedSessionsCount = sessions.filter((s) => s.is_published).length;
  const myEarnings = db.getTeacherEarnings(currentTeacher.id);
  const totalEarned = myEarnings.reduce((acc, e) => acc + e.amount, 0);

  // Grade submission handler
  const handleGrade = (submissionId: string, maxScore = 20) => {
    const score = gradingScore[submissionId] ?? maxScore;
    const feedback = gradingFeedback[submissionId] || 'إجابة ممتازة وموفقة!';

    db.gradeSubmission(submissionId, score, feedback, currentTeacher.id);
    setGradeSuccessMsg('تم تقييم الواجب ورصد الدرجة بنجاح وإرسال إشعار للطالب! ✓');
    setTimeout(() => setGradeSuccessMsg(''), 4000);
  };

  // Save Attendance Sheet
  const handleSaveAttendance = () => {
    if (sessions.length === 0) {
      alert('⚠️ يرجى إضافة حصة أولاً في تبويب "إدارة الحصص والمحتوى" قبل رصد الحضور.');
      return;
    }
    const session = sessions.find((s) => s.id === selectedSessionId) || sessions[0];
    const records = studentProfiles.map((s) => ({
      session_id: session?.id || selectedSessionId,
      student_id: s.id,
      status: attendanceStatuses[s.id] || 'present',
      recorded_by: currentTeacher.id,
    }));

    db.recordAttendance(records);

    // Notify students & parents and dispatch a SINGLE n8n event with all records
    const allRecordsForN8n = records.map((r) => {
      const st = studentProfiles.find((p) => p.id === r.student_id);
      // In-app notifications
      if (r.status === 'absent' && st) {
        db.addNotification({
          user_id: st.id,
          title: '⚠️ تنبيه غياب عن الحصة',
          message: `تم تسجيل غيابك عن ${session?.title || 'الحصة الدراسية'}. نرجو مراجعة المعلم أو مشاهدة التسجيل.`,
          notification_type: 'attendance',
        });
        if (st.parent_id) {
          db.addNotification({
            user_id: st.parent_id,
            title: `⚠️ تنبيه غياب الطالب ${st.full_name}`,
            message: `نود إحاطتكم علماً بغياب نجلكم عن ${session?.title || 'الحصة'}.`,
            notification_type: 'attendance',
          });
        }
      }
      return {
        student_id: st?.id || r.student_id,
        student_name: st?.full_name || 'طالب',
        parent_email: st?.parent_email || 'parent@eduflow.edu',
        parent_phone: st?.phone || 'غير متاح',
        status: r.status,
        consecutive_absences: 1,
      };
    });

    const currentGroup = groups.find((g) => g.id === selectedGroupId) || groups[0];

    // Single n8n webhook dispatch for the whole sheet
    sendN8nEvent('attendance_marked', {
      teacher_name: currentTeacher.full_name,
      teacher_id: currentTeacher.id,
      session_title: session?.title || 'الحصة الدراسية',
      group_name: currentGroup?.name || 'المجموعة الدراسية',
      date: new Date().toLocaleDateString('ar-EG'),
      records: allRecordsForN8n,
    });

    setAttendanceSuccessMsg(`تم بنجاح حفظ كشف الحضور والغياب لـ "${session?.title}" وتحديث بيانات أولياء الأمور فوراً! ☁️`);
    setTimeout(() => setAttendanceSuccessMsg(''), 4500);
  };

  const handleMarkAllPresent = () => {
    const updated: Record<string, 'present'> = {};
    studentProfiles.forEach((s) => {
      updated[s.id] = 'present';
    });
    setAttendanceStatuses(updated);
  };

  const handleMarkAllAbsent = () => {
    const updated: Record<string, 'absent'> = {};
    studentProfiles.forEach((s) => {
      updated[s.id] = 'absent';
    });
    setAttendanceStatuses(updated);
  };

  // Add Note for Student
  const handleAddNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteStudentId || !noteText.trim()) return;

    db.addStudentNote(noteStudentId, currentTeacher.id, selectedGroupId, noteText);
    setNoteSuccessMsg('تم حفظ الملاحظة الأكاديمية وإضافتها لملف متابعة الطالب وولي الأمر! 📝');
    setNoteText('');
    setNoteStudentId('');
    setTimeout(() => setNoteSuccessMsg(''), 4000);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6 stagger">
      {/* Teacher Profile Banner */}
      <div className="bg-white border-2 border-slate-200 rounded-3xl p-5 sm:p-6 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-50 to-emerald-100 text-emerald-700 border-2 border-emerald-200 flex items-center justify-center text-3xl shadow-sm shrink-0">
            {currentTeacher.avatar || '👨‍🏫'}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg sm:text-xl font-black text-slate-900">
                {currentTeacher.full_name}
              </h2>
              <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold px-2.5 py-0.5 rounded-full">
                معلم معتمد
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {currentTeacher.email} • لوحة إدارة الكورسات والمجموعات والتقييم الآلي
            </p>
          </div>
        </div>

        {/* Group Selector & Add New Group */}
        <div className="w-full sm:w-auto flex items-center gap-2 flex-wrap sm:flex-nowrap">
          <span className="text-xs font-bold text-slate-500 shrink-0">المجموعة النشطة:</span>
          <select
            value={selectedGroupId}
            onChange={(e) => setSelectedGroupId(e.target.value)}
            disabled={groups.length === 0}
            className="p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 min-w-[160px] disabled:text-slate-400 disabled:cursor-not-allowed"
          >
            {groups.length === 0 ? (
              <option value="">لا توجد مجموعات بعد</option>
            ) : (
              groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))
            )}
          </select>
          <button
            onClick={() => setIsAddGroupModalOpen(true)}
            className="px-3 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer shrink-0"
            title="إضافة ميعاد ومجموعة دراسية جديدة للطلاب"
          >
            <Plus className="w-4 h-4" />
            <span>مجموعة وميعاد جديد</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border-2 border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs">
          <span className="text-xs font-bold text-slate-500 block mb-1">الطلاب المسجلين</span>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black text-blue-600">{totalStudents}</span>
            <Users className="w-5 h-5 text-blue-500/50" />
          </div>
        </div>

        <div className="bg-white border-2 border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs">
          <span className="text-xs font-bold text-slate-500 block mb-1">الحصص المنشورة</span>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black text-emerald-600">{publishedSessionsCount}</span>
            <BookOpen className="w-5 h-5 text-emerald-500/50" />
          </div>
        </div>

        <div className="bg-white border-2 border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs">
          <span className="text-xs font-bold text-slate-500 block mb-1">واجبات بانتظار التصحيح</span>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black text-amber-600">{pendingSubmissions.length}</span>
            <FileCheck className="w-5 h-5 text-amber-500/50" />
          </div>
        </div>

        <div className="bg-white border-2 border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs">
          <span className="text-xs font-bold text-slate-500 block mb-1">إجمالي المستحقات المالية</span>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black text-purple-600">{totalEarned} EGP</span>
            <DollarSign className="w-5 h-5 text-purple-500/50" />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        {[
          { id: 'groups', label: '👥 المجموعات والطلاب', icon: Users },
          { id: 'materials', label: '📚 المذكرات الدراسية', icon: Upload },
          { id: 'grading', label: `✍️ تصحيح الواجبات (${pendingSubmissions.length})`, icon: FileCheck },
          { id: 'attendance', label: '📋 تسجيل الحضور والغياب', icon: CalendarCheck },
          { id: 'pricing', label: '🏷️ الأسعار والأكواد', icon: DollarSign },
          { id: 'earnings', label: '💰 المستحقات والأرباح', icon: DollarSign },
        ].map((tab) => {
          const TabIcon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id as typeof activeTab);
                localStorage.setItem('eduflow_teacher_tab', tab.id);
              }}
              className={`px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm whitespace-nowrap flex items-center gap-2 transition-all cursor-pointer shrink-0 ${
                isActive
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                  : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              <TabIcon className="w-4 h-4 shrink-0" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: Groups & Students */}
      {activeTab === 'groups' && (
        <div className="space-y-4">
          {/* Active Group Schedule & Details Banner */}
          <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 border-2 border-emerald-200/80 shadow-xs flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center text-xl shadow-xs shrink-0">
                ⏰
              </div>
              <div>
                {(() => {
                  const activeGroup = groups.find((g) => g.id === selectedGroupId);
                  if (!activeGroup) {
                    return (
                      <>
                        <h3 className="font-black text-slate-900 text-sm sm:text-base">لا توجد مجموعات بعد</h3>
                        <p className="text-xs text-emerald-900 font-semibold mt-1">
                          أضف مجموعتك الأولى وحدد ميعاد الحصص بنفسك من زرار "مجموعة وميعاد جديد".
                        </p>
                      </>
                    );
                  }
                  return (
                    <>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-black text-slate-900 text-sm sm:text-base">{activeGroup.name}</h3>
                        <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 text-[10px] font-bold px-2.5 py-0.5 rounded-full">
                          مجموعة نشطة 🟢
                        </span>
                      </div>
                      <p className="text-xs text-emerald-900 font-semibold mt-1">
                        الميعاد الدراسي الأسبوعي: <span className="font-black text-emerald-700 bg-white/80 px-2 py-0.5 rounded-md border border-emerald-200">{activeGroup.schedule_time || 'لم يتحدد ميعاد'}</span> • الطلاب المسجلين: {studentProfiles.length}
                      </p>
                    </>
                  );
                })()}
              </div>
            </div>

            <button
              onClick={() => setIsAddGroupModalOpen(true)}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>إضافة ميعاد ومجموعة جديدة</span>
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white border-2 border-slate-200 rounded-3xl p-6 shadow-sm">
              <h3 className="text-lg font-black text-slate-900 mb-1">
                👥 قائمة الطلاب المسجلين بالمجموعة
              </h3>
              <p className="text-xs text-slate-500 mb-6">
                متابعة بيانات التواصل ونسبة حضور وتفاعل كل طالب
              </p>

              <div className="divide-y divide-slate-100">
                {removeStudentMsg && (
                  <div className="p-3 mb-2 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold rounded-xl">
                    {removeStudentMsg}
                  </div>
                )}
                {studentProfiles.length === 0 && (
                  <div className="p-8 text-center text-slate-400 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 my-2">
                    <Users className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                    <p className="text-sm font-bold text-slate-700">لا يوجد طلاب في قائمتك حالياً.</p>
                    <p className="text-xs text-slate-400 mt-1">عند تسجيل طالب جديد واختيارك كمعلم، سيظهر اسمه هنا فوراً.</p>
                  </div>
                )}
                {studentProfiles.map((s) => (
                  <div key={s.id} className="py-4 flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center text-xl shrink-0">
                        {s.avatar || '👨‍🎓'}
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900 text-sm">{s.full_name}</h4>
                        <div className="text-xs text-slate-500 flex items-center gap-2">
                          <span>كود: #{s.id}</span>
                          <span>•</span>
                          <span>هاتف: {s.phone || 'غير مسجل'}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setNoteStudentId(s.id)}
                        className="px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-100 text-xs font-bold text-slate-700"
                      >
                        ✍️ إضافة ملاحظة
                      </button>
                      <button
                        onClick={() => handleRemoveStudent(s.id, s.full_name)}
                        title="حذف الطالب من قائمتك"
                        className="px-3 py-1.5 rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 text-xs font-bold text-red-700 flex items-center gap-1.5 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>حذف من قائمتي</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Add Note Card */}
          <div className="bg-white border-2 border-slate-200 rounded-3xl p-6 shadow-sm h-fit">
            <h4 className="font-black text-slate-900 text-base mb-1">
              📝 إضافة ملاحظة أكاديمية للطالب
            </h4>
            <p className="text-xs text-slate-500 mb-4">
              تظهر في ملف الطالب وبوابة ولي الأمر فوراً
            </p>

            {noteSuccessMsg && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold rounded-xl mb-4">
                {noteSuccessMsg}
              </div>
            )}

            <form onSubmit={handleAddNote} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">اختر الطالب:</label>
                <select
                  required
                  value={noteStudentId}
                  onChange={(e) => setNoteStudentId(e.target.value)}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold"
                >
                  <option value="">-- اضغط للاختيار --</option>
                  {studentProfiles.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.full_name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">الملاحظة والتقييم:</label>
                <textarea
                  required
                  rows={4}
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder="اكتب تقييم مستوى الطالب ونقاط القوة أو ما يحتاج للتحسين..."
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold resize-y"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                حفظ الملاحظة وإرسالها
              </button>
            </form>
          </div>
        </div>
        </div>
      )}



      {/* TAB: Study Materials (المذكرات) */}
      {activeTab === 'materials' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white border-2 border-slate-200 rounded-3xl p-6 shadow-sm">
              <h3 className="text-lg font-black text-slate-900 mb-1">
                📚 مذكراتي الدراسية
              </h3>
              <p className="text-xs text-slate-500 mb-6">
                كل مذكرة ترفعها تظهر فوراً للطلاب في نفس الصف الدراسي
              </p>

              {myMaterials.length === 0 ? (
                <div className="p-8 text-center text-slate-400 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                  <Upload className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm font-bold text-slate-700">لم ترفع أي مذكرات بعد.</p>
                  <p className="text-xs text-slate-400 mt-1">استخدم نموذج الرفع لإضافة أول مذكرة.</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {myMaterials.map((m: CourseMaterial) => (
                    <div key={m.id} className="py-4 flex items-center justify-between gap-4 flex-wrap">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center text-xl shrink-0">
                          📄
                        </div>
                        <div>
                          <h4 className="font-bold text-slate-900 text-sm">{m.title}</h4>
                          <div className="text-xs text-slate-500 flex items-center gap-2 flex-wrap">
                            <span className="bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full font-bold">
                              {m.grade_level || 'كل الصفوف'}
                            </span>
                            <span>{m.file_type || 'ملف'}</span>
                            <span>•</span>
                            <span>{new Date(m.created_at).toLocaleDateString('ar-EG')}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                      <a
                        href={m.file_url}
                        target="_blank"
                        rel="noreferrer"
                        className="px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-100 text-xs font-bold text-slate-700 flex items-center gap-1.5"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>فتح / تحميل</span>
                      </a>
                      {confirmDeleteMatId === m.id ? (
                        <div className="flex items-center gap-2 p-2 rounded-xl bg-red-50 border border-red-200">
                          <span className="text-[11px] font-bold text-red-700">تمسح المذكرة نهائياً؟ مش هتظهر للطلاب.</span>
                          <button
                            type="button"
                            disabled={deletingMatId === m.id}
                            onClick={() => handleDeleteMaterial(m.id)}
                            className="px-2.5 py-1 rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white text-[11px] font-bold cursor-pointer"
                          >
                            {deletingMatId === m.id ? 'جاري الحذف...' : 'نعم، احذف'}
                          </button>
                          <button
                            type="button"
                            disabled={deletingMatId === m.id}
                            onClick={() => setConfirmDeleteMatId(null)}
                            className="px-2.5 py-1 rounded-lg border border-slate-300 bg-white text-slate-700 text-[11px] font-bold cursor-pointer"
                          >
                            إلغاء
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteMatId(m.id)}
                          className="px-3 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>حذف</span>
                        </button>
                      )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="bg-white border-2 border-slate-200 rounded-3xl p-6 shadow-sm h-fit">
            <h4 className="font-black text-slate-900 text-base mb-1">
              ⬆️ رفع مذكرة جديدة
            </h4>
            <p className="text-xs text-slate-500 mb-4">
              ارفع المذكرة كملف حقيقي (PDF أو صورة) — يتم تخزينها في Supabase Storage. لينك اليوتيوب اختياري.
            </p>

            {matMsg && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold rounded-xl mb-4">
                {matMsg}
              </div>
            )}
            {matError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-800 text-xs font-bold rounded-xl mb-4">
                {matError}
              </div>
            )}

            <form onSubmit={handleUploadMaterial} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">اسم المذكرة:</label>
                <input
                  type="text"
                  required
                  value={matTitle}
                  onChange={(e) => setMatTitle(e.target.value)}
                  placeholder="مثال: مذكرة الوحدة الأولى - شرح وتمارين"
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">الصف الدراسي:</label>
                <select
                  value={matGrade}
                  onChange={(e) => setMatGrade(e.target.value)}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold"
                >
                  <option value="الصف الأول الإعدادي">الصف الأول الإعدادي (أولى إعدادي)</option>
                  <option value="الصف الثاني الإعدادي">الصف الثاني الإعدادي (تانية إعدادي)</option>
                  <option value="الصف الثالث الإعدادي">الصف الثالث الإعدادي (تالته إعدادي)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">ملف المذكرة (PDF / صورة):</label>
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.ppt,.pptx"
                  onChange={(e) => setMatFile(e.target.files?.[0] || null)}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold file:ml-3 file:px-3 file:py-1.5 file:rounded-lg file:border-0 file:bg-emerald-600 file:text-white file:text-xs file:font-bold"
                />
                {matFile && (
                  <p className="text-[11px] text-emerald-700 font-bold">✓ {matFile.name} ({Math.round(matFile.size / 1024)} كيلوبايت)</p>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">لينك يوتيوب (اختياري):</label>
                <input
                  type="url"
                  value={matYoutubeUrl}
                  onChange={(e) => setMatYoutubeUrl(e.target.value)}
                  placeholder="https://youtube.com/..."
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">وصف قصير (اختياري):</label>
                <textarea
                  rows={2}
                  value={matDescription}
                  onChange={(e) => setMatDescription(e.target.value)}
                  placeholder="محتوى المذكرة أو تعليمات للطلاب..."
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold resize-y"
                />
              </div>

              <button
                type="submit"
                disabled={matUploading}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                {matUploading ? 'جاري رفع الملف...' : 'رفع المذكرة ونشرها للطلاب'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* TAB 4: Homework Grading */}
      {activeTab === 'grading' && (
        <div className="space-y-4">
          <div className="bg-white border-2 border-slate-200 rounded-3xl p-6 shadow-sm">
            <h3 className="text-lg font-black text-slate-900 mb-1">
              ✍️ مكتب تصحيح ورصد درجات الواجبات المنزلية
            </h3>
            <p className="text-xs text-slate-500 mb-6">
              مراجعة حلول الطلاب، رصد الدرجة، وكتابة التغذية الراجعة
            </p>

            {gradeSuccessMsg && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold rounded-xl mb-4">
                {gradeSuccessMsg}
              </div>
            )}

            {pendingSubmissions.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-300">
                🎉 رائع! تم تصحيح جميع الواجبات المسلمة ولا توجد تسليمات معلقة.
              </div>
            ) : (
              <div className="space-y-4">
                {pendingSubmissions.map((sub) => (
                  <div key={sub.id} className="p-5 rounded-2xl border-2 border-slate-200 bg-slate-50/70 space-y-4">
                    <div className="flex items-center justify-between flex-wrap gap-2 text-xs">
                      <div>
                        <strong className="text-slate-900 text-sm">{sub.student_name}</strong>
                        <span className="text-slate-500 mr-2">سلم: {sub.assignment_title}</span>
                      </div>
                      <span className="bg-amber-100 text-amber-800 px-3 py-0.5 rounded-full font-bold">
                        بانتظار رصد الدرجة
                      </span>
                    </div>

                    <div className="p-4 bg-white border border-slate-200 rounded-xl text-xs space-y-2">
                      <strong className="text-slate-700 block">إجابة الطالب:</strong>
                      <p className="text-slate-800 font-medium leading-relaxed">{sub.submission_text}</p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-700">
                          الدرجة (من {sub.max_score}):
                        </label>
                        <input
                          type="number"
                          max={sub.max_score}
                          min={0}
                          value={gradingScore[sub.id] ?? sub.max_score}
                          onChange={(e) =>
                            setGradingScore({ ...gradingScore, [sub.id]: Number(e.target.value) })
                          }
                          className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold"
                        />
                      </div>

                      <div className="space-y-1 sm:col-span-2">
                        <label className="text-xs font-bold text-slate-700">تغذية راجعة للطالب:</label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={gradingFeedback[sub.id] || ''}
                            onChange={(e) =>
                              setGradingFeedback({ ...gradingFeedback, [sub.id]: e.target.value })
                            }
                            placeholder="اكتب ملاحظة تشجيعية أو توجيه علمي..."
                            className="flex-1 p-2.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold"
                          />
                          <button
                            onClick={() => handleGrade(sub.id, sub.max_score)}
                            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shrink-0"
                          >
                            رصد الدرجة ✓
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 5: Attendance Sheet */}
      {activeTab === 'attendance' && (
        <div className="space-y-4">
          <div className="bg-white border-2 border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3 pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                  <span>📋 كشف الحضور والغياب للحصة</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  حدد الحصة والطلاب الحاضرين والغائبين، وسيتم إخطار أولياء الأمور تلقائياً
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={handleMarkAllPresent}
                  className="px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  ✓ الكل حاضر
                </button>

                <button
                  type="button"
                  onClick={handleMarkAllAbsent}
                  className="px-3 py-1.5 bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  ✗ الكل غائب
                </button>

                <button
                  type="button"
                  onClick={handleSaveAttendance}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
                >
                  حفظ واعتماد الكشف ☁️
                </button>
              </div>
            </div>

            {/* Session & Group Picker */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  📌 اختر الحصة لرصد كشف الحضور:
                </label>
                <select
                  value={selectedSessionId}
                  onChange={(e) => {
                    setSelectedSessionId(e.target.value);
                    const existing = db.getAttendance(e.target.value);
                    const map: Record<string, 'present' | 'absent' | 'late' | 'excused'> = {};
                    existing.forEach((a) => {
                      map[a.student_id] = a.status;
                    });
                    setAttendanceStatuses(map);
                  }}
                  className="w-full p-2.5 rounded-xl bg-white border border-slate-300 font-bold text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                >
                  {sessions.length === 0 ? (
                    <option value="">-- لا توجد حصص مسجلة بعد (أضف حصة أولاً) --</option>
                  ) : (
                    sessions.map((s) => (
                      <option key={s.id} value={s.id}>
                        الحصة {s.session_number}: {s.title}
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  👥 المجموعة الدراسية:
                </label>
                <select
                  value={selectedGroupId}
                  onChange={(e) => {
                    setSelectedGroupId(e.target.value);
                    const groupSessions = db.getSessions(e.target.value);
                    if (groupSessions.length > 0) {
                      setSelectedSessionId(groupSessions[0].id);
                    }
                  }}
                  className="w-full p-2.5 rounded-xl bg-white border border-slate-300 font-bold text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                >
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {attendanceSuccessMsg && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold rounded-xl animate-in fade-in">
                {attendanceSuccessMsg}
              </div>
            )}

            {studentProfiles.length === 0 ? (
              <div className="p-8 text-center text-slate-400 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                <Users className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-bold text-slate-700">لا يوجد طلاب مقيدين في هذه المجموعة حالياً.</p>
                <p className="text-xs text-slate-400 mt-1">عند تسجيل أي طالب جديد واختياره لمعلمك، سيظهر اسمه هنا فوراً.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 font-bold">
                      <th className="pb-3 pr-2">الطالب</th>
                      <th className="pb-3">الكود الأكاديمي</th>
                      <th className="pb-3">الهاتف</th>
                      <th className="pb-3 text-center">حاضر (Present) 🟢</th>
                      <th className="pb-3 text-center">متأخر (Late) 🟡</th>
                      <th className="pb-3 text-center">غائب (Absent) 🔴</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {studentProfiles.map((s) => {
                      const currentStatus = attendanceStatuses[s.id] || 'present';
                      return (
                        <tr key={s.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3.5 pr-2 font-bold text-slate-900 flex items-center gap-2">
                            <span className="text-lg">{s.avatar || '👨‍🎓'}</span>
                            <span>{s.full_name}</span>
                          </td>
                          <td className="py-3.5 text-slate-500 font-mono">#{s.id}</td>
                          <td className="py-3.5 text-slate-600 font-mono">{s.phone || '—'}</td>
                          <td className="py-3.5 text-center">
                            <label className="inline-flex items-center gap-1.5 cursor-pointer px-2.5 py-1 rounded-lg hover:bg-emerald-50">
                              <input
                                type="radio"
                                name={`att_${s.id}`}
                                checked={currentStatus === 'present'}
                                onChange={() => setAttendanceStatuses({ ...attendanceStatuses, [s.id]: 'present' })}
                                className="w-4 h-4 text-emerald-600 cursor-pointer"
                              />
                              <span className="text-emerald-700 font-bold">حاضر</span>
                            </label>
                          </td>
                          <td className="py-3.5 text-center">
                            <label className="inline-flex items-center gap-1.5 cursor-pointer px-2.5 py-1 rounded-lg hover:bg-amber-50">
                              <input
                                type="radio"
                                name={`att_${s.id}`}
                                checked={currentStatus === 'late'}
                                onChange={() => setAttendanceStatuses({ ...attendanceStatuses, [s.id]: 'late' })}
                                className="w-4 h-4 text-amber-600 cursor-pointer"
                              />
                              <span className="text-amber-700 font-bold">متأخر</span>
                            </label>
                          </td>
                          <td className="py-3.5 text-center">
                            <label className="inline-flex items-center gap-1.5 cursor-pointer px-2.5 py-1 rounded-lg hover:bg-rose-50">
                              <input
                                type="radio"
                                name={`att_${s.id}`}
                                checked={currentStatus === 'absent'}
                                onChange={() => setAttendanceStatuses({ ...attendanceStatuses, [s.id]: 'absent' })}
                                className="w-4 h-4 text-rose-600 cursor-pointer"
                              />
                              <span className="text-rose-700 font-bold">غائب</span>
                            </label>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 6: Teacher Earnings */}
      {activeTab === 'pricing' && (
        <TeacherPricingPanel
          teacher={currentTeacher}
          groupId={selectedGroupId}
          groupName={groups.find((g) => g.id === selectedGroupId)?.name || ''}
          students={studentProfiles}
        />
      )}

      {activeTab === 'earnings' && (
        <div className="space-y-6">
          <div className="bg-white border-2 border-slate-200 rounded-3xl p-6 shadow-sm">
            <h3 className="text-lg font-black text-slate-900 mb-1">
              💰 كشف حساب وأرباح المعلم
            </h3>
            <p className="text-xs text-slate-500 mb-6">
              مستحقات تدريس الحصص المحتسبة وفق عقد التعويض المالي (200 EGP لكل حصة)
            </p>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 font-bold">
                    <th className="pb-3">بيان المستحق</th>
                    <th className="pb-3">المجموعة</th>
                    <th className="pb-3">المبلغ المحتسب</th>
                    <th className="pb-3">تاريخ الاحتساب</th>
                    <th className="pb-3">الحالة المالية</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {myEarnings.map((earn) => (
                    <tr key={earn.id} className="hover:bg-slate-50/50">
                      <td className="py-4 font-bold text-slate-900">{earn.description}</td>
                      <td className="py-4 text-slate-600">{earn.group_name}</td>
                      <td className="py-4 text-emerald-700 font-black">{earn.amount} {earn.currency}</td>
                      <td className="py-4 text-slate-500">
                        {new Date(earn.calculated_at).toLocaleDateString('ar-EG')}
                      </td>
                      <td className="py-4">
                        <span
                          className={`px-3 py-1 rounded-full font-bold text-[11px] ${
                            earn.status === 'paid'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : earn.status === 'approved'
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}
                        >
                          {earn.status === 'paid'
                            ? 'تم الصرف والتحويل ✓'
                            : earn.status === 'approved'
                            ? 'معتمد للصرف'
                            : 'قيد المراجعة'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Add New Group Schedule */}
      {isAddGroupModalOpen && (
        <ModalPortal className="bg-slate-950/60 backdrop-blur-xs">
          <div
            className="bg-white border-2 border-slate-200 rounded-3xl w-full max-w-lg p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto"
            dir="rtl"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-xl font-bold shadow-inner">
                  📅
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">إضافة مجموعة وميعاد دراسي جديد</h3>
                  <p className="text-xs text-slate-500">تحديد مواعيد الحصص الأسبوعية للطلاب ونظام الاشتراك</p>
                </div>
              </div>
              <button
                onClick={() => setIsAddGroupModalOpen(false)}
                className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {groupSuccessMsg && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold rounded-xl flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{groupSuccessMsg}</span>
              </div>
            )}

            <form onSubmit={handleCreateGroup} className="space-y-3.5 text-right">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">اسم المجموعة:</label>
                <input
                  required
                  type="text"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  placeholder="مثال: مجموعة الأمل - علوم 2 إعدادي (الأحد والأربعاء)"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold focus:bg-white focus:border-emerald-600 outline-hidden"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">المادة / الكورس:</label>
                {courses.length === 0 && (
                  <p className="text-[11px] text-slate-500">هيتم إنشاء المادة تلقائياً باسم مادتك عند حفظ المجموعة.</p>
                )}
                <select
                  hidden={courses.length === 0}
                  value={newGroupCourseId}
                  onChange={(e) => setNewGroupCourseId(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold focus:bg-white focus:border-emerald-600 outline-hidden"
                >
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">مواعيد وأيام الحصص (تحديد حر ومرن):</label>
                <input
                  required
                  type="text"
                  value={newGroupScheduleTime}
                  onChange={(e) => setNewGroupScheduleTime(e.target.value)}
                  placeholder="مثال: الأحد والأربعاء - الساعة 05:30 مساءً (أو الجمعة 10:00 ص)"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold focus:bg-white focus:border-emerald-600 outline-hidden"
                />
                <p className="text-[11px] text-slate-400">يمكنك كتابة أي موعد مناسب لجدولك الأسبوعي دون التقيد بقيم محددة.</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">تاريخ بدء المجموعة:</label>
                  <input
                    type="date"
                    value={newGroupStartDate}
                    onChange={(e) => setNewGroupStartDate(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">الحد الأقصى للطلاب:</label>
                  <input
                    type="number"
                    min={5}
                    value={newGroupCapacity}
                    onChange={(e) => setNewGroupCapacity(Number(e.target.value))}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">حالة المجموعة:</label>
                  <input
                    disabled
                    value="نشطة ومتاحة للتسجيل 🟢"
                    className="w-full p-2.5 bg-emerald-50 text-emerald-800 font-bold border border-emerald-200 rounded-xl text-xs"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="submit"
                  className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm rounded-xl shadow-md transition-colors cursor-pointer"
                >
                  حفظ واعتماد ميعاد المجموعة 🚀
                </button>
                <button
                  type="button"
                  onClick={() => setIsAddGroupModalOpen(false)}
                  className="py-3 px-4 border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold text-xs rounded-xl transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </ModalPortal>
      )}

      {/* Floating Action Buttons & Studios for Sessions and Exams */}
      {groups.length > 0 && (
        <FloatingTeacherStudios
          currentTeacher={currentTeacher}
          selectedGroupId={selectedGroupId}
          groups={groups}
          onSessionCreated={() => {}}
          onExamCreated={() => {}}
        />
      )}
    </div>
  );
};
