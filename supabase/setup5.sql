-- =====================================================================
-- EduFlow — setup5.sql (الجولة التاسعة: التسعير بالحصة + الاشتراك + الباقات + أكواد الفتح)
-- شغّله مرة واحدة في Supabase → SQL Editor → New query → Run.
-- آمن للتشغيل أكتر من مرة (idempotent). مبيمسحش أي بيانات موجودة.
-- كل التحقق (الكود، عدد المشاهدات، صلاحية الفتح) بيتم هنا على السيرفر.
-- =====================================================================

-- 1) سعر الحصة (فاضي أو 0 = حصة مجانية)
ALTER TABLE "public"."sessions" ADD COLUMN IF NOT EXISTS "price" numeric(10,2);

-- 2) الباقات (مجموعة حصص بسعر واحد)
CREATE TABLE IF NOT EXISTS "public"."lesson_bundles" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "group_id" uuid NOT NULL REFERENCES "public"."course_groups"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "price" numeric(10,2) NOT NULL CHECK ("price" > 0),
  "session_ids" uuid[] NOT NULL DEFAULT '{}',
  "created_by" uuid,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

-- 3) صلاحية مشاهدة الحصة لكل طالب (وعدد المشاهدات)
CREATE TABLE IF NOT EXISTS "public"."lesson_access" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "student_id" uuid NOT NULL,
  "session_id" uuid NOT NULL REFERENCES "public"."sessions"("id") ON DELETE CASCADE,
  "source" text NOT NULL CHECK ("source" IN ('free','payment','subscription','bundle','code')),
  "view_limit" integer NOT NULL DEFAULT 3 CHECK ("view_limit" > 0),
  "views_used" integer NOT NULL DEFAULT 0 CHECK ("views_used" >= 0),
  "ref_id" uuid,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  UNIQUE ("student_id", "session_id")
);

-- 4) الاشتراك الشهري (طالب + مجموعة + شهر)
CREATE TABLE IF NOT EXISTS "public"."student_subscriptions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "student_id" uuid NOT NULL,
  "group_id" uuid NOT NULL REFERENCES "public"."course_groups"("id") ON DELETE CASCADE,
  "period" text NOT NULL,
  "amount" numeric(10,2) NOT NULL,
  "granted_by" uuid,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  UNIQUE ("student_id", "group_id", "period")
);

-- 5) أكواد الفتح (استخدام واحد)
CREATE TABLE IF NOT EXISTS "public"."unlock_codes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "code" text NOT NULL UNIQUE,
  "group_id" uuid NOT NULL REFERENCES "public"."course_groups"("id") ON DELETE CASCADE,
  "session_id" uuid REFERENCES "public"."sessions"("id") ON DELETE CASCADE,
  "bundle_id" uuid REFERENCES "public"."lesson_bundles"("id") ON DELETE CASCADE,
  "view_limit" integer NOT NULL DEFAULT 3 CHECK ("view_limit" > 0),
  "status" text NOT NULL DEFAULT 'active' CHECK ("status" IN ('active','used','revoked')),
  "created_by" uuid,
  "redeemed_by" uuid,
  "redeemed_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CHECK (("session_id" IS NOT NULL) <> ("bundle_id" IS NOT NULL))
);

-- 6) سجل المدفوعات (للمراقبة بس، بيتسجل تلقائي من الدالة)
CREATE TABLE IF NOT EXISTS "public"."lesson_payments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "student_id" uuid NOT NULL,
  "group_id" uuid NOT NULL REFERENCES "public"."course_groups"("id") ON DELETE CASCADE,
  "kind" text NOT NULL CHECK ("kind" IN ('lesson','subscription','bundle')),
  "session_id" uuid REFERENCES "public"."sessions"("id") ON DELETE SET NULL,
  "bundle_id" uuid REFERENCES "public"."lesson_bundles"("id") ON DELETE SET NULL,
  "period" text,
  "amount" numeric(10,2) NOT NULL,
  "method" text NOT NULL DEFAULT 'cash',
  "recorded_by" uuid,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS lesson_access_student_idx ON "public"."lesson_access"("student_id");
CREATE INDEX IF NOT EXISTS unlock_codes_group_idx ON "public"."unlock_codes"("group_id");
CREATE INDEX IF NOT EXISTS lesson_payments_group_idx ON "public"."lesson_payments"("group_id");

-- الجداول دي مقفولة على الـ anon key. التطبيق بيتعامل معاها بمفتاح الخدمة.
ALTER TABLE "public"."lesson_bundles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."lesson_access" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."student_subscriptions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."unlock_codes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."lesson_payments" ENABLE ROW LEVEL SECURITY;

GRANT ALL ON "public"."lesson_bundles", "public"."lesson_access", "public"."student_subscriptions", "public"."unlock_codes", "public"."lesson_payments" TO service_role;

-- ---------------------------------------------------------------------
-- دوال السيرفر (SECURITY DEFINER). التنفيذ لمفتاح الخدمة بس.
-- ---------------------------------------------------------------------

-- هل المستخدم ده هو مدرس المجموعة؟
CREATE OR REPLACE FUNCTION public.eduflow_is_group_teacher(p_user uuid, p_group uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM course_groups g WHERE g.id = p_group AND g.teacher_id = p_user);
$$;

-- الطالب مسجل (active) في المجموعة؟
CREATE OR REPLACE FUNCTION public.eduflow_is_enrolled(p_student uuid, p_group uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM enrollments e WHERE e.student_id = p_student AND e.group_id = p_group AND e.status = 'active');
$$;

-- المدرس يحدد سعر حصة (NULL أو 0 = مجانية)
CREATE OR REPLACE FUNCTION public.set_session_price(p_teacher uuid, p_session uuid, p_price numeric)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_group uuid;
BEGIN
  SELECT group_id INTO v_group FROM sessions WHERE id = p_session;
  IF v_group IS NULL THEN RETURN jsonb_build_object('success', false, 'message', 'الحصة غير موجودة'); END IF;
  IF NOT eduflow_is_group_teacher(p_teacher, v_group) THEN
    RETURN jsonb_build_object('success', false, 'message', 'مش مسموح: الحصة دي مش من مجموعاتك');
  END IF;
  IF p_price IS NOT NULL AND p_price < 0 THEN
    RETURN jsonb_build_object('success', false, 'message', 'السعر لازم يكون صفر أو أكتر');
  END IF;
  UPDATE sessions SET price = NULLIF(p_price, 0) WHERE id = p_session;
  RETURN jsonb_build_object('success', true, 'message', 'تم حفظ سعر الحصة');
END $$;

-- المدرس يحدد سعر الاشتراك الشهري للمجموعة
CREATE OR REPLACE FUNCTION public.set_group_monthly_price(p_teacher uuid, p_group uuid, p_price numeric)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT eduflow_is_group_teacher(p_teacher, p_group) THEN
    RETURN jsonb_build_object('success', false, 'message', 'مش مسموح: المجموعة دي مش بتاعتك');
  END IF;
  IF p_price IS NULL OR p_price <= 0 THEN
    DELETE FROM group_billing_settings WHERE group_id = p_group;
    RETURN jsonb_build_object('success', true, 'message', 'تم إلغاء الاشتراك الشهري للمجموعة');
  END IF;
  INSERT INTO group_billing_settings (group_id, payment_type, amount, currency)
  VALUES (p_group, 'monthly', p_price, 'EGP')
  ON CONFLICT (group_id) DO UPDATE SET payment_type = 'monthly', amount = EXCLUDED.amount;
  RETURN jsonb_build_object('success', true, 'message', 'تم حفظ سعر الاشتراك الشهري');
END $$;

-- إنشاء باقة
CREATE OR REPLACE FUNCTION public.create_lesson_bundle(p_teacher uuid, p_group uuid, p_name text, p_price numeric, p_sessions uuid[])
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid; v_ok int;
BEGIN
  IF NOT eduflow_is_group_teacher(p_teacher, p_group) THEN
    RETURN jsonb_build_object('success', false, 'message', 'مش مسموح: المجموعة دي مش بتاعتك');
  END IF;
  IF p_name IS NULL OR btrim(p_name) = '' THEN RETURN jsonb_build_object('success', false, 'message', 'اكتب اسم الباقة'); END IF;
  IF p_price IS NULL OR p_price <= 0 THEN RETURN jsonb_build_object('success', false, 'message', 'اكتب سعر أكبر من صفر'); END IF;
  IF p_sessions IS NULL OR array_length(p_sessions, 1) IS NULL THEN RETURN jsonb_build_object('success', false, 'message', 'اختار حصة واحدة على الأقل'); END IF;
  SELECT count(*) INTO v_ok FROM sessions WHERE id = ANY(p_sessions) AND group_id = p_group;
  IF v_ok <> (SELECT count(DISTINCT x) FROM unnest(p_sessions) x) THEN
    RETURN jsonb_build_object('success', false, 'message', 'في حصص مش تابعة للمجموعة دي');
  END IF;
  INSERT INTO lesson_bundles (group_id, name, price, session_ids, created_by)
  VALUES (p_group, btrim(p_name), p_price, (SELECT array_agg(DISTINCT x) FROM unnest(p_sessions) x), p_teacher)
  RETURNING id INTO v_id;
  RETURN jsonb_build_object('success', true, 'message', 'تم إنشاء الباقة', 'id', v_id);
END $$;

-- توليد أكواد (حصة واحدة أو باقة). بترجع الأكواد.
CREATE OR REPLACE FUNCTION public.generate_unlock_codes(p_teacher uuid, p_session uuid, p_bundle uuid, p_count int, p_view_limit int DEFAULT 3)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_group uuid; v_codes text[] := '{}'; v_code text; i int := 0; v_try int := 0;
BEGIN
  IF (p_session IS NULL) = (p_bundle IS NULL) THEN
    RETURN jsonb_build_object('success', false, 'message', 'اختار حصة أو باقة (واحد بس)');
  END IF;
  IF p_session IS NOT NULL THEN SELECT group_id INTO v_group FROM sessions WHERE id = p_session;
  ELSE SELECT group_id INTO v_group FROM lesson_bundles WHERE id = p_bundle; END IF;
  IF v_group IS NULL THEN RETURN jsonb_build_object('success', false, 'message', 'الحصة أو الباقة غير موجودة'); END IF;
  IF NOT eduflow_is_group_teacher(p_teacher, v_group) THEN
    RETURN jsonb_build_object('success', false, 'message', 'مش مسموح: دي مش مجموعتك');
  END IF;
  IF p_count IS NULL OR p_count < 1 OR p_count > 100 THEN
    RETURN jsonb_build_object('success', false, 'message', 'عدد الأكواد من 1 لـ 100');
  END IF;
  IF p_view_limit IS NULL OR p_view_limit < 1 OR p_view_limit > 20 THEN
    RETURN jsonb_build_object('success', false, 'message', 'عدد المشاهدات من 1 لـ 20');
  END IF;
  WHILE i < p_count AND v_try < p_count * 20 LOOP
    v_try := v_try + 1;
    v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 4) || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 4));
    BEGIN
      INSERT INTO unlock_codes (code, group_id, session_id, bundle_id, view_limit, created_by)
      VALUES (v_code, v_group, p_session, p_bundle, p_view_limit, p_teacher);
      v_codes := v_codes || v_code; i := i + 1;
    EXCEPTION WHEN unique_violation THEN NULL;
    END;
  END LOOP;
  RETURN jsonb_build_object('success', true, 'message', 'تم توليد ' || i || ' كود', 'codes', to_jsonb(v_codes));
END $$;

-- إلغاء كود لسه ما اتستخدمش
CREATE OR REPLACE FUNCTION public.revoke_unlock_code(p_teacher uuid, p_code text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r unlock_codes%ROWTYPE;
BEGIN
  SELECT * INTO r FROM unlock_codes WHERE code = upper(btrim(p_code)) FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'message', 'الكود غير موجود'); END IF;
  IF NOT eduflow_is_group_teacher(p_teacher, r.group_id) THEN RETURN jsonb_build_object('success', false, 'message', 'مش مسموح'); END IF;
  IF r.status <> 'active' THEN RETURN jsonb_build_object('success', false, 'message', 'الكود مش نشط'); END IF;
  UPDATE unlock_codes SET status = 'revoked' WHERE id = r.id;
  RETURN jsonb_build_object('success', true, 'message', 'تم إلغاء الكود');
END $$;

-- الطالب يستخدم كود. استخدام واحد بس، والتحقق هنا.
CREATE OR REPLACE FUNCTION public.redeem_unlock_code(p_student uuid, p_code text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r unlock_codes%ROWTYPE; v_sessions uuid[]; v_n int := 0; v_granted int := 0; s uuid;
BEGIN
  SELECT * INTO r FROM unlock_codes WHERE code = upper(btrim(p_code)) FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'message', 'الكود غير صحيح'); END IF;
  IF r.status = 'used' THEN RETURN jsonb_build_object('success', false, 'message', 'الكود ده اتستخدم قبل كده'); END IF;
  IF r.status <> 'active' THEN RETURN jsonb_build_object('success', false, 'message', 'الكود ده اتلغى'); END IF;
  IF NOT eduflow_is_enrolled(p_student, r.group_id) THEN
    RETURN jsonb_build_object('success', false, 'message', 'لازم تكون مسجل في المجموعة دي عشان تستخدم الكود');
  END IF;
  IF r.session_id IS NOT NULL THEN v_sessions := ARRAY[r.session_id];
  ELSE SELECT session_ids INTO v_sessions FROM lesson_bundles WHERE id = r.bundle_id; END IF;
  FOREACH s IN ARRAY COALESCE(v_sessions, '{}') LOOP
    INSERT INTO lesson_access (student_id, session_id, source, view_limit, ref_id)
    VALUES (p_student, s, 'code', r.view_limit, r.id)
    ON CONFLICT (student_id, session_id) DO UPDATE
      SET source = 'code', ref_id = r.id,
          view_limit = GREATEST(lesson_access.view_limit, lesson_access.views_used + r.view_limit)
      WHERE lesson_access.source IN ('free');
    GET DIAGNOSTICS v_n = ROW_COUNT;
    v_granted := v_granted + v_n;
  END LOOP;
  IF v_granted = 0 THEN
    RETURN jsonb_build_object('success', false, 'message', 'الحصة دي مفتوحة عندك بالفعل (الكود لسه صالح ومااتخصمش)');
  END IF;
  UPDATE unlock_codes SET status = 'used', redeemed_by = p_student, redeemed_at = now() WHERE id = r.id;
  RETURN jsonb_build_object('success', true, 'message', 'تم فتح ' || v_granted || ' حصة. مسموح لك ' || r.view_limit || ' مشاهدات لكل حصة.', 'sessions', to_jsonb(COALESCE(v_sessions,'{}')));
END $$;

-- المدرس يسجل إن الطالب دفع (حصة / اشتراك شهري / باقة). السعر بيتاخد من السيرفر مش من المتصفح.
CREATE OR REPLACE FUNCTION public.record_lesson_payment(p_teacher uuid, p_student uuid, p_kind text, p_target uuid, p_method text DEFAULT 'cash')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_group uuid; v_price numeric; v_period text := to_char(now() AT TIME ZONE 'Africa/Cairo', 'YYYY-MM'); v_sessions uuid[]; s uuid; v_bundle uuid; v_session uuid;
BEGIN
  IF p_kind = 'lesson' THEN
    SELECT group_id, price INTO v_group, v_price FROM sessions WHERE id = p_target; v_session := p_target;
    IF v_group IS NULL THEN RETURN jsonb_build_object('success', false, 'message', 'الحصة غير موجودة'); END IF;
    IF v_price IS NULL OR v_price <= 0 THEN RETURN jsonb_build_object('success', false, 'message', 'الحصة دي مجانية أو ملهاش سعر'); END IF;
    v_sessions := ARRAY[p_target];
  ELSIF p_kind = 'bundle' THEN
    SELECT group_id, price, session_ids INTO v_group, v_price, v_sessions FROM lesson_bundles WHERE id = p_target; v_bundle := p_target;
    IF v_group IS NULL THEN RETURN jsonb_build_object('success', false, 'message', 'الباقة غير موجودة'); END IF;
  ELSIF p_kind = 'subscription' THEN
    v_group := p_target;
    SELECT amount INTO v_price FROM group_billing_settings WHERE group_id = p_target AND payment_type = 'monthly';
    IF v_price IS NULL OR v_price <= 0 THEN RETURN jsonb_build_object('success', false, 'message', 'المجموعة دي ملهاش اشتراك شهري'); END IF;
  ELSE
    RETURN jsonb_build_object('success', false, 'message', 'نوع الدفع غير معروف');
  END IF;
  IF NOT eduflow_is_group_teacher(p_teacher, v_group) THEN RETURN jsonb_build_object('success', false, 'message', 'مش مسموح: دي مش مجموعتك'); END IF;
  IF NOT eduflow_is_enrolled(p_student, v_group) THEN RETURN jsonb_build_object('success', false, 'message', 'الطالب مش مسجل في المجموعة دي'); END IF;

  IF p_kind = 'subscription' THEN
    IF EXISTS (SELECT 1 FROM student_subscriptions WHERE student_id = p_student AND group_id = v_group AND period = v_period) THEN
      RETURN jsonb_build_object('success', false, 'message', 'الطالب مشترك الشهر ده بالفعل');
    END IF;
    INSERT INTO student_subscriptions (student_id, group_id, period, amount, granted_by) VALUES (p_student, v_group, v_period, v_price, p_teacher);
    INSERT INTO lesson_payments (student_id, group_id, kind, period, amount, method, recorded_by) VALUES (p_student, v_group, 'subscription', v_period, v_price, COALESCE(p_method,'cash'), p_teacher);
    RETURN jsonb_build_object('success', true, 'message', 'تم تفعيل اشتراك شهر ' || v_period || ' (' || v_price || ' ج.م)');
  END IF;

  FOREACH s IN ARRAY v_sessions LOOP
    INSERT INTO lesson_access (student_id, session_id, source, view_limit, ref_id)
    VALUES (p_student, s, CASE WHEN p_kind = 'lesson' THEN 'payment' ELSE 'bundle' END, 3, COALESCE(v_bundle, v_session))
    ON CONFLICT (student_id, session_id) DO UPDATE SET source = EXCLUDED.source, ref_id = EXCLUDED.ref_id
      WHERE lesson_access.source = 'free';
  END LOOP;
  INSERT INTO lesson_payments (student_id, group_id, kind, session_id, bundle_id, amount, method, recorded_by)
  VALUES (p_student, v_group, p_kind, v_session, v_bundle, v_price, COALESCE(p_method,'cash'), p_teacher);
  RETURN jsonb_build_object('success', true, 'message', 'تم تسجيل الدفع (' || v_price || ' ج.م) وفتح الحصص للطالب');
END $$;

-- الطالب يضغط "مشاهدة": السيرفر يقرر ويحسب المشاهدة (ذرّي).
CREATE OR REPLACE FUNCTION public.consume_lesson_view(p_student uuid, p_session uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_group uuid; v_price numeric; v_pub boolean; v_period text := to_char(now() AT TIME ZONE 'Africa/Cairo', 'YYYY-MM'); a lesson_access%ROWTYPE;
BEGIN
  SELECT group_id, price, COALESCE(is_published, false) INTO v_group, v_price, v_pub FROM sessions WHERE id = p_session;
  IF v_group IS NULL THEN RETURN jsonb_build_object('allowed', false, 'reason', 'الحصة غير موجودة'); END IF;
  IF NOT v_pub THEN RETURN jsonb_build_object('allowed', false, 'reason', 'الحصة لسه ما اتنشرتش'); END IF;
  IF NOT eduflow_is_enrolled(p_student, v_group) THEN RETURN jsonb_build_object('allowed', false, 'reason', 'إنت مش مسجل في مجموعة الحصة دي'); END IF;

  SELECT * INTO a FROM lesson_access WHERE student_id = p_student AND session_id = p_session FOR UPDATE;
  IF NOT FOUND THEN
    IF v_price IS NULL OR v_price <= 0 THEN
      INSERT INTO lesson_access (student_id, session_id, source) VALUES (p_student, p_session, 'free')
      ON CONFLICT (student_id, session_id) DO NOTHING;
    ELSIF EXISTS (SELECT 1 FROM student_subscriptions WHERE student_id = p_student AND group_id = v_group AND period = v_period) THEN
      INSERT INTO lesson_access (student_id, session_id, source) VALUES (p_student, p_session, 'subscription')
      ON CONFLICT (student_id, session_id) DO NOTHING;
    ELSE
      RETURN jsonb_build_object('allowed', false, 'locked', true, 'price', v_price, 'reason', 'الحصة مقفولة. ادفع للمدرس (' || v_price || ' ج.م) أو استخدم كود فتح.');
    END IF;
    SELECT * INTO a FROM lesson_access WHERE student_id = p_student AND session_id = p_session FOR UPDATE;
  END IF;

  IF a.views_used >= a.view_limit THEN
    RETURN jsonb_build_object('allowed', false, 'views_used', a.views_used, 'views_remaining', 0, 'view_limit', a.view_limit,
      'reason', 'خلصت مشاهداتك لهذه الحصة (' || a.view_limit || ' مرات).');
  END IF;
  UPDATE lesson_access SET views_used = views_used + 1 WHERE id = a.id;
  RETURN jsonb_build_object('allowed', true, 'source', a.source, 'views_used', a.views_used + 1, 'view_limit', a.view_limit, 'views_remaining', a.view_limit - a.views_used - 1);
END $$;

-- قفل التنفيذ: مفتاح الخدمة بس (مش الـ anon).
DO $$
DECLARE f text;
BEGIN
  FOR f IN SELECT oid::regprocedure::text FROM pg_proc
           WHERE pronamespace = 'public'::regnamespace
             AND proname IN ('eduflow_is_group_teacher','eduflow_is_enrolled','set_session_price','set_group_monthly_price','create_lesson_bundle','generate_unlock_codes','revoke_unlock_code','redeem_unlock_code','record_lesson_payment','consume_lesson_view')
  LOOP
    EXECUTE 'REVOKE ALL ON FUNCTION ' || f || ' FROM PUBLIC, anon, authenticated';
    EXECUTE 'GRANT EXECUTE ON FUNCTION ' || f || ' TO service_role';
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';

-- =====================================================================
-- خلاص ✅.
-- اختياري (مش بيتشغل لوحده): مسح الفاتورتين القديمتين بـ 450 اللي اتعملوا في الجولة 7.
-- شيل علامة التعليق لو عايز تمسحهم:
-- DELETE FROM public.student_payments WHERE id IN ('41492ead-4bca-4fa5-976c-ee43da9bc83e','1b3a1a5a-1ae6-4fd3-88f7-970ea484953b');
-- =====================================================================
