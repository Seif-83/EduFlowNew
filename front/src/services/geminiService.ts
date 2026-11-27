import { GeneratedLessonData } from '../types/database';

const GEMINI_API_KEY =
  (import.meta as any).env?.VITE_GEMINI_API_KEY ||
  (import.meta as any).env?.GEMINI_API_KEY ||
  '';

// Models are tried in order. Google retires old model names (the old 'gemini-2.5-flash-lite'
// now returns 404 "no longer available"), so we fall through to the next one instead of failing.
const GEMINI_MODELS: string[] = [
  (import.meta as any).env?.VITE_GEMINI_MODEL || '',
  'gemini-3.5-flash-lite',
  'gemini-3.8-flash',
].filter(Boolean);
const endpointFor = (model: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;

export const hasGeminiKey = () => !!GEMINI_API_KEY;

let lastGeminiError = '';
export const getLastGeminiError = () => lastGeminiError;

/** POST to Gemini trying each model until one answers. Returns the parsed JSON or null. */
async function callGemini(body: any): Promise<any | null> {
  lastGeminiError = '';
  for (const model of GEMINI_MODELS) {
    try {
      const response = await fetch(endpointFor(model), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (response.ok) return await response.json();
      lastGeminiError = `${model}: HTTP ${response.status}`;
      console.warn('Gemini API returned status', response.status, 'for model', model);
      if (![404, 429, 500, 503].includes(response.status)) return null;
    } catch (err) {
      lastGeminiError = `${model}: network error`;
      console.warn('Gemini network error:', err);
    }
  }
  return null;
}

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
    const data = await callGemini({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.3,
      },
    });
    if (!data) return null;
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
 * Live AI tutor chat with Gemini. `history` = earlier turns (oldest first) so follow-ups work.
 */
export async function askGeminiTutor(
  studentQuestion: string,
  gradeLevel: string = 'المرحلة الإعدادية',
  history: { sender: 'user' | 'assistant'; message: string }[] = []
): Promise<string | null> {
  if (!GEMINI_API_KEY) return null;

  const system = `أنت "المعلم الذكي" في منصة EduFlow التعليمية. تتحدث بلطف وتشجيع مع طالب في ${gradeLevel}. أجب عن سؤال الطالب الحالي مباشرة وبالتحديد (لا تكرر ترحيباً عاماً)، بشرح علمي مبسط في 3-6 أسطر مع مثال من الحياة أو المنهج المصري، وباللغة العربية المبسطة، واختم بتشجيع قصير.`;

  const contents = [
    ...history.slice(-8).map((m) => ({
      role: m.sender === 'user' ? 'user' : 'model',
      parts: [{ text: m.message }],
    })),
    { role: 'user', parts: [{ text: studentQuestion }] },
  ];

  const data = await callGemini({
    systemInstruction: { parts: [{ text: system }] },
    contents,
    generationConfig: { temperature: 0.5, maxOutputTokens: 1200 },
  });
  const parts = data?.candidates?.[0]?.content?.parts;
  const text = Array.isArray(parts) ? parts.map((p: any) => p.text || '').join('').trim() : '';
  return text || null;
}
