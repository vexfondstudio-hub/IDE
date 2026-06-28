import React, { useState, useRef, useEffect, memo, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Send, Bot, User } from "lucide-react";

interface Message {
  role: "user" | "assistant" | "system";
  content: string;
}

export const AIChat = memo(() => {
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: "Hello! I am your AI assistant. How can I help you write code today?" }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endOfMessagesRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = useCallback(async () => {
    if (!input.trim() || loading) return;

    const newMsg: Message = { role: "user", content: input };
    const updatedMessages = [...messages, newMsg];
    setMessages(updatedMessages);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: updatedMessages }),
      });
      const data = await res.json();
      if (data.reply) {
        setMessages([...updatedMessages, { role: "assistant", content: data.reply }]);
      }
    } catch (err) {
      console.error(err);
      setMessages([...updatedMessages, { role: "assistant", content: "**Error**: Failed to communicate with AI." }]);
    } finally {
      setLoading(false);
    }
  }, [input, loading, messages]);

  return (
    <div className="w-full h-full flex flex-col bg-[#0F111A]">
      <div className="h-10 border-b border-white/5 flex items-center justify-between px-4 shrink-0 bg-[#141620]">
        <h2 className="text-sm font-medium text-slate-400">AI Assistant</h2>
        <button 
          onClick={() => setMessages([{ role: "assistant", content: "Hello! I am your AI assistant. How can I help you write code today?" }])}
          className="text-[10px] text-slate-500 hover:text-white px-2 py-1 rounded hover:bg-white/5 transition-colors"
        >
          Clear Chat
        </button>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-sm">
        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${msg.role === "user" ? "bg-blue-600/20 text-blue-400" : "bg-purple-600/20 text-purple-400"}`}>
              {msg.role === "user" ? <User size={16} /> : <Bot size={16} />}
            </div>
            <div className={`max-w-[80%] rounded-xl px-4 py-3 ${msg.role === "user" ? "bg-blue-600/10 text-blue-100" : "bg-white/5 text-slate-300"}`}>
              <div className="prose prose-invert prose-sm max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {msg.content}
                </ReactMarkdown>
              </div>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-purple-600/20 text-purple-400 flex items-center justify-center shrink-0">
              <Bot size={16} />
            </div>
            <div className="max-w-[80%] rounded-xl px-4 py-3 bg-white/5 text-slate-400 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-purple-400 animate-bounce" />
              <div className="w-2 h-2 rounded-full bg-purple-400 animate-bounce delay-100" />
              <div className="w-2 h-2 rounded-full bg-purple-400 animate-bounce delay-200" />
            </div>
          </div>
        )}
        <div ref={endOfMessagesRef} />
      </div>

      <div className="p-4 border-t border-white/5 bg-[#141620]">
        <div className="flex items-center gap-2 bg-[#0F111A] border border-white/10 rounded-lg pr-2 focus-within:border-purple-500/50 transition-colors">
          <input
            type="text"
            className="flex-1 bg-transparent px-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none"
            placeholder="Ask AI to write code or explain..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
          />
          <button
            onClick={handleSend}
            disabled={loading || !input.trim()}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-md transition-all disabled:opacity-50 disabled:hover:bg-transparent"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
});
