import React, { useState, useRef, useEffect } from 'react';
import {
  MessageSquare,
  Sparkles,
  Send,
  X,
  Bot,
  Minimize2,
  Copy,
  Check,
  HelpCircle,
  Lightbulb,
  BookOpen,
} from 'lucide-react';
import { Profile, AiMessage } from '../../types/database';
import { db } from '../../services/mockDatabase';
import { askTutor } from '../../services/tutorService';

interface FloatingAiTutorProps {
  currentStudent: Profile;
}

export const FloatingAiTutor: React.FC<FloatingAiTutorProps> = ({ currentStudent }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<AiMessage[]>(() =>
    db.getAiMessages(currentStudent.id)
  );

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen, chatMessages, isTyping]);

  // Sync messages from db state
  useEffect(() => {
    const unsubscribe = db.subscribe(() => {
      setChatMessages([...db.getAiMessages(currentStudent.id)]);
    });
    return unsubscribe;
  }, [currentStudent.id]);

  const handleSend = async (textToSend?: string) => {
    const query = (textToSend || chatInput).trim();
    if (!query || isTyping) return;

    setChatInput('');
    db.sendAiMessage(currentStudent.id, query);
    setChatMessages([...db.getAiMessages(currentStudent.id)]);
    setIsTyping(true);

    try {
      const r = await askTutor(currentStudent, query);
      db.updateLastAiAssistantMessage(currentStudent.id, r.text);
      setChatMessages([...db.getAiMessages(currentStudent.id)]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const quickPrompts = [
    { text: '💡 لخص لي أهم نقاط درس اليوم', icon: Lightbulb },
    { text: '❓ اطرح عليّ سؤالاً ذكياً لاختباري', icon: HelpCircle },
    { text: '📖 كيف أستذكر هذا المنهج بأعلى كفاءة؟', icon: BookOpen },
  ];

  return (
    <>
      {/* ======================================================== */}
      {/* Floating AI Chat Window with Smooth Springy Animation     */}
      {/* ======================================================== */}
      {isOpen && (
        <div
          className="fixed bottom-24 right-4 sm:right-6 z-50 w-[calc(100vw-2rem)] sm:w-[420px] h-[580px] max-h-[calc(100vh-7.5rem)] bg-white/95 backdrop-blur-xl border-2 border-indigo-200/80 rounded-3xl shadow-2xl shadow-indigo-900/20 flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-8 zoom-in-95 duration-250 ease-out"
          dir="rtl"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-purple-700 text-white p-4 flex items-center justify-between shrink-0 shadow-md">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-10 h-10 rounded-2xl bg-white/15 border border-white/20 backdrop-blur-md flex items-center justify-center text-xl shadow-inner">
                  🤖
                </div>
                <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-emerald-400 border-2 border-indigo-700 rounded-full animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-black text-sm text-white">المعلم الذكي (AI Tutor)</h3>
                  <span className="bg-emerald-400/20 text-emerald-300 border border-emerald-400/30 text-[10px] font-bold px-2 py-0.5 rounded-full">
                    متصل 🟢
                  </span>
                </div>
                <p className="text-[11px] text-indigo-100 opacity-90 mt-0.5">
                  مساعدك الأكاديمي لمنهج {currentStudent.grade_level || 'الدراسي'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-xl hover:bg-white/15 text-indigo-100 hover:text-white transition-colors cursor-pointer"
                title="تصغير"
              >
                <Minimize2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-xl hover:bg-rose-500/30 text-indigo-100 hover:text-white transition-colors cursor-pointer"
                title="إغلاق"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Subheader Banner */}
          <div className="bg-indigo-50/70 border-b border-indigo-100/80 px-4 py-2 flex items-center justify-between text-[11px] text-indigo-900 shrink-0">
            <span className="flex items-center gap-1.5 font-bold">
              <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
              <span>مدعوم بنموذج Google Gemini وذاكرة المنهج</span>
            </span>
            <span className="text-[10px] text-indigo-600/80 font-medium">متاح 24/7</span>
          </div>

          {/* Messages Container */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/60 scrollbar-thin">
            {chatMessages.length === 0 ? (
              <div className="text-center py-10 px-4">
                <div className="w-14 h-14 mx-auto rounded-3xl bg-indigo-100 text-indigo-600 flex items-center justify-center text-2xl mb-3 shadow-inner">
                  👋
                </div>
                <h4 className="text-sm font-bold text-slate-800">
                  أهلاً بك يا {currentStudent.full_name}!
                </h4>
                <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto leading-relaxed">
                  أنا معلمك ومساعدك الأكاديمي الذكي. اسألني في أي مسألة أو درس في منهجك وسأشرحه لك فوراً!
                </p>
              </div>
            ) : (
              chatMessages.map((msg) => {
                const isUser = msg.sender === 'user';
                return (
                  <div
                    key={msg.id}
                    className={`flex gap-2.5 text-xs sm:text-sm ${
                      isUser ? 'justify-end' : 'justify-start'
                    }`}
                  >
                    {!isUser && (
                      <div className="w-7 h-7 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center text-xs shrink-0 shadow-xs mt-1">
                        🤖
                      </div>
                    )}
                    <div
                      className={`relative group p-3.5 rounded-2xl max-w-[82%] leading-relaxed ${
                        isUser
                          ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-medium rounded-bl-xs shadow-sm'
                          : 'bg-white border border-slate-200 text-slate-800 rounded-br-xs shadow-xs'
                      }`}
                    >
                      <p className="whitespace-pre-wrap">{msg.message}</p>
                      <div
                        className={`text-[9px] mt-1.5 flex items-center justify-between gap-2 ${
                          isUser ? 'text-indigo-200' : 'text-slate-400'
                        }`}
                      >
                        <span>
                          {new Date(msg.created_at).toLocaleTimeString('ar-EG', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                        {!isUser && (
                          <button
                            onClick={() => handleCopy(msg.id, msg.message)}
                            className="opacity-0 group-hover:opacity-100 transition-opacity hover:text-indigo-600 cursor-pointer flex items-center gap-1"
                            title="نسخ الإجابة"
                          >
                            {copiedId === msg.id ? (
                              <Check className="w-3 h-3 text-emerald-600" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}

            {/* Typing Indicator */}
            {isTyping && (
              <div className="flex items-center gap-2 text-xs text-indigo-700 bg-indigo-50 border border-indigo-200/80 rounded-2xl p-3 w-fit animate-pulse">
                <div className="w-6 h-6 rounded-lg bg-indigo-600 text-white flex items-center justify-center text-xs shrink-0">
                  🤖
                </div>
                <span className="font-bold">المعلم الذكي يكتب لك الإجابة الآن...</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick Prompts Suggestions */}
          <div className="px-3 py-2 bg-slate-100/70 border-t border-slate-200/80 flex items-center gap-1.5 overflow-x-auto scrollbar-none shrink-0">
            {quickPrompts.map((qp, idx) => {
              const QpIcon = qp.icon;
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSend(qp.text)}
                  className="px-2.5 py-1 rounded-xl bg-white hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 text-[11px] font-bold text-slate-700 hover:text-indigo-700 whitespace-nowrap transition-colors flex items-center gap-1 cursor-pointer shrink-0 shadow-2xs"
                >
                  <QpIcon className="w-3 h-3 text-indigo-600" />
                  <span>{qp.text}</span>
                </button>
              );
            })}
          </div>

          {/* Chat Input */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="p-3 bg-white border-t border-slate-200 flex items-center gap-2 shrink-0"
          >
            <input
              ref={inputRef}
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="اطرح سؤالك في المنهج وسأجيبك فوراً..."
              className="flex-1 p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm font-semibold focus:bg-white focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 outline-hidden transition-all"
              disabled={isTyping}
            />
            <button
              type="submit"
              disabled={!chatInput.trim() || isTyping}
              className="p-3 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-40 text-white font-bold transition-all shadow-md shadow-indigo-600/30 cursor-pointer disabled:cursor-not-allowed shrink-0"
              title="إرسال"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}

      {/* ======================================================== */}
      {/* Floating Circular AI Trigger Button at Bottom Right      */}
      {/* ======================================================== */}
      <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3">
        {/* Subtle Greeting Badge (only when closed) */}
        {!isOpen && (
          <div
            onClick={() => setIsOpen(true)}
            className="hidden sm:flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-white/95 backdrop-blur-md border border-indigo-200 text-indigo-900 text-xs font-bold shadow-xl shadow-slate-900/10 cursor-pointer hover:border-indigo-400 hover:scale-105 transition-all animate-bounce duration-1000"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
            <span>اسأل المعلم الذكي 🤖</span>
          </div>
        )}

        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`relative group flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 rounded-full text-white shadow-2xl transition-all duration-300 cursor-pointer ${
            isOpen
              ? 'bg-slate-900 hover:bg-slate-800 shadow-slate-900/40 rotate-90'
              : 'bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 hover:scale-110 active:scale-95 shadow-indigo-600/50 hover:shadow-indigo-600/80'
          }`}
          title={isOpen ? 'إغلاق المحادثة' : 'فتح المعلم الذكي'}
        >
          {/* Animated Glow Aura when closed */}
          {!isOpen && (
            <span className="absolute -inset-1 rounded-full bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 opacity-60 blur-xs animate-pulse pointer-events-none group-hover:opacity-100 transition-opacity" />
          )}

          {isOpen ? (
            <X className="w-6 h-6 text-white relative z-10 transition-transform" />
          ) : (
            <div className="relative z-10 flex flex-col items-center justify-center">
              <Bot className="w-7 h-7 sm:w-8 sm:h-8 group-hover:scale-110 transition-transform" />
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-400 border-2 border-indigo-600 rounded-full animate-ping" />
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-400 border-2 border-indigo-600 rounded-full" />
            </div>
          )}
        </button>
      </div>
    </>
  );
};
