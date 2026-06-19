"use client";

import { useState, useEffect, useRef } from "react";
import { useApp } from "@/context/AppContext";
import { Send, Bot, User } from "lucide-react";

export default function AIChatPage() {
    const { selectedProfile } = useApp();
    const [question, setQuestion] = useState("");
    const [messages, setMessages] = useState<Array<{ role: "user" | "assistant"; content: string }>>([]);
    const [loading, setLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, loading]);

    const sendQuestion = async () => {
        if (!question.trim() || !selectedProfile) return;
        
        const userMsg = question.trim();
        setQuestion("");
        
        const currentHistory = [...messages];
        const updatedMessages = [...currentHistory, { role: "user" as const, content: userMsg }];
        
        setMessages(updatedMessages);
        setLoading(true);
        
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "https://unitas-backend.fly.dev"}/api/ai/chat`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ 
                    profile_id: selectedProfile.id, 
                    question: userMsg,
                    history: currentHistory.map(m => ({ role: m.role, content: m.content }))
                })
            });
            const data = await res.json();
            
            setMessages([...updatedMessages, { role: "assistant" as const, content: data.answer || data.response || "Немає відповіді від асистента" }]);
        } catch (err) {
            console.error("Failed to send question:", err);
            setMessages([...updatedMessages, { role: "assistant" as const, content: "Помилка зв'язку з сервером" }]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-6 max-w-4xl mx-auto">
            <h1 className="text-2xl font-bold mb-6 flex items-center gap-2">
                <Bot className="w-6 h-6" /> ШІ-асистент з податків
            </h1>
            
            <div className="p-4 h-[500px] overflow-y-auto mb-4 border rounded-lg bg-white">
                {messages.length === 0 && (
                    <div className="text-center text-gray-500 mt-40">
                        <Bot className="w-12 h-12 mx-auto mb-2" />
                        <p>Задайте будь-яке питання про податки</p>
                        <p className="text-sm mt-2">Наприклад: "Який військовий збір мені потрібно сплатити?"</p>
                    </div>
                )}
                {messages.map((msg, idx) => (
                    <div key={idx} className={`mb-3 ${msg.role === 'user' ? 'text-right' : 'text-left'}`}>
                        <div className={`inline-flex items-start gap-2 p-3 rounded-lg max-w-[80%] ${msg.role === 'user' ? 'bg-blue-600 text-white' : 'bg-gray-100'}`}>
                            {msg.role === 'assistant' && <Bot className="w-5 h-5 mt-0.5" />}
                            {msg.role === 'user' && <User className="w-5 h-5 mt-0.5" />}
                            <div className="whitespace-pre-wrap">{msg.content}</div>
                        </div>
                    </div>
                ))}
                {loading && <div className="text-gray-500">Друкує...</div>}
                <div ref={messagesEndRef} />
            </div>
            
            <div className="flex gap-2">
                <input
                    type="text"
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && sendQuestion()}
                    placeholder="Задайте питання..."
                    disabled={!selectedProfile}
                    className="flex-1 border rounded-lg p-3 disabled:opacity-50"
                />
                <button 
                    onClick={sendQuestion} 
                    disabled={loading || !selectedProfile}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700"
                >
                    <Send className="w-4 h-4" />
                </button>
            </div>
            
            {!selectedProfile && (
                <p className="text-sm text-gray-500 mt-2">Оберіть профіль для початку чату</p>
            )}
        </div>
    );
}
