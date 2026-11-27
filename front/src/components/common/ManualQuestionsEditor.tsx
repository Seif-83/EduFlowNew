import React from 'react';
import { CheckCircle, Plus, Trash2, ChevronUp, ChevronDown } from 'lucide-react';

export interface ManualQuestionDraft {
  key: string;
  text: string;
  opts: [string, string, string, string];
  correctIdx: number | null;
  expl: string;
}

const LETTERS = ['أ', 'ب', 'ج', 'د'];

let keyCounter = 0;
export const emptyManualQuestion = (): ManualQuestionDraft => ({
  key: `mq-${Date.now()}-${keyCounter++}`,
  text: '',
  opts: ['', '', '', ''],
  correctIdx: null,
  expl: '',
});

export type BuiltQuestion = {
  question_text: string;
  question_type: 'mcq';
  options: string[];
  correct_answer: string;
  points: number;
  explanation: string;
};

/** Validates every question and builds the payload. Grading compares the
 *  student's chosen text with correct_answer, so it is the text of the marked option. */
export function buildManualQuestions(
  drafts: ManualQuestionDraft[]
): { error: string; questions?: undefined } | { error?: undefined; questions: BuiltQuestion[] } {
  if (drafts.length === 0) return { error: 'ضيف سؤال واحد على الأقل.' };
  const out: BuiltQuestion[] = [];
  for (let i = 0; i < drafts.length; i++) {
    const d = drafts[i];
    const n = i + 1;
    const opts = d.opts.map((o) => o.trim());
    if (!d.text.trim()) return { error: `السؤال ${n}: اكتب نص السؤال.` };
    if (opts.filter(Boolean).length < 2) return { error: `السؤال ${n}: اكتب اختيارين على الأقل.` };
    const filled = opts.filter(Boolean).map((o) => o.toLowerCase());
    if (new Set(filled).size !== filled.length) {
      return { error: `السؤال ${n}: في اختيارين مكتوبين بنفس النص، غيّر واحد منهم.` };
    }
    if (d.correctIdx === null) {
      return { error: `السؤال ${n}: اختار الإجابة الصحيحة بالضغط على الحرف (أ / ب / ج / د) جنب الاختيار.` };
    }
    if (!opts[d.correctIdx]) {
      return { error: `السؤال ${n}: الاختيار اللي علّمته كإجابة صحيحة فاضي. اكتب نصه أو علّم اختيار تاني.` };
    }
    out.push({
      question_text: d.text.trim(),
      question_type: 'mcq',
      options: opts.filter(Boolean),
      correct_answer: opts[d.correctIdx],
      points: 1,
      explanation: d.expl.trim() || 'نموذج الإجابة المعتمد في الاختبار.',
    });
  }
  return { questions: out };
}

interface Props {
  questions: ManualQuestionDraft[];
  onChange: (next: ManualQuestionDraft[]) => void;
}

export const ManualQuestionsEditor: React.FC<Props> = ({ questions, onChange }) => {
  const update = (idx: number, patch: Partial<ManualQuestionDraft>) =>
    onChange(questions.map((q, i) => (i === idx ? { ...q, ...patch } : q)));
  const setOpt = (qi: number, oi: number, v: string) => {
    const opts = [...questions[qi].opts] as ManualQuestionDraft['opts'];
    opts[oi] = v;
    update(qi, { opts });
  };
  const remove = (idx: number) => {
    const next = questions.filter((_, i) => i !== idx);
    onChange(next.length ? next : [emptyManualQuestion()]);
  };
  const move = (idx: number, dir: -1 | 1) => {
    const to = idx + dir;
    if (to < 0 || to >= questions.length) return;
    const next = [...questions];
    [next[idx], next[to]] = [next[to], next[idx]];
    onChange(next);
  };

  return (
    <div className="space-y-3" dir="rtl">
      {questions.map((q, qi) => (
        <div key={q.key} className="p-3 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-black text-slate-800">السؤال {qi + 1} من {questions.length}</span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => move(qi, -1)}
                disabled={qi === 0}
                title="انقل لفوق"
                className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 disabled:opacity-30 cursor-pointer"
              >
                <ChevronUp className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => move(qi, 1)}
                disabled={qi === questions.length - 1}
                title="انقل لتحت"
                className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 disabled:opacity-30 cursor-pointer"
              >
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => remove(qi)}
                title="احذف السؤال"
                className="p-1.5 rounded-lg bg-red-50 border border-red-200 text-red-600 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          <input
            type="text"
            value={q.text}
            onChange={(e) => update(qi, { text: e.target.value })}
            placeholder="اكتب نص السؤال..."
            className="w-full p-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold"
          />
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-600">
              الاختيارات (اضغط على الحرف لتحديد الإجابة الصحيحة):
            </label>
            {LETTERS.map((letter, oi) => {
              const isCorrect = q.correctIdx === oi;
              return (
                <div key={letter} className="flex items-center gap-2">
                  <button
                    type="button"
                    role="radio"
                    aria-checked={isCorrect}
                    onClick={() => update(qi, { correctIdx: oi })}
                    title={isCorrect ? 'دي الإجابة الصحيحة' : 'علّم دي كإجابة صحيحة'}
                    className={`shrink-0 w-8 h-8 rounded-full border-2 text-xs font-black flex items-center justify-center transition-all cursor-pointer ${
                      isCorrect
                        ? 'bg-emerald-600 border-emerald-700 text-white shadow-md shadow-emerald-600/30'
                        : 'bg-white border-slate-300 text-slate-500 hover:border-emerald-400'
                    }`}
                  >
                    {isCorrect ? <CheckCircle className="w-4 h-4" /> : letter}
                  </button>
                  <input
                    type="text"
                    value={q.opts[oi]}
                    onChange={(e) => setOpt(qi, oi, e.target.value)}
                    placeholder={`اختيار ${letter}`}
                    className={`flex-1 p-2 rounded-xl text-xs border ${
                      isCorrect ? 'bg-emerald-50 border-emerald-400 font-bold text-emerald-900' : 'bg-white border-slate-200'
                    }`}
                  />
                </div>
              );
            })}
            <p className="text-[11px] text-slate-500">
              {q.correctIdx === null ? 'لسه محددتش الإجابة الصحيحة.' : `الإجابة الصحيحة: ${LETTERS[q.correctIdx]}`}
            </p>
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-600">
              شرح الحل (اختياري، بيظهر للطالب بعد التسليم):
            </label>
            <input
              type="text"
              value={q.expl}
              onChange={(e) => update(qi, { expl: e.target.value })}
              placeholder="مثلاً: ليه الإجابة دي هي الصح"
              className="w-full p-2 bg-white border border-slate-200 rounded-xl text-xs"
            />
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...questions, emptyManualQuestion()])}
        className="w-full py-2.5 rounded-2xl border-2 border-dashed border-indigo-300 bg-indigo-50 text-indigo-700 text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer hover:bg-indigo-100"
      >
        <Plus className="w-4 h-4" />
        إضافة سؤال
      </button>
    </div>
  );
};
