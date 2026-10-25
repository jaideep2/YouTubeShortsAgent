import React, { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Bot,
  ChevronDown,
  Loader2,
  MessageSquareText,
  Send,
  Sparkles,
  CheckCircle2,
} from 'lucide-react';
import type { AgentChatMessage } from '../types/edl';

interface AgentChatPanelProps {
  messages: AgentChatMessage[];
  suggestedPrompts: string[];
  isSending: boolean;
  onSendMessage: (message: string) => Promise<void>;
  variant?: 'hero' | 'floating';
}

export const AgentChatPanel: React.FC<AgentChatPanelProps> = ({
  messages,
  suggestedPrompts,
  isSending,
  onSendMessage,
  variant = 'hero',
}) => {
  const [inputText, setInputText] = useState('');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inputText.trim();
    if (!trimmed || isSending) return;
    setInputText('');
    await onSendMessage(trimmed);
  };

  const handleQuickPrompt = async (promptText: string) => {
    if (isSending) return;
    await onSendMessage(promptText);
  };

  if (variant === 'floating') {
    return (
      <div className="fixed bottom-5 right-5 z-[350] flex flex-col items-end">
        <AnimatePresence>
          {isDrawerOpen && (
            <motion.div
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 300, damping: 24 }}
              className="mb-3 w-[350px] sm:w-[400px] rounded-3xl bg-[#FAF7F2] border-2 border-[#1F1C18] shadow-[0_24px_50px_-12px_rgba(31,28,24,0.35)] overflow-hidden flex flex-col max-h-[520px]"
            >
              <div className="px-4 py-3 bg-[#1F1C18] text-[#FAF7F2] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-xl bg-[#E05A47] text-white flex items-center justify-center">
                    <Bot className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold">YouTubeShortsAgent Chat</div>
                    <div className="text-[10px] text-[#E8E0D2]">
                      Ask me to frame, trim, or write titles
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsDrawerOpen(false)}
                  className="p-1 rounded-full hover:bg-white/10 text-[#FAF7F2] cursor-pointer"
                >
                  <ChevronDown className="w-4 h-4" />
                </button>
              </div>

              <div className="flex-1 p-4 space-y-3 overflow-y-auto max-h-[300px] bg-[#FAF7F2]">
                {messages.slice(-6).map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${
                      msg.role === 'user' ? 'items-end' : 'items-start'
                    }`}
                  >
                    <div
                      className={`max-w-[88%] px-3.5 py-2.5 rounded-2xl text-xs leading-relaxed ${
                        msg.role === 'user'
                          ? 'bg-[#E05A47] text-white font-medium rounded-br-xs'
                          : 'bg-[#F3EDE2] text-[#1F1C18] border border-[#E8E0D2] rounded-bl-xs'
                      }`}
                    >
                      {msg.text}
                    </div>
                    {msg.appliedActions && msg.appliedActions.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {msg.appliedActions.map((act, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#2D8A61]/15 text-[#2D8A61] text-[10px] font-bold"
                          >
                            <CheckCircle2 className="w-2.5 h-2.5" />
                            <span>{act}</span>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {suggestedPrompts.length > 0 && (
                <div className="px-3.5 py-2 bg-[#F3EDE2]/60 border-t border-[#E8E0D2] flex flex-wrap gap-1.5">
                  {suggestedPrompts.map((prompt, idx) => (
                    <button
                      key={idx}
                      type="button"
                      disabled={isSending}
                      onClick={() => handleQuickPrompt(prompt)}
                      className="px-2.5 py-1 rounded-full bg-[#FAF7F2] border border-[#D8CEBE] text-[11px] font-semibold text-[#1F1C18] hover:border-[#E05A47] transition-colors cursor-pointer"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              )}

              <form
                onSubmit={handleSubmit}
                className="p-2.5 bg-[#F3EDE2] border-t border-[#E8E0D2] flex items-center gap-2"
              >
                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="Tell your agent what to do..."
                  className="flex-1 px-3.5 py-2 rounded-full bg-[#FAF7F2] border border-[#D8CEBE] text-xs text-[#1F1C18] focus:outline-none focus:border-[#E05A47]"
                />
                <button
                  type="submit"
                  disabled={!inputText.trim() || isSending}
                  className="w-8 h-8 rounded-full bg-[#E05A47] text-white flex items-center justify-center disabled:opacity-50 cursor-pointer shrink-0"
                >
                  {isSending ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Send className="w-3.5 h-3.5" />
                  )}
                </button>
              </form>
            </motion.div>
          )}
        </AnimatePresence>

        <button
          type="button"
          onClick={() => setIsDrawerOpen((v) => !v)}
          className="inline-flex items-center gap-2 px-4 py-3 rounded-full bg-[#1F1C18] text-[#FAF7F2] text-xs font-bold shadow-[0_12px_28px_-6px_rgba(31,28,24,0.45)] border-2 border-[#E05A47] hover:scale-105 transition-transform cursor-pointer"
        >
          <MessageSquareText className="w-4 h-4 text-[#F59E0B]" />
          <span>{isDrawerOpen ? 'Hide Agent Chat' : 'Chat with Shorts Agent'}</span>
        </button>
      </div>
    );
  }

  // Front-and-center Hero Chat on /drop
  return (
    <div className="hum-card-warm p-6 sm:p-7 space-y-4 border-2 border-[#E05A47]/45">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#E05A47] text-white flex items-center justify-center shadow-sm">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg sm:text-xl text-[#1F1C18]">
                Chat with Your YouTubeShortsAgent
              </h2>
              <span className="px-2.5 py-0.5 rounded-full bg-[#2D8A61]/15 text-[#2D8A61] text-[11px] font-bold">
                Do Everything by Chat
              </span>
            </div>
            <p className="text-xs text-[#4A433B]">
              Paste a YouTube link right here or tell the agent how you want your Shorts
              framed, trimmed, and titled—or use the step-by-step controls below.
            </p>
          </div>
        </div>
      </div>

      {/* Conversation History */}
      <div className="p-4 rounded-2xl bg-[#FAF7F2] border border-[#E8E0D2] space-y-3 max-h-[220px] overflow-y-auto">
        {messages.slice(-4).map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col ${
              msg.role === 'user' ? 'items-end' : 'items-start'
            }`}
          >
            <div
              className={`max-w-[85%] px-4 py-2.5 rounded-2xl text-xs sm:text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-[#E05A47] text-white font-medium rounded-br-xs'
                  : 'bg-[#F3EDE2] text-[#1F1C18] border border-[#E8E0D2] rounded-bl-xs'
              }`}
            >
              {msg.text}
            </div>
            {msg.appliedActions && msg.appliedActions.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {msg.appliedActions.map((act, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#2D8A61]/15 text-[#2D8A61] text-[11px] font-bold"
                  >
                    <CheckCircle2 className="w-3 h-3" />
                    <span>{act}</span>
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Quick Starter Chips */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-bold text-[#786F63] inline-flex items-center gap-1">
          <Sparkles className="w-3 h-3 text-[#F59E0B]" />
          <span>Try asking:</span>
        </span>
        {suggestedPrompts.map((prompt, idx) => (
          <button
            key={idx}
            type="button"
            disabled={isSending}
            onClick={() => handleQuickPrompt(prompt)}
            className="px-3 py-1 rounded-full bg-[#F3EDE2] border border-[#D8CEBE] text-xs font-semibold text-[#1F1C18] hover:border-[#E05A47] hover:bg-[#FAF7F2] transition-colors cursor-pointer"
          >
            {prompt}
          </button>
        ))}
      </div>

      {/* Chat Input Bar */}
      <form onSubmit={handleSubmit} className="flex items-center gap-2.5">
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder='e.g. "Find the best Shorts from https://www.youtube.com/watch?v=lggpuoaP_C8 and frame for 2 speakers"'
          className="flex-1 px-4 py-3 rounded-2xl bg-[#FAF7F2] border-2 border-[#E8E0D2] text-sm font-medium text-[#1F1C18] placeholder-[#786F63]/70 focus:outline-none focus:border-[#E05A47]"
        />
        <button
          type="submit"
          disabled={!inputText.trim() || isSending}
          className="btn btn--primary px-5 py-3 text-sm shrink-0"
        >
          {isSending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Working...</span>
            </>
          ) : (
            <>
              <Send className="w-4 h-4" />
              <span>Ask Agent</span>
            </>
          )}
        </button>
      </form>
    </div>
  );
};
