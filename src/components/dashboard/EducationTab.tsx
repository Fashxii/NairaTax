import { useState, useRef, useEffect } from 'react';
import { motion } from 'motion/react';
import { HelpCircle, Send, Sparkles } from 'lucide-react';
import { useContent } from '../../context/ContentContext';
import { getAdvisorResponse, QUICK_ASK_QUESTIONS } from '../../utils/advisorEngine';
import { usePersistedState } from '../../hooks/usePersistedState';

interface ChatMessage {
  sender: 'user' | 'assistant';
  text: string;
  followUps?: string[];
}

export default function EducationTab() {
  const { content } = useContent();
  const [chatMessages, setChatMessages] = usePersistedState<ChatMessage[]>('chat_history', [
    { sender: 'assistant', text: content.dashboard.advisorIntroText }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, streamingText]);

  // Character-by-character streaming effect
  const streamResponse = (fullText: string, followUps: string[]) => {
    setIsTyping(true);
    setStreamingText('');
    let i = 0;
    const interval = setInterval(() => {
      if (i < fullText.length) {
        setStreamingText(fullText.slice(0, i + 1));
        i++;
      } else {
        clearInterval(interval);
        setStreamingText('');
        setChatMessages((prev) => [...prev, { sender: 'assistant', text: fullText, followUps }]);
        setIsTyping(false);
      }
    }, 8); // ~8ms per character for fast but visible streaming
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || isTyping) return;

    const userText = chatInput.trim();
    setChatMessages((prev) => [...prev, { sender: 'user', text: userText }]);
    setChatInput('');

    const { answer, followUps } = getAdvisorResponse(userText);
    
    // Short delay before streaming starts
    setTimeout(() => {
      streamResponse(answer, followUps);
    }, 400);
  };

  const handleQuickQuestion = (questionText: string) => {
    if (isTyping) return;
    setChatMessages((prev) => [...prev, { sender: 'user', text: questionText }]);

    const { answer, followUps } = getAdvisorResponse(questionText);
    
    setTimeout(() => {
      streamResponse(answer, followUps);
    }, 400);
  };

  const handleFollowUp = (question: string) => {
    handleQuickQuestion(question);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-6xl mx-auto text-left"
    >
      <div className="mb-6">
        <h2 className="text-2xl font-black text-primary-container tracking-tight">AI Tax Advisor</h2>
        <p className="text-xs text-on-surface-variant mt-1">Ask questions about Nigerian tax law, deductions, filing deadlines, and compliance</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Quick-Ask Question Sidebar */}
        <div className="md:col-span-1 space-y-2 overflow-y-auto max-h-[65vh] pr-2">
          <p className="font-bold text-[10px] uppercase tracking-widest text-on-surface-variant pb-2">Quick Questions</p>
          {QUICK_ASK_QUESTIONS.map((q, idx) => (
            <button 
              key={idx}
              onClick={() => handleQuickQuestion(q)}
              disabled={isTyping}
              className={`w-full text-left p-3 border border-outline-variant/50 rounded-xl hover:bg-surface-container-low hover:border-primary-container/30 transition-all cursor-pointer group ${isTyping ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <div className="flex items-start gap-2">
                <HelpCircle className="w-3.5 h-3.5 text-primary-container mt-0.5 flex-shrink-0 group-hover:text-primary" />
                <span className="text-[11px] font-semibold text-on-surface leading-snug">{q}</span>
              </div>
            </button>
          ))}
        </div>

        {/* Chat Interface */}
        <div className="md:col-span-2 bg-white border border-outline-variant/60 rounded-2xl flex flex-col max-h-[65vh] overflow-hidden shadow-xs">
          <div className="bg-primary-container text-white px-5 py-3.5 flex items-center space-x-2 rounded-t-2xl">
            <Sparkles className="w-4 h-4 text-accent-green" />
            <span className="font-bold text-xs uppercase tracking-wider">AI Tax Advisor</span>
            <span className="text-[9px] text-white/60 ml-auto">Powered by DIYtax9ja Knowledge Base</span>
          </div>

          {/* Messages */}
          <div className="flex-grow overflow-y-auto p-4 space-y-4">
            {chatMessages.map((msg, idx) => (
              <div key={idx}>
                <div className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] px-4 py-3 rounded-xl text-xs leading-relaxed whitespace-pre-line ${
                    msg.sender === 'user'
                      ? 'bg-primary-container text-white rounded-br-sm'
                      : 'bg-surface-container-low border border-outline-variant/40 text-on-surface rounded-bl-sm'
                  }`}>
                    {msg.text}
                  </div>
                </div>
                {/* Follow-up suggestions */}
                {msg.sender === 'assistant' && msg.followUps && msg.followUps.length > 0 && idx === chatMessages.length - 1 && (
                  <div className="flex flex-wrap gap-2 mt-2 ml-2">
                    {msg.followUps.map((fq, fIdx) => (
                      <button
                        key={fIdx}
                        onClick={() => handleFollowUp(fq)}
                        disabled={isTyping}
                        className="text-[10px] px-3 py-1.5 bg-primary-container/10 text-primary-container border border-primary-container/20 rounded-full hover:bg-primary-container/20 transition-colors cursor-pointer disabled:opacity-50"
                      >
                        {fq}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {/* Streaming text display */}
            {isTyping && streamingText && (
              <div className="flex justify-start">
                <div className="max-w-[85%] px-4 py-3 rounded-xl text-xs leading-relaxed whitespace-pre-line bg-surface-container-low border border-outline-variant/40 text-on-surface rounded-bl-sm">
                  {streamingText}
                  <span className="inline-block w-1.5 h-4 bg-primary-container ml-0.5 animate-pulse" />
                </div>
              </div>
            )}

            {/* Typing indicator (before stream starts) */}
            {isTyping && !streamingText && (
              <div className="flex justify-start">
                <div className="bg-surface-container-low border border-outline-variant/40 px-4 py-3 rounded-xl rounded-bl-sm">
                  <div className="flex items-center space-x-1.5">
                    <div className="w-1.5 h-1.5 bg-primary-container rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-1.5 h-1.5 bg-primary-container rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-1.5 h-1.5 bg-primary-container rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}

            <div ref={chatEndRef} />
          </div>

          {/* Input */}
          <form onSubmit={handleSendMessage} className="p-3 border-t border-outline-variant/40 flex gap-2">
            <input 
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Ask about Nigerian tax law, reliefs, deadlines..."
              disabled={isTyping}
              className="flex-grow bg-surface-container-low border border-outline-variant/60 rounded-lg px-4 py-2.5 text-xs text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:border-primary-container disabled:opacity-50"
            />
            <button 
              type="submit"
              disabled={!chatInput.trim() || isTyping}
              className="bg-primary-container text-white rounded-lg px-4 py-2.5 disabled:opacity-50 cursor-pointer hover:opacity-90 transition-opacity"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </motion.div>
  );
}
