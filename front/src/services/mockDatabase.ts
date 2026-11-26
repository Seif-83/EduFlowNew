import {
  Profile,
  Course,
  CourseGroup,
  Enrollment,
  Session,
  VideoPlay,
  Exam,
  Question,
  ExamAttempt,
  Assignment,
  AssignmentSubmission,
  Attendance,
  StudentPayment,
  PaymentTransaction,
  GroupBillingSettings,
  TeacherCompensation,
  TeacherEarning,
  ParentStudentLink,
  Complaint,
  AppNotification,
  CourseMaterial,
  StudentNote,
  AiConversation,
  AiMessage,
  AutomationLog,
  StudentFollowUpRecord,
} from '../types/database';
import { sendN8nEvent, callStudentWorkflow, callAuditWorkflow, callNotificationsWorkflow, callMaterialIngestWorkflow, callExamsWorkflow, callPaymentsWorkflow } from './n8nService';
import { supabase, supabaseAdmin, createUserInSupabase, createStudentInSupabase, resetSupabaseTestStudents, deleteAuthUserInSupabase } from './supabaseClient';
import { diffAndPush, snapshotOnly, pullAll, fromDb, newUuid, isUuid } from './supabaseSync';

const STORAGE_KEY = 'eduflow_db_v3';

// Seed Initial Database State
function getInitialData() {
  const profiles: Profile[] = [
    {
      id: 'tea-1',
      full_name: 'أ. أحمد رضوان (معلم علوم وفيزياء)',
      email: 'ahmed.radwan@eduflow.edu',
      phone: '01012345678',
      role: 'teacher',
      avatar: '👨‍🏫',
      created_at: '2026-08-15T09:00:00Z',
    },
    {
      id: 'tea-2',
      full_name: 'د. مروة محمود (معلمة رياضيات وجبر)',
      email: 'marwa.mahmoud@eduflow.edu',
      phone: '01122334455',
      role: 'teacher',
      avatar: '👩‍🏫',
      created_at: '2026-08-20T09:00:00Z',
    },
    {
      id: 'ast-1',
      full_name: 'أ. كريم نبيل (المساعد التعليمي والمنسق الأكاديمي)',
      email: 'karim.nabil@eduflow.edu',
      phone: '01044332211',
      role: 'assistant',
      avatar: '🧑‍💻',
      created_at: '2026-08-10T08:30:00Z',
    },
    {
      id: 'adm-1',
      full_name: 'م. سيف عمرو (مدير المنظومة الأكاديمية)',
      email: 'seifamrmohsen2005@gmail.com',
      phone: '01011122233',
      role: 'admin',
      avatar: '⚡',
      created_at: '2026-08-01T08:00:00Z',
    },
  ];

  const courses: Course[] = [
    {
      id: 'c-1',
      title: 'العلوم العامة والأحياء - الصف الثاني الإعدادي',
      description: 'المنهج المتكامل لتدريس الجهاز الدوري، التركيب الذري، والحركة والضغط الجوي.',
      status: 'published',
      created_by: 'tea-1',
      created_at: '2026-08-25T10:00:00Z',
    },
    {
      id: 'c-2',
      title: 'الرياضيات والجبر - الصف الثاني الإعدادي',
      description: 'التحليل الرياضي، حل المعادلات، والهندسة التحليلية مع تطبيقات عملية.',
      status: 'published',
      created_by: 'tea-2',
      created_at: '2026-08-28T10:00:00Z',
    },
    {
      id: 'c-3',
      title: 'الفيزياء الأساسية - المرحلة الثانوية',
      description: 'الميكانيكا وقوانين الحركة وقوانين نيوتن والطاقة.',
      status: 'published',
      created_by: 'tea-1',
      created_at: '2026-09-01T10:00:00Z',
    },
  ];

  const groups: CourseGroup[] = [
    {
      id: 'g-1',
      course_id: 'c-1',
      teacher_id: 'tea-1',
      name: 'مجموعة الأوائل - علوم 2 إعدادي (السبت والثلاثاء)',
      start_date: '2026-09-15',
      end_date: '2027-01-30',
      status: 'active',
      created_at: '2026-09-01T12:00:00Z',
      course_title: 'العلوم العامة والأحياء - الصف الثاني الإعدادي',
      teacher_name: 'أ. أحمد رضوان',
      active_students: 0,
    },
    {
      id: 'g-2',
      course_id: 'c-2',
      teacher_id: 'tea-2',
      name: 'مجموعة العباقرة - رياضيات 2 إعدادي',
      start_date: '2026-09-16',
      end_date: '2027-01-30',
      status: 'active',
      created_at: '2026-09-02T12:00:00Z',
      course_title: 'الرياضيات والجبر - الصف الثاني الإعدادي',
      teacher_name: 'د. مروة محمود',
      active_students: 0,
    },
  ];

  const enrollments: Enrollment[] = [];
  const sessions: Session[] = [];
  const videoPlays: VideoPlay[] = [];
  const exams: Exam[] = [];
  const examAttempts: ExamAttempt[] = [];
  const assignments: Assignment[] = [];
  const submissions: AssignmentSubmission[] = [];
  const attendance: Attendance[] = [];

  const billingSettings: GroupBillingSettings[] = [
    {
      id: 'gbs-1',
      group_id: 'g-1',
      payment_type: 'monthly',
      amount: 450,
      currency: 'EGP',
      created_at: '2026-09-01T10:00:00Z',
    },
    {
      id: 'gbs-2',
      group_id: 'g-2',
      payment_type: 'monthly',
      amount: 450,
      currency: 'EGP',
      created_at: '2026-09-02T10:00:00Z',
    },
  ];

  const studentPayments: StudentPayment[] = [];
  const paymentTransactions: PaymentTransaction[] = [];

  const teacherComp: TeacherCompensation[] = [
    {
      id: 'tc-1',
      group_id: 'g-1',
      teacher_id: 'tea-1',
      compensation_type: 'per_session',
      amount: 200,
      currency: 'EGP',
      created_at: '2026-09-01T10:00:00Z',
    },
    {
      id: 'tc-2',
      group_id: 'g-2',
      teacher_id: 'tea-2',
      compensation_type: 'per_session',
      amount: 200,
      currency: 'EGP',
      created_at: '2026-09-02T10:00:00Z',
    },
  ];

  const teacherEarnings: TeacherEarning[] = [];

  const parentLinks: ParentStudentLink[] = [];

  const complaints: Complaint[] = [];
  const notifications: AppNotification[] = [];
  const courseMaterials: CourseMaterial[] = [];
  const studentNotes: StudentNote[] = [];
  const aiConversations: AiConversation[] = [];
  const aiMessages: AiMessage[] = [];
  const automationLogs: AutomationLog[] = [];

  return {
    profiles,
    courses,
    groups,
    enrollments,
    sessions,
    videoPlays,
    exams,
    examAttempts,
    assignments,
    submissions,
    attendance,
    billingSettings,
    studentPayments,
    paymentTransactions,
    teacherComp,
    teacherEarnings,
    parentLinks,
    complaints,
    notifications,
    courseMaterials,
    studentNotes,
    aiConversations,
    aiMessages,
    automationLogs,
    currentUserId: 'adm-1',
  };
}

export type DatabaseState = ReturnType<typeof getInitialData>;

class MockDatabaseService {
  public state: DatabaseState;
  private listeners: Array<() => void> = [];

  private syncSnapshot: Record<string, Map<string, string>> = {};
  private syncReady = false;

  constructor() {
    this.state = this.loadState();
    // Snapshot the local state so the first persist() after hydration does
    // not re-push everything we already have.
    this.syncSnapshot = snapshotOnly(this.state);
    this.syncReady = true;
    // Auto sync from live Supabase cloud database
    this.syncFromSupabase();
  }

  /**
   * Hydrate the local store from Supabase (all tables) so real data follows
   * users across devices, then keep every later mutation in sync via
   * write-through pushes in persist().
   */
  async hydrateFromSupabase(): Promise<void> {
    try {
      const tables = await pullAll();
      const state: any = this.state;
      const nameOf = (table: string) =>
        Object.entries({
          profiles: 'profiles', courses: 'courses', course_groups: 'groups',
          enrollments: 'enrollments', sessions: 'sessions', video_plays: 'videoPlays',
          exams: 'exams', exam_attempts: 'examAttempts', assignments: 'assignments',
          assignment_submissions: 'submissions', attendance: 'attendance',
          student_payments: 'studentPayments', payment_transactions: 'paymentTransactions',
          group_billing_settings: 'billingSettings', teacher_compensation: 'teacherComp',
          teacher_earnings: 'teacherEarnings', complaints: 'complaints',
          notifications: 'notifications', course_materials: 'courseMaterials',
          student_notes: 'studentNotes', parent_student_links: 'parentLinks',
          ai_conversations: 'aiConversations', ai_messages: 'aiMessages',
        }).find(([, t]) => t === table)?.[0];

      let merged = 0;
      for (const [table, rows] of Object.entries(tables)) {
        const mapFn = (fromDb as any)[table];
        const collection = nameOf(table);
        if (!mapFn || !collection || !Array.isArray(rows)) continue;
        if (!Array.isArray(state[collection])) state[collection] = [];
        for (const raw of rows) {
          try {
            const remote = mapFn(raw);
            const idx = state[collection].findIndex((x: any) => x.id === remote.id);
            if (idx >= 0) {
              // Remote wins for synced columns; keep local-only denormalized fields.
              state[collection][idx] = { ...state[collection][idx], ...remote };
            } else {
              state[collection].push(remote);
            }
            merged++;
          } catch (err) {
            console.warn(`[Hydrate] failed to map ${table} row:`, err);
          }
        }
      }

      // Re-attach exam questions to their exams.
      if (Array.isArray(tables.questions) && Array.isArray(state.exams)) {
        const byExam: Record<string, any[]> = {};
        for (const q of tables.questions) {
          try {
            const mapped = (fromDb as any).questions(q);
            (byExam[mapped.exam_id] = byExam[mapped.exam_id] || []).push(mapped);
          } catch { /* skip */ }
        }
        for (const exam of state.exams) {
          const remoteQs = byExam[exam.id];
          if (remoteQs && remoteQs.length) {
            const localQs = Array.isArray(exam.questions) ? exam.questions : [];
            const localIds = new Set(localQs.map((q: any) => q.id));
            exam.questions = [...localQs, ...remoteQs.filter((q) => !localIds.has(q.id))];
          }
        }
      }

      this.decorate();
      // Snapshot AFTER merge so hydrated rows are not pushed back.
      this.syncSnapshot = snapshotOnly(this.state);
      if (merged > 0) {
        this.persist();
        console.info(`[Hydrate] merged ${merged} rows from Supabase.`);
      }
    } catch (err) {
      console.info('[Hydrate] Supabase hydration note:', err);
    }
  }

  /** Fill denormalized display fields (names) from related collections. */
  private decorate(): void {
    const state: any = this.state;
    const profileName = (id: any) => state.profiles.find((p: any) => p.id === id)?.full_name;
    const groupName = (id: any) => state.groups.find((g: any) => g.id === id)?.name;
    const sessionInfo = (id: any) => state.sessions.find((s: any) => s.id === id);
    const examInfo = (id: any) => state.exams.find((e: any) => e.id === id);
    const assignmentInfo = (id: any) => state.assignments.find((a: any) => a.id === id);
    for (const e of state.enrollments) {
      e.student_name = e.student_name || profileName(e.student_id);
      e.group_name = e.group_name || groupName(e.group_id);
    }
    for (const a of state.attendance) {
      a.student_name = a.student_name || profileName(a.student_id);
      const ses = sessionInfo(a.session_id);
      a.session_title = a.session_title || ses?.title;
      a.session_number = a.session_number ?? ses?.session_number;
    }
    for (const a of state.examAttempts) {
      const ex = examInfo(a.exam_id);
      a.exam_title = a.exam_title || ex?.title;
      a.subject = a.subject || ex?.subject;
    }
    for (const sub of state.submissions) {
      sub.student_name = sub.student_name || profileName(sub.student_id);
      const asg = assignmentInfo(sub.assignment_id);
      sub.assignment_title = sub.assignment_title || asg?.title;
      sub.max_score = sub.max_score ?? asg?.max_score;
    }
    for (const p of state.studentPayments) {
      p.student_name = p.student_name || profileName(p.student_id);
      p.group_name = p.group_name || groupName(p.group_id);
    }
    for (const n of state.studentNotes) {
      n.student_name = n.student_name || profileName(n.student_id);
      n.teacher_name = n.teacher_name || profileName(n.teacher_id);
    }
    for (const g of state.groups) {
      g.course_title = g.course_title || state.courses.find((c: any) => c.id === g.course_id)?.title;
      g.teacher_name = g.teacher_name || profileName(g.teacher_id);
    }
  }

  async syncFromSupabase(): Promise<void> {
    // Full hydration from every Supabase table (profiles included).
    await this.hydrateFromSupabase();
  }

  subscribe(listener: () => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notify() {
    this.listeners.forEach((l) => {
      try {
        l();
      } catch (err) {
        console.error('Listener notification error:', err);
      }
    });
  }

  private loadState(): DatabaseState {
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem('eduflow_db');
        localStorage.removeItem('eduflow_db_v1');
        localStorage.removeItem('eduflow_db_v2');
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          const legacyDummyIds = ['stu-1', 'stu-2', 'stu-3', 'stu-4', 'par-1', 'par-2'];

          if (Array.isArray(parsed.profiles)) {
            parsed.profiles = parsed.profiles.filter((p: any) => !legacyDummyIds.includes(p.id));
            const staff = getInitialData().profiles;
            staff.forEach((s) => {
              if (!parsed.profiles.some((p: any) => p.id === s.id)) {
                parsed.profiles.push(s);
              }
            });
          }

          if (Array.isArray(parsed.examAttempts)) {
            parsed.examAttempts = parsed.examAttempts.filter((a: any) => !legacyDummyIds.includes(a.student_id));
          }
          if (Array.isArray(parsed.attendance)) {
            parsed.attendance = parsed.attendance.filter((a: any) => !legacyDummyIds.includes(a.student_id));
          }
          if (Array.isArray(parsed.videoPlays)) {
            parsed.videoPlays = parsed.videoPlays.filter((v: any) => !legacyDummyIds.includes(v.student_id));
          }
          if (Array.isArray(parsed.submissions)) {
            parsed.submissions = parsed.submissions.filter((s: any) => !legacyDummyIds.includes(s.student_id));
          }
          if (Array.isArray(parsed.enrollments)) {
            parsed.enrollments = parsed.enrollments.filter((e: any) => !legacyDummyIds.includes(e.student_id));
          }
          if (Array.isArray(parsed.parentLinks)) {
            parsed.parentLinks = parsed.parentLinks.filter(
              (l: any) => !legacyDummyIds.includes(l.student_id) && !legacyDummyIds.includes(l.parent_id)
            );
          }
          if (Array.isArray(parsed.studentPayments)) {
            parsed.studentPayments = parsed.studentPayments.filter((p: any) => !legacyDummyIds.includes(p.student_id));
          }

          if (legacyDummyIds.includes(parsed.currentUserId)) {
            const firstStudent = parsed.profiles.find((p: any) => p.role === 'student');
            parsed.currentUserId = firstStudent ? firstStudent.id : 'adm-1';
          }

          return parsed;
        }
      } catch (e) {
        console.warn('Failed to load DB from localStorage:', e);
      }
    }
    return getInitialData();
  }

  public persist() {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
      } catch (e) {
        console.warn('Failed to persist DB to localStorage:', e);
      }
    }
    this.notify();
    // Write-through to Supabase: push only what changed since last persist.
    if (this.syncReady) {
      try {
        this.syncSnapshot = diffAndPush(this.state, this.syncSnapshot, {
          suppressDeletes: this.suppressDeleteSync,
        });
      } catch (err) {
        console.warn('[SupabaseSync] diff/push note:', err);
      }
    }
  }

  private suppressDeleteSync = false;

  resetToDefault() {
    this.suppressDeleteSync = true;
    this.state = getInitialData();
    this.persist();
    this.suppressDeleteSync = false;
    resetSupabaseTestStudents().then(() => {
      console.log('Cleaned up test students from Supabase cloud on reset.');
    });
  }

  reset() {
    this.resetToDefault();
  }

  // Current Auth User
  getCurrentUser(): Profile | null {
    if (!this.state.currentUserId) return null;
    const user = this.state.profiles.find((p) => p.id === this.state.currentUserId);
    return user || null;
  }

  getCurrentProfile(): Profile | null {
    return this.getCurrentUser();
  }

  getProfileById(userId: string): Profile | undefined {
    return this.state.profiles.find((p) => p.id === userId);
  }

  setCurrentUser(userId: string) {
    const exists = this.state.profiles.some((p) => p.id === userId);
    if (exists) {
      this.state.currentUserId = userId;
      this.persist();
    }
  }

  setCurrentProfile(userId: string) {
    this.setCurrentUser(userId);
  }

  logout() {
    this.state.currentUserId = '';
    this.persist();
  }

  login(identifier: string, password?: string): { success: boolean; profile?: Profile; error?: string } {
    const cleanId = (identifier || '').trim().toLowerCase();
    
    // Smart demo aliases mapping for smooth access
    let profile: Profile | undefined;
    if (['admin', 'admin@gmail.com', 'admin@eduflow.edu', 'adm-1', 'seif'].includes(cleanId)) {
      profile = this.state.profiles.find((p) => p.role === 'admin') || this.state.profiles.find((p) => p.id === 'adm-1');
    } else if (['teacher', 'teacher@gmail.com', 'teacher@eduflow.edu', 'tea-1', 'ahmed'].includes(cleanId)) {
      profile = this.state.profiles.find((p) => p.id === 'tea-1') || this.state.profiles.find((p) => p.role === 'teacher');
    } else if (['tea-2', 'marwa', 'teacher2'].includes(cleanId)) {
      profile = this.state.profiles.find((p) => p.id === 'tea-2');
    } else if (['assistant', 'assistant@gmail.com', 'ast-1', 'karim'].includes(cleanId)) {
      profile = this.state.profiles.find((p) => p.id === 'ast-1') || this.state.profiles.find((p) => p.role === 'assistant');
    } else if (['parent', 'parent@gmail.com', 'par-1', 'walid'].includes(cleanId)) {
      profile = this.state.profiles.find((p) => p.id === 'par-1') || this.state.profiles.find((p) => p.role === 'parent');
    } else if (['student', 'stu-1', 'omar'].includes(cleanId)) {
      profile = this.state.profiles.find((p) => p.id === 'stu-1') || this.state.profiles.find((p) => p.role === 'student');
    }

    if (!profile) {
      profile = this.state.profiles.find(
        (p) =>
          p.email.toLowerCase() === cleanId ||
          p.id.toLowerCase() === cleanId ||
          (p.phone && p.phone.trim() === cleanId) ||
          p.full_name.toLowerCase().includes(cleanId)
      );
    }

    if (!profile) {
      return { success: false, error: 'لم يتم العثور على حساب مطابق للبيانات المدخلة. يمكنك استخدام كود المعلم tea-1 أو admin@gmail.com أو teacher@gmail.com.' };
    }

    // Friendly demo password verification: allow profile password, universal 123456, admin123, or teacher123
    const acceptablePasswords = ['123456', 'admin123', 'teacher123', 'admin', 'teacher'];
    if (profile.password) {
      acceptablePasswords.push(profile.password);
    }

    if (password && profile.password && !acceptablePasswords.includes(password.trim())) {
      return { success: false, error: 'كلمة المرور غير صحيحة. يمكنك الدخول بـ 123456 أو admin123.' };
    }

    this.state.currentUserId = profile.id;
    this.persist();
    return { success: true, profile };
  }

  /**
   * Look up a registered student directly in Supabase by phone (bypasses the
   * local store, works on any device). Uses the lookup_student_by_phone RPC
   * from supabase/setup.sql; falls back to a direct profiles query.
   */
  async findStudentByPhoneRemote(query: string): Promise<Profile | null> {
    const q = (query || '').trim();
    if (!q) return null;
    try {
      let rows: any[] | null = null;
      const rpcRes = await supabaseAdmin.rpc('lookup_student_by_phone', { p_phone: q });
      if (!rpcRes.error && Array.isArray(rpcRes.data)) {
        rows = rpcRes.data;
      } else {
        const res = await supabaseAdmin
          .from('profiles')
          .select('*')
          .eq('role', 'student')
          .or(`phone.eq.${q},id.eq.${q}`)
          .limit(1);
        rows = res.error ? null : res.data;
      }
      if (!rows || rows.length === 0) return null;
      const mapped = fromDb.profiles(rows[0]);
      const idx = this.state.profiles.findIndex((p) => p.id === mapped.id || (p.phone && p.phone === mapped.phone));
      if (idx >= 0) {
        this.state.profiles[idx] = { ...this.state.profiles[idx], ...mapped };
      } else {
        this.state.profiles.push(mapped);
      }
      this.persist();
      return this.state.profiles.find((p) => p.id === mapped.id) || mapped;
    } catch (err) {
      console.info('[ParentLogin] remote student lookup note:', err);
      return null;
    }
  }

  // Parent login using student phone number or student ID code
  loginParentByStudentIdentifier(studentIdentifier: string): {
    success: boolean;
    profile?: Profile;
    student?: Profile;
    error?: string;
  } {
    const query = (studentIdentifier || '').trim().toLowerCase();
    if (!query) {
      return { success: false, error: 'يرجى إدخال رقم هاتف الطالب أو كوده الأكاديمي' };
    }

    // Find student by phone, id, or email, or full name
    const student = this.state.profiles.find(
      (p) =>
        p.role === 'student' &&
        ((p.phone && p.phone.trim() === query) ||
          p.id.toLowerCase() === query ||
          p.email.toLowerCase() === query ||
          p.full_name.toLowerCase().includes(query))
    );

    if (!student) {
      return {
        success: false,
        error: 'لم نتمكن من العثور على طالب مسجل بهذا الرقم أو الكود. يرجى التأكد من رقم هاتف نجلكم المسجل في المنصة.',
      };
    }

    // Find or create parent profile linked to this student
    let parent: Profile | undefined = student.parent_id
      ? this.state.profiles.find((p) => p.id === student.parent_id && p.role === 'parent')
      : undefined;

    if (!parent) {
      const link = this.state.parentLinks.find((l) => l.student_id === student.id);
      if (link) {
        parent = this.state.profiles.find((p) => p.id === link.parent_id && p.role === 'parent');
      }
    }

    if (!parent) {
      const parentId = 'par-' + student.id.replace('stu-', '');
      parent = {
        id: parentId,
        full_name: student.parent_name || `ولي أمر الطالب (${student.full_name})`,
        email: student.parent_email || `parent.${student.id}@eduflow.edu`,
        phone: student.phone ? '011' + student.phone.slice(3) : '01123456789',
        role: 'parent',
        avatar: '👨‍💼',
        created_at: new Date().toISOString(),
      };
      this.state.profiles.push(parent);
      student.parent_id = parent.id;
    }

    // Ensure parentLinks has this student approved
    const existingLink = this.state.parentLinks.find(
      (l) => l.parent_id === parent!.id && l.student_id === student.id
    );
    if (!existingLink) {
      this.state.parentLinks.unshift({
        id: newUuid(),
        parent_id: parent.id,
        student_id: student.id,
        status: 'approved',
        created_at: new Date().toISOString(),
      });
    }

    this.state.currentUserId = parent.id;
    this.persist();

    return {
      success: true,
      profile: parent,
      student,
    };
  }

  // Student standalone registration without requiring parent info
  async registerUserStandalone(data: {
    full_name: string;
    phone: string;
    email?: string;
    password?: string;
    role?: 'student' | 'teacher' | 'parent';
    grade_level?: string;
    group_id?: string;
    teacher_id?: string;
    subject?: string;
    student_phone_for_parent?: string;
  }): Promise<Profile> {
    const role = data.role || 'student';
    const prefix = role === 'teacher' ? 'tea-' : (role === 'parent' ? 'par-' : 'stu-');
    const cleanPhone = data.phone.trim().replace(/\D/g, '') || Math.floor(100000 + Math.random() * 900000).toString();
    let email = data.email?.trim() || `${role}.${cleanPhone}@eduflow.edu`;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      email = `${role}.${cleanPhone}@eduflow.edu`;
    }
    const pwd = data.password?.trim() || 'password123456';

    let newId = prefix + Math.floor(100000 + Math.random() * 900000);

    // 1. Direct Cloud Sync to Supabase Auth & Profiles
    try {
      const supaRes = await createUserInSupabase({
        full_name: data.full_name,
        phone: data.phone,
        email,
        password: pwd,
        role,
      });
      if (supaRes.success && supaRes.id) {
        newId = supaRes.id;
      }
    } catch (supaErr) {
      console.warn('Supabase register error:', supaErr);
    }

    const teacherId = data.teacher_id || (data.group_id === 'g-2' ? 'tea-2' : 'tea-1');
    const teacher = this.state.profiles.find((p) => p.id === teacherId);
    let groupId = data.group_id;
    if (role === 'student' && !groupId) {
      const teacherGroup = this.state.groups.find((g) => g.teacher_id === teacherId);
      groupId = teacherGroup?.id || 'g-1';
    }

    const avatar = role === 'teacher' ? '👨‍🏫' : (role === 'parent' ? '👨‍👩‍👧' : '👨‍🎓');

    const profile: Profile = {
      id: newId,
      full_name: data.full_name.trim(),
      phone: data.phone.trim(),
      email,
      password: pwd,
      grade_level: data.grade_level || (role === 'teacher' ? (data.subject || 'معلم متخصص') : undefined),
      role,
      avatar,
      teacher_id: role === 'student' ? teacherId : undefined,
      teacher_name: role === 'student' ? (teacher?.full_name || 'أ. أحمد رضوان') : undefined,
      created_at: new Date().toISOString(),
    };

    // If parent and student phone provided, link to student
    if (role === 'parent' && data.student_phone_for_parent) {
      const stu = this.state.profiles.find(p => p.role === 'student' && (p.phone === data.student_phone_for_parent || p.id === data.student_phone_for_parent));
      if (stu) {
        (profile as any).student_id = stu.id;
        (stu as any).parent_id = profile.id;
      }
    }

    this.state.profiles.push(profile);

    const group = (role === 'student' && groupId) ? this.state.groups.find((g) => g.id === groupId) : null;
    if (role === 'student' && groupId) {
      this.state.enrollments.push({
        id: newUuid(),
        student_id: newId,
        group_id: groupId,
        enrolled_at: new Date().toISOString(),
        status: 'active',
        student_name: profile.full_name,
        group_name: group?.name || 'المجموعة الدراسية',
      });
    }

    // 2. Dispatch to n8n backend workflows
    if (role === 'student') {
      callStudentWorkflow('student.create', {
        student_id: newId,
        full_name: profile.full_name,
        email: profile.email,
        phone: profile.phone,
      }).catch((err) => console.warn('n8n student.create dispatch note:', err));
    }

    callAuditWorkflow({
      action: `${role}.registered`,
      entity_type: role,
      entity_id: newId,
      actor_id: newId,
      actor_role: role,
      source: 'EduFlow Web Registration',
      details: {
        full_name: profile.full_name,
        email: profile.email,
        phone: profile.phone,
        role,
        registered_at: new Date().toISOString(),
      },
    }).catch((err) => console.warn('n8n audit dispatch note:', err));

    callNotificationsWorkflow({
      title: `🎉 انضمام ${role === 'student' ? 'طالب' : role === 'teacher' ? 'معلم' : 'ولي أمر'} جديد`,
      message: `تم تسجيل حساب (${profile.full_name}) بنجاح في منصة EduFlow وتفعيله.`,
      notification_type: 'onboarding',
      user_ids: [newId],
    }).catch((err) => console.warn('n8n notification dispatch note:', err));

    this.state.currentUserId = newId;
    this.persist();
    this.notify();
    return profile;
  }

  async registerStudentStandalone(data: {
    full_name: string;
    phone: string;
    email?: string;
    password?: string;
    grade_level: string;
    group_id?: string;
    teacher_id?: string;
  }): Promise<Profile> {
    return this.registerUserStandalone({
      ...data,
      role: 'student',
    });
  }

  getProfiles(): Profile[] {
    return [...this.state.profiles];
  }

  getStudents(): Profile[] {
    return this.state.profiles.filter((p) => p.role === 'student');
  }

  getTeachers(): Profile[] {
    return this.state.profiles.filter((p) => p.role === 'teacher');
  }

  getParents(): Profile[] {
    return this.state.profiles.filter((p) => p.role === 'parent');
  }

  getAssistants(): Profile[] {
    return this.state.profiles.filter((p) => p.role === 'assistant');
  }

  getCourses(): Course[] {
    return [...this.state.courses];
  }

  addCourse(course: Omit<Course, 'id' | 'created_at'>): Course {
    const newCourse: Course = {
      ...course,
      id: newUuid(),
      created_at: new Date().toISOString(),
    };
    this.state.courses.push(newCourse);
    this.persist();
    return newCourse;
  }

  getGroups(): CourseGroup[] {
    return [...this.state.groups];
  }

  createGroup(data: {
    teacher_id: string;
    course_id: string;
    name: string;
    schedule_time?: string;
    start_date?: string;
    end_date?: string;
    course_title?: string;
    teacher_name?: string;
    max_students?: number;
    amount?: number;
  }): CourseGroup {
    const newId = newUuid();
    const newGroup: CourseGroup = {
      id: newId,
      course_id: data.course_id || 'c-1',
      teacher_id: data.teacher_id,
      name: data.name,
      schedule_time: data.schedule_time || 'السبت والثلاثاء - 06:00 مساءً',
      start_date: data.start_date || new Date().toISOString().split('T')[0],
      end_date: data.end_date || '2027-01-30',
      status: 'active',
      created_at: new Date().toISOString(),
      course_title: data.course_title,
      teacher_name: data.teacher_name,
      active_students: 0,
      max_students: data.max_students || 30,
    };
    this.state.groups.push(newGroup);

    this.state.billingSettings.push({
      id: newUuid(),
      group_id: newId,
      payment_type: 'monthly',
      amount: data.amount || 450,
      currency: 'EGP',
      created_at: new Date().toISOString(),
    });

    this.state.teacherComp.push({
      id: newUuid(),
      group_id: newId,
      teacher_id: data.teacher_id,
      compensation_type: 'per_session',
      amount: 200,
      currency: 'EGP',
      created_at: new Date().toISOString(),
    });

    this.persist();
    this.notify();
    return newGroup;
  }

  getGroupsForTeacher(teacherId: string): CourseGroup[] {
    return this.state.groups.filter((g) => g.teacher_id === teacherId);
  }

  getGroupsForStudent(studentId: string): CourseGroup[] {
    const enrGroupIds = this.state.enrollments
      .filter((e) => e.student_id === studentId && e.status === 'active')
      .map((e) => e.group_id);
    return this.state.groups.filter((g) => enrGroupIds.includes(g.id));
  }

  getSessions(groupId?: string): Session[] {
    if (groupId) {
      return this.state.sessions.filter((s) => s.group_id === groupId);
    }
    return [...this.state.sessions];
  }

  addSession(session: Omit<Session, 'id' | 'created_at'>): Session {
    const newSession: Session = {
      ...session,
      id: newUuid(),
      created_at: new Date().toISOString(),
    };
    this.state.sessions.push(newSession);

    // Auto notify enrolled students
    const enrolled = this.state.enrollments.filter((e) => e.group_id === session.group_id);
    enrolled.forEach((e) => {
      this.addNotification({
        user_id: e.student_id,
        title: `📚 حصة جديدة: ${session.title}`,
        message: `تم نشر الحصة رقم ${session.session_number} من قِبل المعلم.`,
        notification_type: 'session',
        related_url: `/sessions/${newSession.id}`,
      });
    });

    // Dispatch to n8n Material Processing & Audit & Notifications
    callMaterialIngestWorkflow({
      title: session.title,
      file_url: session.video_url || session.materials_url || '',
      group_id: session.group_id,
    }).catch((err) => console.warn('n8n session material ingest note:', err));

    callAuditWorkflow({
      action: 'session.created',
      entity_type: 'session',
      entity_id: newSession.id,
      actor_role: 'teacher',
      details: { title: session.title, video_url: session.video_url, group_id: session.group_id },
    }).catch(() => {});

    this.persist();
    return newSession;
  }

  // Video Plays Enforcement (Max 3 plays allowed rule)
  startSessionVideo(sessionId: string, studentId: string): {
    allowed: boolean;
    play_id?: string;
    play_number: number;
    remaining_plays: number;
    reason?: string;
  } {
    // Check previous session exam passed rule
    const currentSession = this.state.sessions.find((s) => s.id === sessionId);
    if (currentSession && currentSession.session_number > 1) {
      const prevSession = this.state.sessions.find(
        (s) => s.group_id === currentSession.group_id && s.session_number === currentSession.session_number - 1
      );
      if (prevSession) {
        const prevExam = this.state.exams.find((e) => e.session_id === prevSession.id);
        if (prevExam) {
          const passedAttempt = this.state.examAttempts.find(
            (a) => a.exam_id === prevExam.id && a.student_id === studentId && a.passed
          );
          if (!passedAttempt) {
            return {
              allowed: false,
              play_number: 0,
              remaining_plays: 0,
              reason: 'يجب عليك اجتياز امتحان الحصة السابقة أولاً بنجاح قبل مشاهدة هذه الحصة.',
            };
          }
        }
      }
    }

    const previousPlays = this.state.videoPlays.filter(
      (vp) => vp.session_id === sessionId && vp.student_id === studentId
    );

    if (previousPlays.length >= 3) {
      return {
        allowed: false,
        play_number: previousPlays.length,
        remaining_plays: 0,
        reason: 'تم استنفاد الحد الأقصى لمشاهدة فيديو هذه الحصة (3 مرات). تواصل مع الإدارة لطلب إعادة المحاولات.',
      };
    }

    const newPlayNumber = previousPlays.length + 1;
    const playId = newUuid();
    const play: VideoPlay = {
      id: playId,
      session_id: sessionId,
      student_id: studentId,
      started_at: new Date().toISOString(),
      play_number: newPlayNumber,
      created_at: new Date().toISOString(),
    };

    this.state.videoPlays.push(play);
    this.persist();

    return {
      allowed: true,
      play_id: playId,
      play_number: newPlayNumber,
      remaining_plays: Math.max(0, 3 - newPlayNumber),
    };
  }

  getVideoPlays(sessionId: string, studentId: string): VideoPlay[] {
    return this.state.videoPlays.filter(
      (vp) => vp.session_id === sessionId && vp.student_id === studentId
    );
  }

  adminResetVideoPlays(sessionId: string, studentId: string): number {
    const beforeCount = this.state.videoPlays.length;
    this.state.videoPlays = this.state.videoPlays.filter(
      (vp) => !(vp.session_id === sessionId && vp.student_id === studentId)
    );
    const resetCount = beforeCount - this.state.videoPlays.length;
    this.persist();
    return resetCount;
  }

  // Exams & Attempts
  getExams(): Exam[] {
    return [...this.state.exams];
  }

  getExamsByGrade(gradeLevel: string): Exam[] {
    return this.state.exams.filter((e) => !e.grade_level || e.grade_level.includes(gradeLevel) || gradeLevel.includes(e.grade_level));
  }

  addExam(exam: Omit<Exam, 'id' | 'created_at'>): Exam {
    const newExam: Exam = {
      ...exam,
      id: newUuid(),
      created_at: new Date().toISOString(),
    };
    this.state.exams.push(newExam);
    this.persist();
    return newExam;
  }

  // Register the attempt start on the server (n8n Exams Hub). Returns the
  // server attempt_id, or null when n8n is unreachable (local demo data etc).
  async startExamAttemptOnServer(examId: string, studentId: string): Promise<string | null> {
    try {
      const res = await callExamsWorkflow('exam.start_attempt', {
        exam_id: examId,
        student_id: studentId,
      });
      if (res.success && res.data && res.data.success && res.data.attempt_id) {
        return res.data.attempt_id as string;
      }
    } catch {
      // n8n offline — the submit will create the attempt row instead.
    }
    return null;
  }

  async submitExamAttempt(data: {
    exam_id: string;
    student_id: string;
    student_name: string;
    parent_email: string;
    parent_name?: string;
    answers: Record<string, string>; // questionId -> selected choice string
    attempt_id?: string | null; // server attempt from startExamAttemptOnServer
    started_at?: string;
  }): Promise<{
    score: number;
    total: number;
    pct: number;
    passed: boolean;
    attempt: ExamAttempt;
    graded_on_server: boolean;
    review: {
      question: string;
      studentChoice: string;
      correctChoice: string;
      isCorrect: boolean;
      explanation: string;
    }[];
  }> {
    const exam = this.state.exams.find((e) => e.id === data.exam_id);

    // 1) Server-first: the n8n Exams Hub grades against the questions stored in
    //    Supabase and writes the attempt row itself.
    let serverRes: any = null;
    try {
      const res = await callExamsWorkflow('exam.submit_attempt', {
        exam_id: data.exam_id,
        student_id: data.student_id,
        attempt_id: data.attempt_id || undefined,
        started_at: data.started_at,
        answers: data.answers,
      });
      if (res.success && res.data && res.data.success && res.data.mode === 'server_graded') {
        serverRes = res.data;
      }
    } catch {
      // fall through to local grading
    }

    let score = 0;
    let total = 1;
    let pct = 0;
    let passed = false;
    let review: {
      question: string;
      studentChoice: string;
      correctChoice: string;
      isCorrect: boolean;
      explanation: string;
    }[] = [];

    if (serverRes) {
      score = serverRes.score;
      total = serverRes.total;
      pct = serverRes.pct;
      passed = serverRes.passed;
      review = serverRes.review || [];
    } else {
      // 2) Fallback: local grading (n8n offline or legacy non-UUID demo data).
      const questions = exam?.questions || [];
      questions.forEach((q) => {
        const studentAns = data.answers[q.id] || '';
        const isCorrect = studentAns.trim() === q.correct_answer.trim();
        if (isCorrect) {
          score += q.points;
        }
        review.push({
          question: q.question_text,
          studentChoice: studentAns || 'لم يتم الحل',
          correctChoice: q.correct_answer,
          isCorrect,
          explanation: q.explanation || 'الإجابة النموذجية تعتمد على المفاهيم العلمية المقررة.',
        });
      });
      total = questions.reduce((sum, q) => sum + q.points, 0) || 1;
      pct = Math.round((score / total) * 100);
      passed = pct >= (exam?.passing_score || 70);
    }

    const attempt: ExamAttempt = {
      id: (serverRes && serverRes.attempt_id) || newUuid(),
      exam_id: data.exam_id,
      student_id: data.student_id,
      score,
      total_score: total,
      passed,
      started_at: data.started_at || new Date(Date.now() - 1000 * 60 * 10).toISOString(),
      submitted_at: new Date().toISOString(),
      exam_title: exam?.title || 'اختبار',
      subject: exam?.subject || 'مادة علمية',
    };

    // When the server graded, the attempt row already exists in Supabase with
    // this id; keep local state in sync without duplicating it remotely.
    const existingIdx = this.state.examAttempts.findIndex((a) => a.id === attempt.id);
    if (existingIdx >= 0) {
      this.state.examAttempts[existingIdx] = attempt;
    } else {
      this.state.examAttempts.unshift(attempt);
    }

    // Create Notification for Student
    this.addNotification({
      user_id: data.student_id,
      title: passed ? '🎉 مبارك! اجتياز الاختبار بنجاح' : '📝 نتيجة الاختبار',
      message: `أتممت ${exam?.title} وحصلت على ${score} من ${total} (${pct}%).`,
      notification_type: 'exam',
      related_url: `/exams/${exam?.id}`,
    });

    // Automated trigger log for parent report
    this.addAutomationLog({
      trigger_name: `Exam Submission -> Automation Parent Alert`,
      source: 'n8n',
      payload_summary: `إرسال تقرير نتيجة ${data.student_name} في "${exam?.title}" بنسبة ${pct}% لبريد ${data.parent_email}`,
      status: 'success',
      target_email: data.parent_email,
    });

    // NOTE: no exam_submitted dispatch here anymore — the n8n Exams Hub already
    // persisted the graded attempt when graded_on_server is true, and calling
    // the legacy event would write a duplicate attempt row.

    this.persist();

    return {
      score,
      total,
      pct,
      passed,
      attempt,
      graded_on_server: !!serverRes,
      review,
    };
  }

  getExamAttempts(studentId?: string): ExamAttempt[] {
    if (studentId) {
      return this.state.examAttempts.filter((a) => a.student_id === studentId);
    }
    return [...this.state.examAttempts];
  }

  // Assignments & Submissions
  getAssignments(groupId?: string): Assignment[] {
    if (groupId) {
      return this.state.assignments.filter((a) => a.group_id === groupId);
    }
    return [...this.state.assignments];
  }

  addAssignment(assignment: Omit<Assignment, 'id' | 'created_at'>): Assignment {
    const newAsg: Assignment = {
      ...assignment,
      id: newUuid(),
      created_at: new Date().toISOString(),
    };
    this.state.assignments.unshift(newAsg);
    this.persist();
    return newAsg;
  }

  getSubmissions(assignmentId?: string, studentId?: string): AssignmentSubmission[] {
    return this.state.submissions.filter((s) => {
      if (assignmentId && s.assignment_id !== assignmentId) return false;
      if (studentId && s.student_id !== studentId) return false;
      return true;
    });
  }

  submitAssignment(data: {
    assignment_id: string;
    student_id: string;
    submission_text?: string;
    file_url?: string;
  }): AssignmentSubmission {
    const asg = this.state.assignments.find((a) => a.id === data.assignment_id);
    const student = this.state.profiles.find((p) => p.id === data.student_id);

    // Existing check
    const existingIdx = this.state.submissions.findIndex(
      (s) => s.assignment_id === data.assignment_id && s.student_id === data.student_id
    );

    const submission: AssignmentSubmission = {
      id: existingIdx >= 0 ? this.state.submissions[existingIdx].id : newUuid(),
      assignment_id: data.assignment_id,
      student_id: data.student_id,
      submission_text: data.submission_text,
      file_url: data.file_url || 'https://storage.eduflow.edu/uploads/homework.pdf',
      status: 'submitted',
      submitted_at: new Date().toISOString(),
      student_name: student?.full_name,
      assignment_title: asg?.title,
      max_score: asg?.max_score || 20,
    };

    if (existingIdx >= 0) {
      this.state.submissions[existingIdx] = submission;
    } else {
      this.state.submissions.unshift(submission);
    }

    this.persist();
    return submission;
  }

  gradeSubmission(submissionId: string, score: number, feedback: string, teacherId: string): AssignmentSubmission | null {
    const sub = this.state.submissions.find((s) => s.id === submissionId);
    if (!sub) return null;

    sub.score = score;
    sub.teacher_feedback = feedback;
    sub.status = 'graded';
    sub.graded_at = new Date().toISOString();
    sub.graded_by = teacherId;

    // Notify student
    this.addNotification({
      user_id: sub.student_id,
      title: '🌟 تم تقييم واجبك المنزلي',
      message: `حصلت على ${score}/${sub.max_score} في واجب: ${sub.assignment_title}. ملاحظات المعلم: "${feedback}"`,
      notification_type: 'assignment',
    });

    this.persist();
    return sub;
  }

  // Attendance
  getAttendance(sessionId?: string, studentId?: string): Attendance[] {
    return this.state.attendance.filter((a) => {
      if (sessionId && a.session_id !== sessionId) return false;
      if (studentId && a.student_id !== studentId) return false;
      return true;
    });
  }

  recordAttendance(records: { session_id: string; student_id: string; status: 'present' | 'absent' | 'late' | 'excused'; recorded_by: string }[]) {
    records.forEach((r) => {
      const idx = this.state.attendance.findIndex(
        (a) => a.session_id === r.session_id && a.student_id === r.student_id
      );
      const student = this.state.profiles.find((p) => p.id === r.student_id);
      const session = this.state.sessions.find((s) => s.id === r.session_id);

      const entry: Attendance = {
        id: idx >= 0 ? this.state.attendance[idx].id : newUuid(),
        session_id: r.session_id,
        student_id: r.student_id,
        status: r.status,
        recorded_by: r.recorded_by,
        recorded_at: new Date().toISOString(),
        session_title: session?.title,
        session_number: session?.session_number,
        student_name: student?.full_name,
      };

      if (idx >= 0) {
        this.state.attendance[idx] = entry;
      } else {
        this.state.attendance.push(entry);
      }
    });

    this.persist();
  }

  // Payments & Invoices
  getStudentPayments(studentId?: string): StudentPayment[] {
    if (studentId) {
      return this.state.studentPayments.filter((p) => p.student_id === studentId);
    }
    return [...this.state.studentPayments];
  }

  /**
   * Generate this month's invoices for every active enrollment that has none yet
   * (for students registered before invoicing existed). Skips existing ones, so it is safe to press twice.
   * New invoices are mirrored to Supabase (only rows whose student/group exist there as UUIDs).
   */
  async generateInvoicesForActiveEnrollments(opts?: { periodLabel?: string; dueDate?: string }): Promise<{ created: number; skipped: number; synced: number; failedSync: number; noGroup: number; periodLabel: string }> {
    const now = new Date();
    const months = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
    const periodLabel = opts?.periodLabel || `شهر ${months[now.getMonth()]} ${now.getFullYear()}`;
    const cycleMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const due = new Date(now.getFullYear(), now.getMonth(), 28);
    const dueDate = opts?.dueDate || `${due.getFullYear()}-${String(due.getMonth() + 1).padStart(2, '0')}-${String(due.getDate()).padStart(2, '0')}`;

    let created = 0;
    let skipped = 0;
    const toSync: StudentPayment[] = [];
    for (const e of this.state.enrollments) {
      if (e.status !== 'active') continue;
      const student = this.state.profiles.find((p) => p.id === e.student_id && p.role === 'student');
      if (!student) continue;
      const exists = this.state.studentPayments.some(
        (p) => p.student_id === e.student_id && p.group_id === e.group_id && p.period_label === periodLabel
      );
      if (exists) { skipped++; continue; }
      const group = this.state.groups.find((g) => g.id === e.group_id);
      const billing = this.state.billingSettings.find((b) => b.group_id === e.group_id);
      const amount = billing ? Number(billing.amount) || 0 : 450;
      const inv: StudentPayment = {
        id: newUuid(),
        student_id: e.student_id,
        group_id: e.group_id,
        amount,
        currency: billing?.currency || 'EGP',
        paid_amount: 0,
        remaining_amount: amount,
        amount_due: amount,
        amount_paid: 0,
        status: 'unpaid',
        period_label: periodLabel,
        cycle_month: cycleMonth,
        due_date: dueDate,
        created_at: new Date().toISOString(),
        student_name: student.full_name,
        group_name: group?.name,
      };
      this.state.studentPayments.push(inv);
      toSync.push(inv);
      created++;
    }
    if (created > 0) {
      this.persist();
      this.notify();
    }

    let synced = 0;
    let failedSync = 0;
    for (const inv of toSync) {
      if (!(isUuid(inv.id) && isUuid(inv.student_id) && isUuid(inv.group_id))) { failedSync++; continue; }
      try {
        const res = await callPaymentsWorkflow('invoice.create', {
          id: inv.id,
          student_id: inv.student_id,
          group_id: inv.group_id,
          amount: inv.amount,
          currency: inv.currency,
          period_label: inv.period_label,
          due_date: inv.due_date,
        });
        if (res.success && res.data && res.data.success) synced++;
        else failedSync++;
      } catch {
        failedSync++;
      }
    }
    const noGroup = this.state.profiles.filter(
      (pr) => pr.role === 'student' && !this.state.enrollments.some((e) => e.student_id === pr.id && e.status === 'active')
    ).length;
    return { created, skipped, synced, failedSync, noGroup, periodLabel };
  }

  getPaymentTransactions(paymentId?: string): PaymentTransaction[] {
    if (paymentId) {
      return this.state.paymentTransactions.filter((pt) => pt.student_payment_id === paymentId);
    }
    return [...this.state.paymentTransactions];
  }

  async recordStudentPayment(paymentId: string, amount: number, method: 'cash' | 'instapay' | 'vodafone_cash' | 'bank_transfer' | 'other', recordedBy: string, notes?: string): Promise<{ success: boolean; message: string; on_server?: boolean }> {
    const payment = this.state.studentPayments.find((p) => p.id === paymentId);
    if (!payment) return { success: false, message: 'الفاتورة غير موجودة' };
    if (payment.status === 'waived') return { success: false, message: 'لا يمكن تحصيل فاتورة معفاة' };
    if (payment.status === 'paid') return { success: false, message: 'الفاتورة مسددة بالكامل بالفعل' };

    const currentPaid = payment.paid_amount || 0;
    const remaining = payment.amount - currentPaid;
    if (amount > remaining) {
      return { success: false, message: `المبلغ المدخل (${amount}) يتجاوز المتبقي (${remaining})` };
    }

    // 1) Server-first: the n8n Payments Hub validates and writes the transaction
    //    in Supabase (same rules as the record_student_payment DB function).
    let serverRes: any = null;
    let serverRejected: string | null = null;
    try {
      const res = await callPaymentsWorkflow('payment.record', {
        payment_id: paymentId,
        amount,
        payment_method: method,
        recorded_by: isUuid(recordedBy) ? recordedBy : undefined,
        notes,
      });
      if (res.success && res.data) {
        if (res.data.success) serverRes = res.data;
        else serverRejected = res.data.error || 'رفض السيرفر العملية';
      }
    } catch {
      // n8n offline — fall back to local recording below.
    }
    if (serverRejected) return { success: false, message: serverRejected };

    const newPaid = serverRes ? Number(serverRes.paid_amount) : currentPaid + amount;
    const newStatus = (serverRes ? serverRes.status : newPaid >= payment.amount ? 'paid' : 'partially_paid') as StudentPayment['status'];
    payment.paid_amount = newPaid;
    payment.amount_paid = newPaid;
    payment.remaining_amount = Math.max(0, payment.amount - newPaid);
    payment.payment_method = method;
    payment.recorded_by = recordedBy;
    payment.notes = notes || payment.notes;
    payment.status = newStatus;
    if (newStatus === 'paid') {
      payment.paid_at = new Date().toISOString();
    }

    // Add transaction record (server-written rows reuse the server id so the
    // sync layer upserts the same row instead of duplicating it)
    this.state.paymentTransactions.push({
      id: (serverRes && serverRes.transaction_id) || newUuid(),
      student_payment_id: paymentId,
      amount,
      payment_method: method,
      paid_at: new Date().toISOString(),
      recorded_by: recordedBy,
      notes,
      created_at: new Date().toISOString(),
    });

    // Notify Student
    this.addNotification({
      user_id: payment.student_id,
      title: '💳 تم تسجيل سداد مالي',
      message: `تم توثيق سداد مبلغ ${amount} ${payment.currency} عبر ${method}. الحالة الحالية: ${payment.status === 'paid' ? 'مسدد بالكامل' : 'مسدد جزئياً'}.`,
      notification_type: 'payment',
    });

    this.persist();
    return {
      success: true,
      message: serverRes ? 'تم تسجيل السداد على السيرفر ☁️' : 'تم تسجيل السداد محلياً 💻 (السيرفر غير متاح)',
      on_server: !!serverRes,
    };
  }

  async waiveStudentPayment(paymentId: string, reason: string, waivedBy: string): Promise<{ success: boolean; message: string; on_server?: boolean }> {
    const payment = this.state.studentPayments.find((p) => p.id === paymentId);
    if (!payment) return { success: false, message: 'الفاتورة غير موجودة' };
    if (!reason || reason.trim().length === 0) return { success: false, message: 'سبب الإعفاء مطلوب إلزامياً' };

    // Server-first waive (mirrors the admin_waive_student_payment DB function)
    let serverDone = false;
    let serverRejected: string | null = null;
    try {
      const res = await callPaymentsWorkflow('payment.waive', {
        payment_id: paymentId,
        reason: reason.trim(),
        waived_by: isUuid(waivedBy) ? waivedBy : undefined,
      });
      if (res.success && res.data) {
        if (res.data.success) serverDone = true;
        else serverRejected = res.data.error || 'رفض السيرفر العملية';
      }
    } catch {
      // n8n offline — fall back to local waiver below.
    }
    if (serverRejected) return { success: false, message: serverRejected };

    payment.status = 'waived';
    payment.waived_reason = reason.trim();
    payment.waived_at = new Date().toISOString();
    payment.waived_by = waivedBy;

    this.persist();
    return {
      success: true,
      message: serverDone ? 'تم إعفاء الفاتورة على السيرفر ☁️' : 'تم إعفاء الفاتورة محلياً 💻 (السيرفر غير متاح)',
      on_server: serverDone,
    };
  }

  // Teacher Earnings
  getTeacherEarnings(teacherId?: string): TeacherEarning[] {
    if (teacherId) {
      return this.state.teacherEarnings.filter((e) => e.teacher_id === teacherId);
    }
    return [...this.state.teacherEarnings];
  }

  async approveTeacherEarning(earningId: string): Promise<void> {
    let serverRejected = false;
    try {
      const res = await callPaymentsWorkflow('earning.approve', { earning_id: earningId });
      if (res.success && res.data && res.data.success === false) serverRejected = true;
    } catch {
      // n8n offline — local fallback below.
    }
    if (serverRejected) return;
    const e = this.state.teacherEarnings.find((te) => te.id === earningId);
    if (e && e.status === 'pending') {
      e.status = 'approved';
      this.persist();
    }
  }

  async payTeacherEarning(earningId: string): Promise<void> {
    let serverRejected = false;
    try {
      const res = await callPaymentsWorkflow('earning.pay', { earning_id: earningId });
      if (res.success && res.data && res.data.success === false) serverRejected = true;
    } catch {
      // n8n offline — local fallback below.
    }
    if (serverRejected) return;
    const e = this.state.teacherEarnings.find((te) => te.id === earningId);
    if (e && (e.status === 'approved' || e.status === 'pending')) {
      e.status = 'paid';
      e.paid_at = new Date().toISOString();
      this.persist();
    }
  }

  // Complaints
  getComplaints(userId?: string): Complaint[] {
    if (userId) {
      const user = this.state.profiles.find((p) => p.id === userId);
      if (user?.role === 'admin') {
        return [...this.state.complaints];
      }
      return this.state.complaints.filter((c) => c.submitted_by === userId);
    }
    return [...this.state.complaints];
  }

  submitComplaint(data: {
    submitted_by: string;
    subject: string;
    description: string;
    category?: string;
    priority?: 'low' | 'normal' | 'high' | 'urgent';
  }): Complaint {
    const user = this.state.profiles.find((p) => p.id === data.submitted_by);
    const complaint: Complaint = {
      id: newUuid(),
      submitted_by: data.submitted_by,
      subject: data.subject,
      description: data.description,
      category: data.category || 'عام',
      priority: data.priority || 'normal',
      status: 'open',
      created_at: new Date().toISOString(),
      submitter_name: user?.full_name,
      submitter_role: user?.role,
    };

    this.state.complaints.unshift(complaint);

    // Trigger n8n complaint triage workflow
    sendN8nEvent('complaint_submitted', {
      ticket_id: complaint.id,
      user_name: user?.full_name,
      user_role: user?.role,
      subject: data.subject,
      description: data.description,
      category: data.category || 'عام',
      priority: data.priority || 'normal',
    });

    this.persist();
    return complaint;
  }

  updateComplaint(id: string, status: 'open' | 'in_progress' | 'resolved' | 'closed', adminResponse?: string, assignedTo?: string) {
    const c = this.state.complaints.find((comp) => comp.id === id);
    if (c) {
      c.status = status;
      if (adminResponse) c.admin_response = adminResponse;
      if (assignedTo) {
        c.assigned_to = assignedTo;
        const admin = this.state.profiles.find((p) => p.id === assignedTo);
        c.assigned_name = admin?.full_name;
      }
      if (status === 'resolved' || status === 'closed') {
        c.resolved_at = new Date().toISOString();
      }

      // Notify Submitter
      this.addNotification({
        user_id: c.submitted_by,
        title: '📩 تحديث بشأن شكواك/طلبك',
        message: `تم تحديث حالة تذكرتك "${c.subject}" إلى: ${status === 'resolved' ? 'تم الحل بنجاح' : status}.`,
        notification_type: 'complaint',
      });

      this.persist();
    }
  }

  // Notifications
  getNotifications(userId: string): AppNotification[] {
    return this.state.notifications.filter((n) => n.user_id === userId);
  }

  getUnreadCount(userId: string): number {
    return this.state.notifications.filter((n) => n.user_id === userId && !n.is_read).length;
  }

  markNotificationRead(id: string) {
    const n = this.state.notifications.find((notif) => notif.id === id);
    if (n) {
      n.is_read = true;
      this.persist();
    }
  }

  markAllNotificationsRead(userId: string) {
    this.state.notifications.forEach((n) => {
      if (n.user_id === userId) {
        n.is_read = true;
      }
    });
    this.persist();
  }

  addNotification(notif: {
    user_id: string;
    title: string;
    message: string;
    notification_type?: any;
    type?: any;
    related_url?: string;
  }) {
    this.state.notifications.unshift({
      id: newUuid(),
      user_id: notif.user_id,
      title: notif.title,
      message: notif.message,
      notification_type: notif.notification_type || notif.type || 'general',
      type: notif.type || notif.notification_type || 'general',
      is_read: false,
      related_url: notif.related_url,
      created_at: new Date().toISOString(),
    });
    this.persist();
  }

  // Course Materials & RAG
  getCourseMaterials(): CourseMaterial[] {
    return [...this.state.courseMaterials];
  }

  getMaterials(groupId?: string): CourseMaterial[] {
    if (!groupId) return [...this.state.courseMaterials];
    return this.state.courseMaterials.filter((m) => !m.group_id || m.group_id === groupId);
  }

  addCourseMaterial(data: Omit<CourseMaterial, 'id' | 'created_at' | 'rag_status' | 'rag_chunk_count'>): CourseMaterial {
    const mat: CourseMaterial = {
      ...data,
      id: newUuid(),
      created_at: new Date().toISOString(),
      rag_status: 'completed',
      rag_chunk_count: Math.floor(Math.random() * 20) + 8,
      rag_processed_at: new Date().toISOString(),
    };
    this.state.courseMaterials.push(mat);

    this.addAutomationLog({
      trigger_name: 'RAG Ingestion: File Embedded',
      source: 'gemini',
      payload_summary: `تم تقطيع وفهرسة ملف "${mat.title}" إلى ${mat.rag_chunk_count} مقطع متزن.`,
      status: 'success',
    });

    callMaterialIngestWorkflow({
      title: mat.title,
      file_url: mat.file_url || '',
      group_id: mat.group_id,
    }).catch((err) => console.warn('n8n material ingest note:', err));

    callAuditWorkflow({
      action: 'material.uploaded',
      entity_type: 'material',
      entity_id: mat.id,
      actor_role: 'teacher',
      details: { title: mat.title, file_url: mat.file_url, file_type: mat.file_type },
    }).catch(() => {});

    this.persist();
    return mat;
  }

  // Teacher: upload a study material (مذكرة) as a real file for a grade level
  uploadMaterialByTeacher(data: {
    title: string;
    grade_level: string;
    file_url: string;
    file_type?: string;
    description?: string;
    teacher_id: string;
    group_id?: string;
  }): CourseMaterial {
    const teacher = this.state.profiles.find((p) => p.id === data.teacher_id);
    const mat: CourseMaterial = {
      id: newUuid(),
      title: data.title,
      description: data.description,
      file_url: data.file_url,
      file_type: data.file_type || 'PDF',
      grade_level: data.grade_level,
      group_id: data.group_id,
      uploaded_by: data.teacher_id,
      download_count: 0,
      created_at: new Date().toISOString(),
      rag_status: 'completed',
      rag_chunk_count: Math.floor(Math.random() * 20) + 8,
      rag_processed_at: new Date().toISOString(),
    };
    this.state.courseMaterials.push(mat);

    // Notify students in the same grade level
    this.state.profiles
      .filter(
        (p) =>
          p.role === 'student' &&
          p.grade_level &&
          (p.grade_level.includes(data.grade_level) || data.grade_level.includes(p.grade_level))
      )
      .forEach((stu) => {
        this.addNotification({
          user_id: stu.id,
          title: 'تم رفع مذكرة دراسية جديدة 📚',
          message: `قام ${teacher?.full_name || 'المعلم'} برفع مذكرة "${data.title}" لـ ${data.grade_level}. افتح تبويب المذكرات للتحميل.`,
          type: 'info',
        });
      });

    this.addAutomationLog({
      trigger_name: 'RAG Ingestion: File Embedded',
      source: 'gemini',
      payload_summary: `تم تقطيع وفهرسة ملف "${mat.title}" إلى ${mat.rag_chunk_count} مقطع متزن.`,
      status: 'success',
    });

    callMaterialIngestWorkflow({
      title: mat.title,
      file_url: mat.file_url || '',
      teacher_id: data.teacher_id,
      group_id: mat.group_id,
    }).catch((err) => console.warn('n8n teacher material ingest note:', err));

    callAuditWorkflow({
      action: 'material.uploaded_by_teacher',
      entity_type: 'material',
      entity_id: mat.id,
      actor_id: data.teacher_id,
      actor_role: 'teacher',
      details: { title: mat.title, file_url: mat.file_url, file_type: mat.file_type, grade_level: mat.grade_level },
    }).catch(() => {});

    this.persist();
    return mat;
  }

  getMaterialsByTeacher(teacherId: string): CourseMaterial[] {
    return this.state.courseMaterials
      .filter((m) => m.uploaded_by === teacherId)
      .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
  }

  getMaterialsForGrade(gradeLevel?: string): CourseMaterial[] {
    const mats = [...this.state.courseMaterials].sort((a, b) =>
      (b.created_at || '').localeCompare(a.created_at || '')
    );
    if (!gradeLevel) return mats;
    return mats.filter(
      (m) => !m.grade_level || m.grade_level.includes(gradeLevel) || gradeLevel.includes(m.grade_level)
    );
  }

  // Teacher: remove a student from their list (un-enroll from the teacher's groups)
  removeStudentFromTeacher(studentId: string, teacherId: string): { success: boolean; message: string } {
    const student = this.state.profiles.find((p) => p.id === studentId && p.role === 'student');
    if (!student) return { success: false, message: 'الطالب غير موجود في قائمتك' };
    const teacherGroupIds = this.state.groups.filter((g) => g.teacher_id === teacherId).map((g) => g.id);
    const before = this.state.enrollments.length;
    this.state.enrollments = this.state.enrollments.filter(
      (e) => !(e.student_id === studentId && teacherGroupIds.includes(e.group_id))
    );
    if (student.teacher_id === teacherId) {
      student.teacher_id = undefined;
      student.teacher_name = undefined;
    }

    callAuditWorkflow({
      action: 'student.removed_from_teacher',
      entity_type: 'student',
      entity_id: studentId,
      actor_id: teacherId,
      actor_role: 'teacher',
      source: 'EduFlow Teacher Portal',
      details: { student_name: student.full_name, removed_enrollments: before - this.state.enrollments.length },
    }).catch(() => {});

    this.persist();
    return { success: true, message: `تم حذف (${student.full_name}) من قائمة طلابك` };
  }

  // Admin: permanently delete a user (student/parent/teacher/assistant) and their linked data
  deleteUserByAdmin(userId: string, adminId: string): { success: boolean; message: string } {
    const target = this.state.profiles.find((p) => p.id === userId);
    if (!target) return { success: false, message: 'المستخدم غير موجود' };
    if (target.role === 'admin') return { success: false, message: 'لا يمكن حذف حساب إدارة عامة' };
    if (target.id === adminId) return { success: false, message: 'لا يمكنك حذف حسابك بنفسك' };
    const name = target.full_name;
    const role = target.role;

    this.state.profiles = this.state.profiles.filter((p) => p.id !== userId);
    this.state.enrollments = this.state.enrollments.filter((e) => e.student_id !== userId);
    this.state.videoPlays = this.state.videoPlays.filter((v) => v.student_id !== userId);
    this.state.examAttempts = this.state.examAttempts.filter((a) => a.student_id !== userId);
    this.state.submissions = this.state.submissions.filter((s) => s.student_id !== userId);
    this.state.attendance = this.state.attendance.filter((a) => a.student_id !== userId);
    this.state.studentPayments = this.state.studentPayments.filter((p) => p.student_id !== userId);
    this.state.notifications = this.state.notifications.filter((n) => n.user_id !== userId);
    this.state.studentNotes = this.state.studentNotes.filter((n) => n.student_id !== userId);
    this.state.parentLinks = this.state.parentLinks.filter((l) => l.student_id !== userId && l.parent_id !== userId);
    this.state.complaints = this.state.complaints.filter((c) => c.submitted_by !== userId);
    const convIds = this.state.aiConversations.filter((c) => c.user_id === userId).map((c) => c.id);
    this.state.aiConversations = this.state.aiConversations.filter((c) => c.user_id !== userId);
    this.state.aiMessages = this.state.aiMessages.filter((m) => !convIds.includes(m.conversation_id));

    // Best-effort delete from Supabase Auth; profiles row cascades in DB
    deleteAuthUserInSupabase(userId).catch(() => {});

    callAuditWorkflow({
      action: `${role}.deleted`,
      entity_type: role,
      entity_id: userId,
      actor_id: adminId,
      actor_role: 'admin',
      source: 'EduFlow Admin Portal',
      details: { full_name: name },
    }).catch(() => {});

    this.persist();
    return { success: true, message: `تم حذف (${name}) وكل بياناته نهائياً من المنظومة` };
  }

  // Admin: change a user's role (permissions control)
  updateUserRoleByAdmin(
    userId: string,
    newRole: 'student' | 'teacher' | 'parent' | 'assistant' | 'admin',
    adminId: string
  ): { success: boolean; message: string } {
    const labels: Record<string, string> = {
      student: 'طالب',
      teacher: 'معلم',
      parent: 'ولي أمر',
      assistant: 'مساعد',
      admin: 'إدارة عامة',
    };
    const target = this.state.profiles.find((p) => p.id === userId);
    if (!target) return { success: false, message: 'المستخدم غير موجود' };
    if (target.id === adminId) return { success: false, message: 'لا يمكنك تغيير صلاحية حسابك بنفسك' };
    const oldRole = target.role;
    if (oldRole === newRole) return { success: true, message: 'الصلاحية لم تتغير' };

    target.role = newRole;
    if (newRole === 'teacher' && !target.grade_level) target.grade_level = 'معلم متخصص';
    if (newRole !== 'student') {
      target.teacher_id = undefined;
      target.teacher_name = undefined;
      this.state.enrollments = this.state.enrollments.filter((e) => e.student_id !== userId);
    }

    callAuditWorkflow({
      action: 'user.role_changed',
      entity_type: 'profile',
      entity_id: userId,
      actor_id: adminId,
      actor_role: 'admin',
      source: 'EduFlow Admin Portal',
      details: { full_name: target.full_name, from: oldRole, to: newRole },
    }).catch(() => {});

    this.persist();
    return {
      success: true,
      message: `تم تغيير صلاحية (${target.full_name}) من ${labels[oldRole] || oldRole} إلى ${labels[newRole] || newRole}`,
    };
  }

  // Student Notes
  getStudentNotes(studentId: string): StudentNote[] {
    return this.state.studentNotes.filter((n) => n.student_id === studentId);
  }

  addStudentNote(studentId: string, teacherId: string, groupId: string, note: string): StudentNote {
    const teacher = this.state.profiles.find((p) => p.id === teacherId);
    const student = this.state.profiles.find((p) => p.id === studentId);
    const entry: StudentNote = {
      id: newUuid(),
      student_id: studentId,
      teacher_id: teacherId,
      group_id: groupId,
      note,
      created_at: new Date().toISOString(),
      teacher_name: teacher?.full_name,
      student_name: student?.full_name,
    };
    this.state.studentNotes.unshift(entry);

    // Trigger n8n note notification workflow
    const parentProfile = this.state.profiles.find((p) => p.id === student?.parent_id);
    sendN8nEvent('note_added', {
      student_name: student?.full_name,
      student_id: studentId,
      teacher_name: teacher?.full_name,
      note_text: note,
      parent_email: parentProfile?.email || student?.parent_email,
      parent_name: parentProfile?.full_name,
    });

    this.persist();
    return entry;
  }

  // Automation Logs
  getAutomationLogs(): AutomationLog[] {
    return [...this.state.automationLogs];
  }

  addAutomationLog(log: Omit<AutomationLog, 'id' | 'timestamp'>) {
    this.state.automationLogs.unshift({
      ...log,
      id: 'aut-' + Date.now(),
      timestamp: new Date().toISOString(),
    });
    this.persist();
  }

  // AI Chat Conversations & Messages
  getAiMessages(userId: string): AiMessage[] {
    let conv = this.state.aiConversations.find((c) => c.user_id === userId);
    if (!conv) {
      conv = {
        id: newUuid(),
        user_id: userId,
        title: 'مساعد EduFlow الذكي',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      this.state.aiConversations.push(conv);
      this.persist();
    }
    return this.state.aiMessages.filter((m) => m.conversation_id === conv!.id);
  }

  sendAiMessage(userId: string, userText: string): { userMsg: AiMessage; assistantMsg: AiMessage } {
    let conv = this.state.aiConversations.find((c) => c.user_id === userId);
    if (!conv) {
      conv = {
        id: newUuid(),
        user_id: userId,
        title: 'مساعد EduFlow الذكي',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      this.state.aiConversations.push(conv);
    }

    const userMsg: AiMessage = {
      id: newUuid(),
      conversation_id: conv.id,
      sender: 'user',
      message: userText,
      created_at: new Date().toISOString(),
    };
    this.state.aiMessages.push(userMsg);

    // Realistic RAG Tutor intelligence based on context
    let reply = '';
    const qLower = userText.toLowerCase();
    if (qLower.includes('قلب') || qLower.includes('دوري') || qLower.includes('دم')) {
      reply = `أهلاً بك! بالرجوع لمقرر العلوم والجهاز الدوري: القلب عضو عضلي يتكون من 4 حجرات (أذينان وبطينان). الشرايين تنقل الدم بعيداً عن القلب، والأوردة تعيده، والصفائح الدموية تمنع النزيف بتكوين الجلطة الواقية. هل تحب مراجعة أسئلة الكويز المرتبطة؟`;
    } else if (qLower.includes('ذرة') || qLower.includes('الكترون') || qLower.includes('بروتون')) {
      reply = `بالنسبة للتركيب الذري: تتكون الذرة من نواة مركزية بها بروتونات موجبة (+) ونيوترونات متعادلة (±)، وتدور حولها إلكترونات سالبة (-) في مستويات الطاقة السبعة (K, L, M, N, O, P, Q). المستوى الأول يتشبع بإلكترونين فقط (2n²).`;
    } else if (qLower.includes('امتحان') || qLower.includes('درجة') || qLower.includes('شهادة')) {
      reply = `جميع درجاتك وتقارير أدائك موثقة بشكل آلي في المنظومة، وتُرسل مباشرة لولي أمرك عبر بريده الإلكتروني بمجرد تسليم الاختبار. يمكنك حل الاختبارات المنشورة في صفحتك الرئيسية في أي وقت.`;
    } else {
      reply = `مرحباً بك! أنا مساعد EduFlow الأكاديمي الذكي المربوط بمقرراتك وموادك الدراسية. يمكنك سؤالي عن أي مفهوم علمي، أو طلب تلخيص نقطة معينة، أو الاستفسار عن الواجبات والامتحانات القادمة.`;
    }

    const assistantMsg: AiMessage = {
      id: newUuid(),
      conversation_id: conv.id,
      sender: 'assistant',
      message: reply,
      created_at: new Date().toISOString(),
    };
    this.state.aiMessages.push(assistantMsg);

    this.persist();
    return { userMsg, assistantMsg };
  }

  updateLastAiAssistantMessage(userId: string, newReply: string): void {
    const conv = this.state.aiConversations.find((c) => c.user_id === userId);
    if (!conv) return;
    const assistantMessages = this.state.aiMessages.filter(
      (m) => m.conversation_id === conv.id && m.sender === 'assistant'
    );
    if (assistantMessages.length > 0) {
      assistantMessages[assistantMessages.length - 1].message = newReply;
      this.persist();
    }
  }

  // ==========================================
  // OPERATIONAL ASSISTANT & COORDINATOR METHODS
  // ==========================================

  registerStudentByAssistant(data: {
    full_name: string;
    email: string;
    phone?: string;
    grade_level?: string;
    parent_name?: string;
    parent_phone?: string;
    parent_email?: string;
    group_id?: string;
  }): Profile {
    const studentId = newUuid();
    const newStudent: Profile = {
      id: studentId,
      full_name: data.full_name,
      email: data.email || `${studentId}@eduflow.edu`,
      phone: data.phone || '010' + Math.floor(10000000 + Math.random() * 90000000),
      role: 'student',
      avatar: '👨‍🎓',
      grade_level: data.grade_level || 'الصف الثاني الإعدادي',
      parent_name: data.parent_name || 'ولي أمر الطالب',
      parent_email: data.parent_email || `${studentId}.parent@gmail.com`,
      created_at: new Date().toISOString(),
    };

    this.state.profiles.push(newStudent);

    // If parent info provided, create or link parent
    if (data.parent_name || data.parent_email) {
      let parent = this.state.profiles.find((p) => p.role === 'parent' && p.email === data.parent_email);
      if (!parent) {
        const parentId = newUuid();
        parent = {
          id: parentId,
          full_name: data.parent_name || 'أ. ولي أمر ' + data.full_name,
          email: data.parent_email || `${parentId}@gmail.com`,
          phone: data.parent_phone || data.phone || '01000000000',
          role: 'parent',
          avatar: '👨‍💼',
          created_at: new Date().toISOString(),
        };
        this.state.profiles.push(parent);
      }
      newStudent.parent_id = parent.id;
      this.state.parentLinks.push({
        id: newUuid(),
        parent_id: parent.id,
        student_id: newStudent.id,
        status: 'approved',
        created_at: new Date().toISOString(),
      });
    }

    // If group provided, create enrollment and initial monthly fee
    const group = data.group_id ? this.state.groups.find((g) => g.id === data.group_id) : undefined;
    if (data.group_id) {
      this.state.enrollments.push({
        id: newUuid(),
        student_id: newStudent.id,
        group_id: data.group_id,
        enrolled_at: new Date().toISOString(),
        status: 'active',
        student_name: newStudent.full_name,
        group_name: group?.name,
      });

      // Create initial billing invoice
      const initialInvoice: StudentPayment = {
        id: newUuid(),
        student_id: newStudent.id,
        group_id: data.group_id,
        amount: 450,
        currency: 'EGP',
        paid_amount: 0,
        remaining_amount: 450,
        amount_due: 450,
        amount_paid: 0,
        status: 'unpaid',
        period_label: 'شهر نوفمبر 2026',
        cycle_month: '2026-11-01',
        due_date: '2026-11-20',
        created_at: new Date().toISOString(),
        student_name: newStudent.full_name,
        group_name: group?.name,
      };
      this.state.studentPayments.push(initialInvoice);

      // Mirror the invoice to the server so payments can be recorded on it remotely
      if (isUuid(initialInvoice.id) && isUuid(initialInvoice.student_id) && isUuid(initialInvoice.group_id)) {
        callPaymentsWorkflow('invoice.create', {
          id: initialInvoice.id,
          student_id: initialInvoice.student_id,
          group_id: initialInvoice.group_id,
          amount: initialInvoice.amount,
          currency: initialInvoice.currency,
          period_label: initialInvoice.period_label,
          due_date: initialInvoice.due_date,
        }).catch(() => {});
      }
    }

    // Add welcoming notification
    this.addNotification({
      user_id: newStudent.id,
      title: 'مرحباً بك في منصة EduFlow 🎓',
      message: `تم تسجيل حسابك بنجاح بواسطة المنسق الإداري، وانضمامك لمجموعتك الدراسية. يمكنك الآن استعراض الحصص والواجبات.`,
      type: 'info',
    });

    // 1. Direct Cloud Sync to Supabase Auth & Profiles
    createStudentInSupabase({
      full_name: newStudent.full_name,
      phone: newStudent.phone || '',
      email: newStudent.email,
      password: 'password123456',
    }).then((res) => {
      if (res.success && res.id && res.id !== newStudent.id) {
        const oldId = newStudent.id;
        newStudent.id = res.id;
        // Remap every local reference to the old temporary id.
        this.state.enrollments.forEach((e) => { if (e.student_id === oldId) e.student_id = res.id!; });
        this.state.studentPayments.forEach((p) => { if (p.student_id === oldId) p.student_id = res.id!; });
        this.state.parentLinks.forEach((l) => { if (l.student_id === oldId) l.student_id = res.id!; });
        this.state.attendance.forEach((a) => { if (a.student_id === oldId) a.student_id = res.id!; });
        this.state.examAttempts.forEach((a) => { if (a.student_id === oldId) a.student_id = res.id!; });
        this.state.notifications.forEach((n) => { if (n.user_id === oldId) n.user_id = res.id!; });
        if (this.state.currentUserId === oldId) this.state.currentUserId = res.id!;
        this.persist();
        this.notify();
      }
    });

    // 2. Trigger n8n Automation Workflow
    sendN8nEvent('new_student_registered', {
      student_name: newStudent.full_name,
      student_id: newStudent.id,
      phone: newStudent.phone,
      email: newStudent.email,
      grade_level: newStudent.grade_level,
      parent_name: data.parent_name || 'ولي أمر الطالب',
      parent_phone: data.parent_phone || newStudent.phone,
      group_name: group?.name || 'المجموعة الدراسية',
    });

    this.persist();
    return newStudent;
  }

  uploadMaterialByAssistant(data: {
    group_id: string;
    title: string;
    file_url?: string;
    file_type?: string;
    session_id?: string;
    description?: string;
  }): CourseMaterial {
    const group = this.state.groups.find((g) => g.id === data.group_id);
    const newMaterial: CourseMaterial = {
      id: newUuid(),
      group_id: data.group_id,
      session_id: data.session_id,
      title: data.title,
      file_url: data.file_url || 'https://eduflow.edu/materials/' + Date.now() + '.pdf',
      file_type: data.file_type || 'PDF',
      download_count: 0,
      created_at: new Date().toISOString(),
    };

    this.state.courseMaterials.push(newMaterial);

    // Notify students of that group
    const enrolledStudentIds = this.state.enrollments
      .filter((e) => e.group_id === data.group_id && e.status === 'active')
      .map((e) => e.student_id);

    enrolledStudentIds.forEach((stuId) => {
      this.addNotification({
        user_id: stuId,
        title: 'تم رفع مذكرة دراسية جديدة 📚',
        message: `قام المساعد الإداري برفع "${data.title}" لمجموعة ${group?.name || ''}. يمكنك تحميلها ومراجعتها الآن.`,
        type: 'info',
      });
    });

    callMaterialIngestWorkflow({
      title: newMaterial.title,
      file_url: newMaterial.file_url || '',
      group_id: newMaterial.group_id,
    }).catch((err) => console.warn('n8n assistant material ingest note:', err));

    callAuditWorkflow({
      action: 'material.uploaded_by_assistant',
      entity_type: 'material',
      entity_id: newMaterial.id,
      actor_role: 'assistant',
      details: { title: newMaterial.title, file_url: newMaterial.file_url },
    }).catch(() => {});

    this.persist();
    return newMaterial;
  }

  recordBatchAttendanceByAssistant(
    sessionId: string,
    records: { student_id: string; status: 'present' | 'absent' | 'late' | 'excused'; notes?: string }[]
  ) {
    const session = this.state.sessions.find((s) => s.id === sessionId);
    records.forEach((rec) => {
      const existing = this.state.attendance.find(
        (a) => a.session_id === sessionId && a.student_id === rec.student_id
      );

      if (existing) {
        existing.status = rec.status;
        existing.notes = rec.notes || existing.notes;
        existing.recorded_at = new Date().toISOString();
      } else {
        this.state.attendance.push({
          id: newUuid(),
          session_id: sessionId,
          student_id: rec.student_id,
          status: rec.status,
          notes: rec.notes || 'تم الرصد بواسطة المساعد الإداري',
          recorded_at: new Date().toISOString(),
        });
      }

      // If marked absent, send immediate notification to student and parent
      if (rec.status === 'absent') {
        const student = this.state.profiles.find((p) => p.id === rec.student_id);
        this.addNotification({
          user_id: rec.student_id,
          title: 'تنبيه غياب الحصة ⚠️',
          message: `تم تسجيل غيابك اليوم في حصة "${session?.title || 'الحصة الدراسية'}". يرجى مراجعة إدارة السنتر لتحديد موعد التعويض.`,
          type: 'warning',
        });
        if (student?.parent_id) {
          this.addNotification({
            user_id: student.parent_id,
            title: 'إشعار غياب لولي الأمر ⚠️',
            message: `نحيط سيادتكم علماً بتسجيل غياب الطالب (${student.full_name}) اليوم في حصة "${session?.title || 'المادة'}".`,
            type: 'warning',
          });
        }
      }
    });

    this.persist();
  }

  async recordPaymentVoucherByAssistant(data: {
    student_payment_id: string;
    amount: number;
    payment_method: 'cash' | 'instapay' | 'vodafone_cash' | 'bank_transfer' | 'other';
    reference_number?: string;
    notes?: string;
    assistant_name?: string;
  }): Promise<{ success: boolean; message?: string; invoice?: StudentPayment; transaction?: PaymentTransaction }> {
    const invoice = this.state.studentPayments.find((p) => p.id === data.student_payment_id);
    if (!invoice) return { success: false };

    const refNumber = data.reference_number || 'OP-' + Math.floor(100000 + Math.random() * 900000);

    // 1) Server-first: the n8n Payments Hub records the voucher in Supabase.
    let serverRes: any = null;
    let serverRejected: string | null = null;
    try {
      const res = await callPaymentsWorkflow('payment.record', {
        payment_id: invoice.id,
        amount: data.amount,
        payment_method: data.payment_method,
        reference_number: refNumber,
        recorder_name: data.assistant_name,
        notes: data.notes,
      });
      if (res.success && res.data) {
        if (res.data.success) serverRes = res.data;
        else serverRejected = res.data.error || 'رفض السيرفر العملية';
      }
    } catch {
      // n8n offline — fall back to local voucher below.
    }
    if (serverRejected) return { success: false, message: serverRejected };

    let transaction: PaymentTransaction;
    if (serverRes) {
      transaction = {
        id: serverRes.transaction_id || newUuid(),
        student_payment_id: invoice.id,
        amount: data.amount,
        payment_method: data.payment_method,
        reference_number: refNumber,
        notes: (data.notes || '') + ` (رصد المنسق: ${data.assistant_name || 'أ. كريم نبيل'})`,
        paid_at: new Date().toISOString(),
        recorded_by: data.assistant_name || 'ast-1',
        created_at: new Date().toISOString(),
      };
      this.state.paymentTransactions.push(transaction);

      invoice.paid_amount = Number(serverRes.paid_amount);
      invoice.amount_paid = invoice.paid_amount;
      invoice.status = serverRes.status as StudentPayment['status'];
      invoice.remaining_amount = Number(serverRes.remaining_amount);
      if (serverRes.status === 'paid') invoice.paid_at = new Date().toISOString();
    } else {
      // 2) Fallback: local voucher (n8n offline)
      transaction = {
        id: newUuid(),
        student_payment_id: invoice.id,
        amount: data.amount,
        payment_method: data.payment_method,
        reference_number: refNumber,
        notes: (data.notes || '') + ` (رصد المنسق: ${data.assistant_name || 'أ. كريم نبيل'})`,
        paid_at: new Date().toISOString(),
        recorded_by: data.assistant_name || 'ast-1',
        created_at: new Date().toISOString(),
      };

      this.state.paymentTransactions.push(transaction);

      invoice.paid_amount = (invoice.paid_amount || 0) + data.amount;
      invoice.amount_paid = invoice.paid_amount;
      const targetDue = invoice.amount || invoice.amount_due || 450;
      if (invoice.paid_amount >= targetDue) {
        invoice.status = 'paid';
      } else if (invoice.paid_amount > 0) {
        invoice.status = 'partially_paid';
      }
      invoice.remaining_amount = Math.max(0, targetDue - invoice.paid_amount);
    }

    const student = this.state.profiles.find((p) => p.id === invoice.student_id);

    // Send notifications
    const methodNames: Record<string, string> = {
      cash: 'نقداً بالسنتر',
      instapay: 'انستاباي Instapay',
      vodafone_cash: 'فودافون كاش',
      bank_transfer: 'تحويل بنكي',
      other: 'سداد إلكتروني',
    };

    const notifMsg = `تم استلام وتأكيد سداد مبلغ ${data.amount} ج.م بطريقة (${methodNames[data.payment_method] || data.payment_method}) برقم إيصال ${transaction.reference_number}. تم تحديث حالة الفاتورة.`;

    this.addNotification({
      user_id: invoice.student_id,
      title: 'سند قبض ودفع معتمد 🧾',
      message: notifMsg,
      type: 'success',
    });

    if (student?.parent_id) {
      this.addNotification({
        user_id: student.parent_id,
        title: 'تأكيد استلام مصروفات دراسية 🧾',
        message: `عزيزي ولي أمر الطالب (${student.full_name}): ${notifMsg}`,
        type: 'success',
      });
    }

    this.persist();
    return { success: true, invoice, transaction };
  }

  resolveComplaintByAssistant(
    complaintId: string,
    resolutionNotes: string,
    status: 'in_progress' | 'resolved' = 'resolved',
    assistantName: string = 'أ. كريم نبيل (المنسق الإداري)'
  ): boolean {
    const complaint = this.state.complaints.find((c) => c.id === complaintId);
    if (!complaint) return false;

    complaint.status = status;
    complaint.resolved_at = status === 'resolved' ? new Date().toISOString() : undefined;
    complaint.assigned_to = 'ast-1';

    const fullReply = `[رد المنسق ${assistantName}]: ${resolutionNotes}`;

    this.addNotification({
      user_id: complaint.submitted_by || complaint.user_id || '',
      title: status === 'resolved' ? 'تم حل شكواك / استفسارك بنجاح ✅' : 'تحديث بخصوص طلبك ℹ️',
      message: fullReply,
      type: status === 'resolved' ? 'success' : 'info',
    });

    this.persist();
    return true;
  }

  sendOperationalBroadcast(data: {
    title: string;
    message: string;
    target_group_id?: string;
    target_role?: 'all' | 'student' | 'parent';
  }) {
    let targetUserIds: string[] = [];

    if (data.target_group_id && data.target_group_id !== 'all') {
      const enrollments = this.state.enrollments.filter(
        (e) => e.group_id === data.target_group_id && e.status === 'active'
      );
      const studentIds = enrollments.map((e) => e.student_id);
      if (data.target_role === 'student' || data.target_role === 'all' || !data.target_role) {
        targetUserIds.push(...studentIds);
      }
      if (data.target_role === 'parent' || data.target_role === 'all') {
        const parentIds = this.state.profiles
          .filter((p) => studentIds.includes(p.id) && p.parent_id)
          .map((p) => p.parent_id as string);
        targetUserIds.push(...parentIds);
      }
    } else {
      if (data.target_role === 'student' || data.target_role === 'all' || !data.target_role) {
        targetUserIds.push(...this.getStudents().map((s) => s.id));
      }
      if (data.target_role === 'parent' || data.target_role === 'all') {
        targetUserIds.push(...this.getParents().map((p) => p.id));
      }
    }

    // Deduplicate
    targetUserIds = Array.from(new Set(targetUserIds));

    targetUserIds.forEach((uid) => {
      this.addNotification({
        user_id: uid,
        title: `📢 ${data.title}`,
        message: data.message,
        type: 'info',
      });
    });

    this.persist();
    return targetUserIds.length;
  }

  // ==========================================
  // EXAM CREATION (AI, MANUAL, MATERIAL UPLOAD)
  // ==========================================
  createExamWithQuestions(data: {
    session_id: string;
    title: string;
    subject?: string;
    grade_level?: string;
    duration_minutes: number;
    passing_score: number;
    creator_role: 'teacher' | 'assistant' | 'admin';
    creation_mode: 'manual' | 'ai_generated' | 'material_upload';
    curriculum_type?: 'languages' | 'arabic';
    material_url?: string;
    questions?: Omit<Question, 'id' | 'exam_id'>[];
  }): Exam {
    const examId = newUuid();
    const createdQuestions: Question[] = (data.questions || []).map((q, idx) => ({
      id: newUuid(),
      exam_id: examId,
      question_text: q.question_text,
      question_type: q.question_type || 'mcq',
      options: q.options,
      correct_answer: q.correct_answer,
      points: q.points || 1,
      explanation: q.explanation || 'إجابة نموذجية وشرح تفصيلي للمفهوم العلمي.',
    }));

    const newExam: Exam = {
      id: examId,
      session_id: data.session_id,
      title: data.title,
      subject: data.subject || 'Sciences (Languages / لغات)',
      grade_level: data.grade_level || 'الصف الثاني الإعدادي',
      duration_minutes: data.duration_minutes || 15,
      passing_score: data.passing_score || 70,
      is_published: true,
      creator_role: data.creator_role,
      creation_mode: data.creation_mode,
      curriculum_type: data.curriculum_type || 'languages',
      material_url: data.material_url,
      questions: createdQuestions,
      created_at: new Date().toISOString(),
    };

    this.state.exams.unshift(newExam);

    // Notify enrolled students in group
    const session = this.state.sessions.find((s) => s.id === data.session_id);
    if (session) {
      const enrollments = this.state.enrollments.filter((e) => e.group_id === session.group_id);
      enrollments.forEach((e) => {
        this.addNotification({
          user_id: e.student_id,
          title: `📝 اختبار جديد: ${newExam.title}`,
          message: `تم نشر اختبار جديد للحصة (${session.title}). يمكنك خوض الاختبار الآن والحصول على التقييم.`,
          notification_type: 'exam',
        });
      });
    }

    // Mirror the exam + its questions (with correct answers) to the n8n Exams
    // Hub so server-side grading can read them from Supabase. Fire-and-forget:
    // when n8n is offline, supabaseSync has already pushed the same rows.
    callExamsWorkflow('exam.create_draft', {
      id: examId,
      session_id: data.session_id,
      title: newExam.title,
      subject: newExam.subject,
      grade_level: newExam.grade_level,
      duration_minutes: newExam.duration_minutes,
      passing_score: newExam.passing_score,
      creator_role: data.creator_role,
      creation_mode: data.creation_mode,
      curriculum_type: newExam.curriculum_type,
      material_url: data.material_url,
      is_published: true,
      questions: createdQuestions,
    }).catch(() => {});

    this.persist();
    return newExam;
  }

  // ==========================================
  // STUDENT ACADEMIC TRACKER FOR ASSISTANT
  // (Who took exam? Who watched video? Who solved homework?)
  // ==========================================
  getStudentAcademicFollowUp(groupId: string, sessionId?: string): StudentFollowUpRecord[] {
    const enrollments = this.state.enrollments.filter((e) => e.group_id === groupId && e.status === 'active');
    const studentIds = enrollments.map((e) => e.student_id);
    const students = this.state.profiles.filter((p) => studentIds.includes(p.id));

    let exam: Exam | undefined;
    if (sessionId) {
      exam = this.state.exams.find((ex) => ex.session_id === sessionId);
    }
    if (!exam) {
      const groupSessions = this.state.sessions.filter((s) => s.group_id === groupId);
      const sessionIds = groupSessions.map((s) => s.id);
      exam = this.state.exams.find((ex) => sessionIds.includes(ex.session_id)) || this.state.exams[0];
    }

    const assignment = this.state.assignments.find((a) => (sessionId ? a.session_id === sessionId : a.group_id === groupId));

    return students.map((stu) => {
      const targetSessionId = sessionId || (this.state.sessions.find((s) => s.group_id === groupId)?.id || 'sess-1');
      const plays = this.getVideoPlays(targetSessionId, stu.id);
      const playCount = plays.length;

      let examTaken = false;
      let examScore: number | undefined;
      let examTotal: number | undefined;
      let examPassed: boolean | undefined;
      if (exam) {
        const attempt = this.state.examAttempts.find((att) => att.exam_id === exam!.id && att.student_id === stu.id);
        if (attempt) {
          examTaken = true;
          examScore = attempt.score;
          examTotal = attempt.total_score;
          examPassed = attempt.passed;
        }
      }

      let assignmentSubmitted = false;
      let assignmentScore: number | undefined;
      if (assignment) {
        const sub = this.state.submissions.find((s) => s.assignment_id === assignment.id && s.student_id === stu.id);
        if (sub) {
          assignmentSubmitted = true;
          assignmentScore = sub.score;
        }
      }

      const att = this.state.attendance.find((a) => a.session_id === targetSessionId && a.student_id === stu.id);

      const inv = this.state.studentPayments.find((p) => p.student_id === stu.id && p.group_id === groupId) ||
                  this.state.studentPayments.find((p) => p.student_id === stu.id);

      const due = inv ? (inv.amount || inv.amount_due || 450) : 450;
      const paid = inv ? (inv.paid_amount || inv.amount_paid || 0) : 0;
      const rem = inv?.remaining_amount ?? Math.max(0, due - paid);
      const payStatus = inv ? inv.status : 'unpaid';
      const payMethod = inv?.payment_method || 'لم يسجل';

      return {
        student_id: stu.id,
        student_name: stu.full_name,
        student_code: `#${stu.id}`,
        phone: stu.phone,
        parent_name: stu.parent_name || 'أ. ولي الأمر',
        parent_phone: stu.phone ? stu.phone.replace(/5/g, '6') : '01012345678',
        grade_level: stu.grade_level,
        video_watched: playCount > 0,
        video_play_count: playCount,
        max_plays: 3,
        exam_taken: examTaken,
        exam_score: examScore,
        exam_total: examTotal,
        exam_passed: examPassed,
        assignment_submitted: assignmentSubmitted,
        assignment_score: assignmentScore,
        attendance_status: att ? att.status : undefined,
        amount_due: due,
        amount_paid: paid,
        remaining_amount: rem,
        payment_status: payStatus,
        payment_method: payMethod,
      };
    });
  }

  // ==========================================
  // DIRECT PARENT LIAISON COMMUNICATION BRIDGE
  // ==========================================
  sendParentFollowUpMessage(
    studentId: string,
    issueType: 'missing_exam' | 'missing_homework' | 'missing_video' | 'fees',
    customMessage?: string
  ): { success: boolean; studentName: string; parentPhone: string; whatsappUrl: string; messageText: string } {
    const student = this.state.profiles.find((p) => p.id === studentId);
    if (!student) {
      return { success: false, studentName: '', parentPhone: '', whatsappUrl: '', messageText: '' };
    }

    let defaultMsg = '';
    if (issueType === 'missing_exam') {
      defaultMsg = `عزيزي ولي أمر الطالب (${student.full_name}): نحيط سيادتكم علماً بأن الطالب لم يدخل اختبار الحصة بعد. نرجو التنبيه عليه بضرورة أداء الاختبار على المنصة لتقييم مستواه.`;
    } else if (issueType === 'missing_homework') {
      defaultMsg = `عزيزي ولي أمر الطالب (${student.full_name}): نود إعلامكم بعدم تسليم الطالب لواجب الحصة المنزلية (Assignment). يرجى المتابعة لضمان استمرار تفوقه.`;
    } else if (issueType === 'missing_video') {
      defaultMsg = `عزيزي ولي أمر الطالب (${student.full_name}): الطالب لم يشاهد فيديو شرح الحصة على المنصة حتى الآن. يرجى التنبيه بالمشاهدة والحل.`;
    } else {
      defaultMsg = `عزيزي ولي أمر الطالب (${student.full_name}): تذكير لطيف بمصروفات الشهر الدراسي المعلقة. يمكنكم السداد عبر فودافون كاش أو انستاباي أو بالسنتر.`;
    }

    const messageText = customMessage || defaultMsg;
    const parentPhone = student.phone || '01012345678';
    const cleanPhone = parentPhone.replace(/\D/g, '');
    const whatsappUrl = `https://wa.me/2${cleanPhone}?text=${encodeURIComponent(messageText)}`;

    this.addNotification({
      user_id: student.id,
      title: 'تنبيه متابعة إدارية 📋',
      message: messageText,
      notification_type: 'general',
    });

    if (student.parent_id) {
      this.addNotification({
        user_id: student.parent_id,
        title: 'رسالة متابعة من المنسق الإداري 📱',
        message: messageText,
        notification_type: 'general',
      });
    }

    this.persist();
    return {
      success: true,
      studentName: student.full_name,
      parentPhone,
      whatsappUrl,
      messageText,
    };
  }
}

export const db = new MockDatabaseService();
