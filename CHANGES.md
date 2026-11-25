# EduFlow — إيه اللي اتغيّر (Change List)

## 1) ربط الداتا بـ Supabase فعلياً (بدل localStorage بس)

- ملف جديد `front/src/services/supabaseSync.ts`: طبقة مزامنة كاملة.
  - أي تغيير في الداتا (طالب جديد، حضور، امتحان، دفع، ملاحظة، إشعار...) بيتبعت تلقائياً للجدول المناسب في Supabase (upsert/delete للصفوف المتغيرة بس).
  - عند فتح الموقع بيتم تحميل كل الجداول من Supabase ودمجها في الواجهة، يعني **الداتا بقت تشتغل من أي جهاز** مش بس المتصفح اللي اتسجلت منه.
- كل العناصر الجديدة بقت بتاخد UUID حقيقي بدل أكواد زي `stu-123` عشان العلاقات (Foreign Keys) في الداتابيس تتسجل صح.
- في `supabaseClient.ts` اتضاف `supabaseAdmin` (service role) لاستخدام طبقة المزامنة بس. المفاتيح سيبناها زي ما هي بناءً على قرارك — **متنساش إن ده للعرض بس، وقبل أي نشر حقيقي لازم تتنقل وراء n8n**.

### خطوات التشغيل المطلوبة منك:
1. في Supabase → SQL Editor: شغّل `supabase/schema.sql` لو لسه، وبعدها شغّل **`supabase/setup.sql`** (ملف جديد — مهم جداً).
2. في n8n: اعمل import من جديد لملف `n8n/EduFlow - Audit Logging.json` (اتعدل) وفعّله (Active).
3. الواجهة: `cd front && npm ci && npm run dev` زي المعتاد.

## 2) إصلاحات n8n

- **Audit Logging.json — مسار الامتحانات (`eduflow-exams`)**: كان بيرجع `success` من غير ما يكتب حاجة. دلوقتي بيكتب فعلاً:
  - `exam.create_draft` → إدخال في جدول `exams` (لازم `session_id` يكون UUID).
  - `exam.publish` → تحديث `is_published = true`.
  - `exam.start_attempt` / `exam.submit_attempt` → إدخال في `exam_attempts` مع حساب النسبة والنجاح.
- **مسار الإشعارات (`eduflow-notifications`)**: بقى بيكتب إشعار لكل مستخدم في `user_ids` جوه جدول `notifications` فعلياً.
- **مهم**: الـ audit workflow كان بيكتب في جدول `audit_logs` **غير موجود أصلاً** في schema.sql — اتضاف في setup.sql.

## 3) إصلاحات في كود الواجهة

- `geminiService.ts`: اسم الموديل كان غلط (`gemini-3.5-flash-lite` مش موجود) → اتصلح لـ `gemini-2.5-flash-lite`. ده كان بيخلي ردود الـ AI تسقط على المحتوى الجاهز.
- `n8nService.ts`: شالنا النداء الأخير على `/webhook/eduflow` (مسار مش موجود في أي workflow وكان بيرجع 404 ويخلي كل الأحداث تبان فاشلة).
- عنوان n8n بقى ممكن يتغير من متغير `VITE_N8N_BASE_URL` في `.env.local` — الافتراضي لسه `http://localhost:5678` زي ما طلبت.
- **زرار "إضافة طالب" في بوابة المساعد كان بيضرب (crash)** بعد التسجيل بسبب متغير `group` خارج نطاقه — اتصلح.
- اتصلح bug إن الـ ID المؤقت للطالب كان بيفضل في التسجيلات والمدفوعات بعد ما Supabase يرجع الـ ID الحقيقي — دلوقتي كل المراجع بتتحدث.
- **دخول ولي الأمر برقم الطالب بقى يشتغل من أي جهاز**: بيدور في Supabase أولاً عن طريق دالة `lookup_student_by_phone` (موجودة في setup.sql) وبعدين يرجع للمحلي.

## 4) setup.sql فيه إيه؟

- جدول `audit_logs` الناقص.
- إضافة دور `assistant` لأدوار profiles (كان مرفوض من الـ CHECK constraint!).
- أعمدة ناقصة بيستخدمها الفرونت (avatar, grade_level, teacher_id, parent_id / subject, deadline... في exams / explanation في questions / paid_amount في المدفوعات / group_id في المواد).
- إصلاح CHECK constraint في `course_materials` عشان يسمح بمادة مرتبطة بمجموعة.
- دالة `lookup_student_by_phone` + فهارس للأداء.

## 5) تحسين شكل الواجهة (UI)

- نظام تصميم جديد في `index.css`: ألوان براند موحدة (زمردي/نيلي)، ظلال، أزرار/إدخالات جاهزة (`ef-btn-primary`, `ef-input`, `ef-card`)، خلفية متدرجة للبوابات، حركات دخول ناعمة (fade-up/stagger) ودعم تقليل الحركة.
- صفحة الهبوط: حركات بمكتبة motion، شريط إحصائيات، قسم "تبدأ في ثلاث خطوات"، زر تسجيل أوضح.
- صفحة الدخول: خلفية شبكية متدرجة + دخول متحرك للكارت.
- الهيدر زجاجي بظل أنعم، وكل البوابات (طالب/معلم/مساعد/ولي أمر/أدمن) بتدخل بحركة متتابعة.

## لسه متبقي (مقترح للمرحلة الجاية)

- تسجيل دخول حقيقي بـ Supabase Auth (`signInWithPassword`) وتمرير الـ JWT لمسارات n8n (workflow بتاع `eduflow-auth` جاهز لده).
- شيل كلمات المرور التجريبية المفتوحة (`123456`, `admin123`...) قبل العرض النهائي.
- نقل عمليات الأدمن (إنشاء مستخدمين) وراء n8n وشيل service key من الفرونت قبل أي نشر عام.
