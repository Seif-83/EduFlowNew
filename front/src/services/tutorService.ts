import { sendN8nEvent } from './n8nService';
import { askGeminiTutor, hasGeminiKey, getLastGeminiError } from './geminiService';
import { db } from './mockDatabase';

export interface TutorStudent {
  id: string;
  full_name: string;
  grade_level?: string;
}

/**
 * One place for the AI tutor, used by the floating chatbot and the student page.
 * 1) n8n agent (only counts when it is a REAL agent reply: it must carry a conversation_id;
 *    the workflow's canned "agent error" welcome text has none and is ignored),
 * 2) direct Gemini with the conversation history,
 * 3) an honest error message (never a fake welcome that looks like an answer).
 */
export async function askTutor(student: TutorStudent, question: string): Promise<{ text: string; ok: boolean }> {
  // History BEFORE the new question was added by db.sendAiMessage
  const all = db.getAiMessages(student.id);
  const history = all
    .slice(0, -2) // drop the question + placeholder reply just added
    .map((m) => ({ sender: m.sender as 'user' | 'assistant', message: m.message }));

  try {
    const res = await sendN8nEvent('ai_tutor_chat', {
      question,
      grade: student.grade_level || 'المرحلة الإعدادية',
      student_name: student.full_name,
      student_id: student.id,
      conversation_id: `student-${student.id}`,
    });
    const body = res.data?.data || res.data;
    const reply = body?.reply;
    if (res.success && reply && body?.conversation_id) return { text: String(reply), ok: true };
  } catch (err) {
    console.info('n8n AI agent unavailable:', err);
  }

  try {
    const answer = await askGeminiTutor(question, student.grade_level || 'المرحلة الإعدادية', history);
    if (answer) return { text: answer, ok: true };
  } catch (err) {
    console.warn('Gemini tutor error', err);
  }

  const why = !hasGeminiKey()
    ? 'مفتاح Gemini غير مضبوط (VITE_GEMINI_API_KEY).'
    : `تعذر الاتصال بنموذج Gemini (${getLastGeminiError() || 'سبب غير معروف'}).`;
  return { text: `⚠️ المعلم الذكي مش قادر يرد دلوقتي. ${why} جرّب تاني بعد شوية.`, ok: false };
}
