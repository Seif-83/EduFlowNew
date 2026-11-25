-- ============================================================
-- EduFlow - Setup patch (run AFTER schema.sql in the SQL Editor)
-- Adds what the frontend + n8n workflows need beyond the baseline schema.
-- Safe to run more than once.
-- ============================================================

-- 1) جدول سجل التدقيق (مطلوب من workflow بتاع Audit Logging)
CREATE TABLE IF NOT EXISTS "public"."audit_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL PRIMARY KEY,
    "workspace_id" "uuid",
    "actor_id" "uuid",
    "actor_role" "text",
    "action" "text" NOT NULL,
    "entity_type" "text" NOT NULL,
    "entity_id" "uuid",
    "source" "text" DEFAULT 'n8n'::"text",
    "details" "jsonb" DEFAULT '{}'::"jsonb",
    "before_data" "jsonb",
    "after_data" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);
ALTER TABLE "public"."audit_logs" ENABLE ROW LEVEL SECURITY;
-- القراءة للأدمن فقط؛ الكتابة تتم بمفتاح الخدمة (service role) من n8n.
DROP POLICY IF EXISTS "Admins read audit logs" ON "public"."audit_logs";
CREATE POLICY "Admins read audit logs" ON "public"."audit_logs"
  FOR SELECT TO "authenticated" USING ("public"."is_admin"());

-- 2) السماح بدور "assistant" في جدول profiles
ALTER TABLE "public"."profiles" DROP CONSTRAINT IF EXISTS "profiles_role_check";
ALTER TABLE "public"."profiles"
  ADD CONSTRAINT "profiles_role_check"
  CHECK (("role" = ANY (ARRAY['student'::"text", 'teacher'::"text", 'parent'::"text", 'admin'::"text", 'assistant'::"text"])));

-- 3) أعمدة إضافية يحتاجها الفرونت إند
ALTER TABLE "public"."profiles" ADD COLUMN IF NOT EXISTS "avatar" "text";
ALTER TABLE "public"."profiles" ADD COLUMN IF NOT EXISTS "grade_level" "text";
ALTER TABLE "public"."profiles" ADD COLUMN IF NOT EXISTS "teacher_id" "uuid";
ALTER TABLE "public"."profiles" ADD COLUMN IF NOT EXISTS "parent_id" "uuid";

ALTER TABLE "public"."exams" ADD COLUMN IF NOT EXISTS "subject" "text";
ALTER TABLE "public"."exams" ADD COLUMN IF NOT EXISTS "grade_level" "text";
ALTER TABLE "public"."exams" ADD COLUMN IF NOT EXISTS "deadline" timestamp with time zone;
ALTER TABLE "public"."exams" ADD COLUMN IF NOT EXISTS "creator_role" "text";
ALTER TABLE "public"."exams" ADD COLUMN IF NOT EXISTS "creation_mode" "text";
ALTER TABLE "public"."exams" ADD COLUMN IF NOT EXISTS "curriculum_type" "text";
ALTER TABLE "public"."exams" ADD COLUMN IF NOT EXISTS "material_url" "text";

ALTER TABLE "public"."questions" ADD COLUMN IF NOT EXISTS "explanation" "text";

ALTER TABLE "public"."student_payments" ADD COLUMN IF NOT EXISTS "paid_amount" numeric(10,2) DEFAULT 0 NOT NULL;

-- 4) المواد الدراسية: السماح بالربط بمجموعة (group) بدل كورس/حصة
ALTER TABLE "public"."course_materials" ADD COLUMN IF NOT EXISTS "group_id" "uuid";
ALTER TABLE "public"."course_materials" ADD COLUMN IF NOT EXISTS "download_count" integer DEFAULT 0 NOT NULL;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'course_materials_group_id_fkey'
  ) THEN
    ALTER TABLE "public"."course_materials"
      ADD CONSTRAINT "course_materials_group_id_fkey"
      FOREIGN KEY ("group_id") REFERENCES "public"."course_groups"("id") ON DELETE CASCADE;
  END IF;
END $$;
ALTER TABLE "public"."course_materials" DROP CONSTRAINT IF EXISTS "course_materials_check";
ALTER TABLE "public"."course_materials"
  ADD CONSTRAINT "course_materials_check"
  CHECK (("course_id" IS NOT NULL) OR ("session_id" IS NOT NULL) OR ("group_id" IS NOT NULL));

-- 5) دالة بحث ولي الأمر عن الطالب برقم الهاتف (تتجاوز RLS بشكل آمن ومحدود)
CREATE OR REPLACE FUNCTION "public"."lookup_student_by_phone"("p_phone" "text")
RETURNS SETOF "public"."profiles"
LANGUAGE "sql" SECURITY DEFINER
SET "search_path" = 'public'
AS $$
  SELECT * FROM "public"."profiles"
  WHERE "role" = 'student' AND "phone" = "p_phone"
  LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION "public"."lookup_student_by_phone"("text") TO "anon";
GRANT EXECUTE ON FUNCTION "public"."lookup_student_by_phone"("text") TO "authenticated";

-- 6) فهارس مساعدة
CREATE INDEX IF NOT EXISTS "idx_profiles_phone" ON "public"."profiles" ("phone");
CREATE INDEX IF NOT EXISTS "idx_notifications_user" ON "public"."notifications" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_attendance_session_student" ON "public"."attendance" ("session_id", "student_id");
CREATE INDEX IF NOT EXISTS "idx_exam_attempts_exam_student" ON "public"."exam_attempts" ("exam_id", "student_id");
