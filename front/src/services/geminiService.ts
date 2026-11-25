import { GeneratedLessonData } from '../types/database';

const GEMINI_API_KEY =
  (import.meta as any).env?.VITE_GEMINI_API_KEY ||
  (import.meta as any).env?.GEMINI_API_KEY ||
  '';

const GEMINI_MODEL = 'gemini-2.5-flash-lite';
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

export interface GenerateLessonParams {
  lesson: string;
  grade: string;
  difficulty: string;
  questionsCount: number;
  studentName?: string;
  parentEmail?: string;
  studentId?: string;
}

/**
 * Generate full interactive curriculum unit using Google Gemini AI
 */
export async function generateLessonWithGemini(
  params: GenerateLessonParams
): Promise<GeneratedLessonData | null> {
  const { lesson, grade, difficulty, questionsCount } = params;

  if (!GEMINI_API_KEY) {
    return null;
  }

  const prompt = `أنت خبير تربوي ومصمم مناهج تعليمية ذكية في منصة EduFlow لطلاب ${grade}.
المطلوب إعداد وحدة تعليمية تفاعلية واختبار ذكي لموضوع: "${lesson}"، بمستوى صعوبة: "${difficulty}"، وعدد أسئلة اختبار: ${questionsCount}.

قم بتوليد JSON صالح فقط يحتوي بدقة على البنية التالية بدون أي نصوص قبل أو بعد الـ JSON:
{
  "title": "${lesson}",
  "grade": "${grade}",
  "difficulty": "${difficulty}",
  "summary": "شرح تعليمي منظم ومبسط وشامل للدرس في فقرتين أو ثلاث فقرات بأسلوب جذاب ومحفز للطلاب",
  "keyPoints": [
    "النقطة الجوهرية الأولى من المنهج",
    "النقطة الجوهرية الثانية",
    "النقطة الجوهرية الثالثة",
    "النقطة الجوهرية الرابعة"
  ],
  "flashcards": [
    { "front": "سؤال استذكار سريع 1؟", "back": "إجابة ملخصة ومباشرة 1" },
    { "front": "سؤال استذكار سريع 2؟", "back": "إجابة ملخصة ومباشرة 2" },
    { "front": "سؤال استذكار سريع 3؟", "back": "إجابة ملخصة ومباشرة 3" },
    { "front": "سؤال استذكار سريع 4؟", "back": "إجابة ملخصة ومباشرة 4" }
  ],
  "questions": [
    {
      "question": "نص السؤال الأول",
      "choices": ["الاختيار أ", "الاختيار ب", "الاختيار ج", "الاختيار د"],
      "correctIndex": 0,
      "explanation": "شرح سبب صحة الإجابة"
    }
  ]
}

ملاحظات هامة جداً:
1. توليد عدد أسئلة بالضبط يساوي ${questionsCount} في مصفوفة questions.
2. كل سؤال يجب أن يحتوي على 4 اختيارات في مصفوفة choices.
3. correctIndex يجب أن يكون رقم بين 0 و 3 يحدد الإجابة الصحيحة بدقة.
4. اللغة عربية فصحى تربوية سليمة وواضحة.`;

  try {
    const response = await fetch(GEMINI_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.3,
        },
      }),
    });

    if (!response.ok) {
      console.warn('Gemini API returned status:', response.status);
      return null;
    }

    const data = await response.json();
    const candidate = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!candidate) return null;

    const parsed = JSON.parse(candidate);

    return {
      title: parsed.title || lesson,
      grade: parsed.grade || grade,
      difficulty: parsed.difficulty || difficulty,
      summary: parsed.summary || '',
      keyPoints: Array.isArray(parsed.keyPoints) ? parsed.keyPoints : [],
      flashcards: Array.isArray(parsed.flashcards) ? parsed.flashcards : [],
      questions: Array.isArray(parsed.questions) ? parsed.questions : [],
    };
  } catch (err) {
    console.warn('Gemini generation error, falling back to local generator:', err);
    return null;
  }
}

/**
 * Live AI tutor chat with Gemini for curriculum questions
 */
export async function askGeminiTutor(
  studentQuestion: string,
  gradeLevel: string = 'المرحلة الإعدادية'
): Promise<string | null> {
  if (!GEMINI_API_KEY) return null;

  const prompt = `أنت "المعلم الذكي" في منصة EduFlow التعليمية. تتحدث بلطف وتشجيع مع طالب في ${gradeLevel}.
سؤال الطالب: "${studentQuestion}"

أجب باختصار وترتيب (في 2-4 أسطر) مقدماً شرحاً علمياً مبسطاً، مع أمثلة من الحياة أو المنهج المصري، واختم بعبارة تشجيعية للطالب. باللغة العربية الفصحى.`;

  try {
    const response = await fetch(GEMINI_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.5,
          maxOutputTokens: 500,
        },
      }),
    });

    if (!response.ok) return null;

    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || null;
  } catch (err) {
    console.warn('Gemini tutor error:', err);
    return null;
  }
}
