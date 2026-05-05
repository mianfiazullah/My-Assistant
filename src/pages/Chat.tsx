import React, { useState, useRef, useEffect } from 'react';
import { 
  Send, 
  Bot, 
  User, 
  Loader2, 
  Trash2, 
  MessageSquare,
  Sparkles,
  ArrowLeft
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { toast } from 'sonner';
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export default function Chat() {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userInput = input.trim();
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: userInput,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [{ role: 'user', parts: [{ text: userInput }] }],
        config: {
          systemInstruction: "You are an expert assistant. You help users with billing issues, detection procedures, and using the application. Be professional, helpful, and concise.",
        }
      });

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.text || "I'm sorry, I couldn't generate a response.",
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error: any) {
      console.error('Chat Error:', error);
      toast.error(`Failed to get response from AI: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const clearChat = () => {
    setMessages([]);
    toast.success('Chat cleared');
  };

  return (
    <div className="flex flex-col h-[calc(100vh-120px)] bg-white rounded-3xl border border-neutral-200 overflow-hidden shadow-sm">
      {/* Header */}
      <div className="p-6 border-b border-neutral-200 flex items-center justify-between bg-neutral-50/50">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-neutral-200 rounded-full transition-colors lg:hidden"
          >
            <ArrowLeft className="w-5 h-5 text-neutral-600" />
          </button>
          <div className="bg-indigo-600 p-2.5 rounded-2xl shadow-lg shadow-indigo-600/20">
            <Bot className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-neutral-900">AI Assistant</h1>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <p className="text-xs text-neutral-500 font-medium">Online & Ready to Help</p>
            </div>
          </div>
        </div>
        <button 
          onClick={clearChat}
          className="p-2.5 text-neutral-400 hover:text-indigo-500 hover:bg-indigo-50 rounded-xl transition-all"
          title="Clear Chat"
        >
          <Trash2 className="w-5 h-5" />
        </button>
      </div>

      {/* Messages */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-6 space-y-6 scroll-smooth"
      >
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-60">
            <div className="bg-neutral-100 p-6 rounded-full">
              <MessageSquare className="w-12 h-12 text-neutral-400" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-neutral-900">Welcome to AI Support</h3>
              <p className="text-sm text-neutral-500 max-w-xs mx-auto">
                Ask me anything about billing, detection cases, or how to use this system.
              </p>
            </div>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {messages.map((msg) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  "flex gap-4 max-w-[85%]",
                  msg.role === 'user' ? "ml-auto flex-row-reverse" : "mr-auto"
                )}
              >
                <div className={cn(
                  "w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 shadow-sm",
                  msg.role === 'user' ? "bg-neutral-900" : "bg-indigo-600"
                )}>
                  {msg.role === 'user' ? (
                    <User className="w-5 h-5 text-white" />
                  ) : (
                    <Bot className="w-5 h-5 text-white" />
                  )}
                </div>
                <div className={cn(
                  "p-4 rounded-2xl shadow-sm",
                  msg.role === 'user' 
                    ? "bg-neutral-900 text-white rounded-tr-none" 
                    : "bg-neutral-50 border border-neutral-200 text-neutral-900 rounded-tl-none"
                )}>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                  <p className={cn(
                    "text-[10px] mt-2 font-medium opacity-50",
                    msg.role === 'user' ? "text-right" : "text-left"
                  )}>
                    {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
        {isLoading && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex gap-4 mr-auto max-w-[85%]"
          >
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center shrink-0 shadow-sm">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <div className="bg-neutral-50 border border-neutral-200 p-4 rounded-2xl rounded-tl-none flex items-center gap-2">
              <Loader2 className="w-4 h-4 text-indigo-600 animate-spin" />
              <span className="text-sm text-neutral-500 font-medium italic">AI is thinking...</span>
            </div>
          </motion.div>
        )}
      </div>

      {/* Input */}
      <div className="p-6 border-t border-neutral-200 bg-neutral-50/50">
        <div className="relative group">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Type your message here..."
            className="w-full bg-white border border-neutral-200 rounded-2xl py-4 pl-6 pr-16 text-neutral-900 focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 transition-all shadow-sm"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="absolute right-2 top-1/2 -translate-y-1/2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-neutral-200 text-white p-2.5 rounded-xl transition-all shadow-lg shadow-indigo-600/20 disabled:shadow-none"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </div>
        <div className="mt-3 flex items-center justify-center gap-2 text-[10px] text-neutral-400 font-bold uppercase tracking-widest">
          <Sparkles className="w-3 h-3" />
          <span>Powered by Gemini AI</span>
        </div>
      </div>
    </div>
  );
}
