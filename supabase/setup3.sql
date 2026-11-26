-- ============================================================
-- EduFlow - Setup patch 3 (run AFTER schema.sql, setup.sql, setup2.sql)
-- Needed by n8n WF-27 (Notification Management), WF-28 (Scheduled
-- Reminders) and WF-29 (Weekly Parent Reports). Safe to run twice.
-- ============================================================

-- 1) dedupe_key على الإشعارات: عشان نفس الإشعار ما يتبعتش مرتين
ALTER TABLE "public"."notifications" ADD COLUMN IF NOT EXISTS "dedupe_key" "text";
-- لازم unique constraint كامل (مش partial index) عشان on_conflict=user_id,dedupe_key في n8n يشتغل
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'notifications_user_dedupe_key') THEN
    ALTER TABLE "public"."notifications"
      ADD CONSTRAINT "notifications_user_dedupe_key" UNIQUE ("user_id", "dedupe_key");
  END IF;
END $$;

-- 2) دالة ملخص الطالب الأسبوعي (WF-29 بيندهها: POST /rest/v1/rpc/student_summary_core)
CREATE OR REPLACE FUNCTION "public"."student_summary_core"("p_student_id" "uuid", "p_since" timestamp with time zone)
RETURNS "jsonb"
LANGUAGE "sql" STABLE SECURITY DEFINER
SET "search_path" TO 'public'
AS $$
  SELECT jsonb_build_object(
    'student', (SELECT jsonb_build_object('id', p.id, 'full_name', p.full_name)
                FROM public.profiles p WHERE p.id = p_student_id),
    'attendance', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'status', a.status, 'session', s.title, 'at', a.recorded_at))
      FROM public.attendance a
      LEFT JOIN public.sessions s ON s.id = a.session_id
      WHERE a.student_id = p_student_id AND a.recorded_at >= p_since), '[]'::jsonb),
    'exams', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'exam', e.title, 'score', ea.score, 'total', ea.total_score,
               'passed', ea.passed, 'at', ea.submitted_at))
      FROM public.exam_attempts ea
      LEFT JOIN public.exams e ON e.id = ea.exam_id
      WHERE ea.student_id = p_student_id
        AND ea.submitted_at IS NOT NULL AND ea.submitted_at >= p_since), '[]'::jsonb),
    'homework', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'assignment', asg.title, 'status', sub.status,
               'score', sub.score, 'at', sub.submitted_at))
      FROM public.assignment_submissions sub
      LEFT JOIN public.assignments asg ON asg.id = sub.assignment_id
      WHERE sub.student_id = p_student_id AND sub.submitted_at >= p_since), '[]'::jsonb)
  );
$$;
-- للـ service role بتاع n8n بس، مش للمتصفح
REVOKE ALL ON FUNCTION "public"."student_summary_core"("uuid", timestamp with time zone) FROM PUBLIC, "anon", "authenticated";
GRANT EXECUTE ON FUNCTION "public"."student_summary_core"("uuid", timestamp with time zone) TO "service_role";
