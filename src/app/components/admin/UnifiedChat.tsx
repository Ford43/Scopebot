import { useState, useEffect, useRef } from "react";
import { Search, Send, CheckCircle, Clock, User, Bot, Headphones, AlertTriangle } from "lucide-react";

// Types อ้างอิงตามโครงสร้าง DB ใน README
interface LiveSession {
  id: string;
  line_display_name: string;
  mode: "bot" | "waiting" | "human";
  bot_id: string;
  started_at: string;
}

interface LiveMessage {
  id: string;
  message: string;
  sender_type: "customer" | "bot" | "staff";
  created_at: string;
}

export default function UnifiedChat() {
  const [sessions, setSessions] = useState<LiveSession[]>([]);
  const [activeSession, setActiveSession] = useState<LiveSession | null>(null);
  const [messages, setMessages] = useState<LiveMessage[]>([]);
  const [replyText, setReplyText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const token = localStorage.getItem("scopebot_token");

  // 1. ดึงรายการ Session ที่กำลังรอเจ้าหน้าที่หรือคุยอยู่ (Polling ทุก 5 วินาที)
  useEffect(() => {
    const fetchSessions = async () => {
      try {
        // ดึง session ทั้งหมดที่ยัง active อยู่ 
        const res = await fetch("/api/live/sessions", {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          // 🟢 กรองเอาเฉพาะลูกค้าที่ "รอตอบ" หรือ "กำลังคุยอยู่กับแอดมิน"
          setSessions(data.filter((s: any) => s.mode === "waiting" || s.mode === "human"));
        }
      } catch (error) {
        console.error("Failed to fetch sessions", error);
      }
    };

    fetchSessions(); // ดึงครั้งแรก
    const interval = setInterval(fetchSessions, 5000); // อัปเดตทุก 5 วินาที
    return () => clearInterval(interval);
  }, [token]);

  // 2. ดึงประวัติแชทเมื่อคลิกเลือก Session
  useEffect(() => {
    if (!activeSession) return;
    const fetchMessages = async () => {
      try {
        const res = await fetch(`/api/live/sessions/${activeSession.id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setMessages(data.messages || []); // สมมติว่า API ส่งกลับมาในฟิลด์ messages
          setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
        }
      } catch (error) {
        console.error("Failed to fetch messages", error);
      }
    };

    fetchMessages();
    const interval = setInterval(fetchMessages, 3000); // ดึงข้อความใหม่ทุก 3 วินาที
    return () => clearInterval(interval);
  }, [activeSession, token]);

  // 3. ฟังก์ชันส่งข้อความ
  const handleSendReply = async () => {
    if (!replyText.trim() || !activeSession) return;
    setIsSending(true);

    try {
      const res = await fetch(`/api/live/sessions/${activeSession.id}/reply`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ message: replyText })
      });

      if (res.ok) {
        setReplyText("");
        // ดึงข้อความใหม่ทันทีหลังส่งเสร็จ
        const updatedRes = await fetch(`/api/live/sessions/${activeSession.id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (updatedRes.ok) {
          const data = await updatedRes.json();
          setMessages(data.messages || []);
          setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
        }
      }
    } catch (error) {
      console.error("Reply error:", error);
    } finally {
      setIsSending(false);
    }
  };

  // 4. ฟังก์ชันจบการสนทนา (คืนการตอบให้ Bot)
  const handleEndSession = async () => {
    if (!activeSession) return;
    if (!window.confirm("ต้องการจบการสนทนาและให้บอทกลับมาทำงานต่อใช่หรือไม่?")) return;

    try {
      const res = await fetch(`/api/live/sessions/${activeSession.id}/end`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.ok) {
        setActiveSession(null);
        setMessages([]);
        alert("จบการสนทนาเรียบร้อย บอทกลับมาทำงานแล้ว");
      }
    } catch (error) {
      console.error("End session error:", error);
    }
  };

  return (
    <div className="flex h-[calc(100vh-140px)] bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
      
      {/* ฝั่งซ้าย: รายการคิวลูกค้า */}
      <div className="w-1/3 border-r border-gray-200 flex flex-col bg-gray-50/50">
        <div className="p-4 border-b border-gray-200 bg-white">
          <h2 className="text-lg font-bold text-gray-800 flex items-center justify-between">
            ลูกค้าที่รอสาย
            <span className="bg-red-100 text-red-600 text-xs px-2 py-1 rounded-full font-semibold">
              {sessions.length} รอตอบ
            </span>
          </h2>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {sessions.length === 0 ? (
            <div className="text-center text-gray-400 mt-10">
              <CheckCircle className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">ไม่มีคิวค้างตอบ</p>
            </div>
          ) : (
            sessions.map((session) => (
              <div
                key={session.id}
                onClick={() => setActiveSession(session)}
                className={`p-3 rounded-xl cursor-pointer transition-all border ${
                  activeSession?.id === session.id
                    ? "bg-amber-50 border-amber-300 shadow-sm"
                    : "bg-white border-gray-200 hover:border-amber-300"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <h3 className="font-semibold text-sm text-gray-900 truncate">
                    {session.line_display_name}
                  </h3>
                  {session.mode === "waiting" && (
                    <span className="flex items-center gap-1 text-[10px] bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-medium">
                      <AlertTriangle className="w-3 h-3" /> รอการตอบกลับ
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {new Date(session.started_at).toLocaleTimeString('th-TH')}
                </p>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ฝั่งขวา: หน้าต่างแชท */}
      <div className="flex-1 flex flex-col bg-white relative">
        {activeSession ? (
          <>
            {/* Header ของแชท */}
            <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-white z-10 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                  <User className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h2 className="font-bold text-gray-800">{activeSession.line_display_name}</h2>
                  <p className="text-xs text-gray-500">ผ่าน Line OA (Bot ID: {activeSession.bot_id})</p>
                </div>
              </div>
              <button
                onClick={handleEndSession}
                className="flex items-center gap-1.5 px-4 py-2 bg-gray-100 hover:bg-red-50 text-gray-600 hover:text-red-600 text-sm rounded-lg transition-colors border border-gray-200 hover:border-red-200 font-medium"
              >
                <CheckCircle className="w-4 h-4" />
                จบการสนทนา (คืนบอท)
              </button>
            </div>

            {/* พื้นที่แสดงข้อความ */}
            <div className="flex-1 overflow-y-auto p-6 bg-gray-50 space-y-4">
              {messages.map((msg, idx) => {
                const isCustomer = msg.sender_type === "customer";
                const isBot = msg.sender_type === "bot";
                
                return (
                  <div key={idx} className={`flex ${isCustomer ? "justify-start" : "justify-end"}`}>
                    <div className={`flex gap-2 max-w-[75%] ${isCustomer ? "flex-row" : "flex-row-reverse"}`}>
                      
                      {/* Avatar */}
                      <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-1 shadow-sm">
                        {isCustomer ? (
                          <div className="w-full h-full bg-blue-100 rounded-full flex items-center justify-center"><User className="w-4 h-4 text-blue-600" /></div>
                        ) : isBot ? (
                          <div className="w-full h-full bg-gray-200 rounded-full flex items-center justify-center"><Bot className="w-4 h-4 text-gray-600" /></div>
                        ) : (
                          <div className="w-full h-full bg-amber-400 rounded-full flex items-center justify-center"><Headphones className="w-4 h-4 text-gray-900" /></div>
                        )}
                      </div>

                      {/* Message Bubble */}
                      <div className="flex flex-col">
                        <span className={`text-[10px] text-gray-400 mb-1 ${isCustomer ? "text-left ml-1" : "text-right mr-1"}`}>
                          {isBot ? "บอทตอบอัตโนมัติ" : isCustomer ? activeSession.line_display_name : "เจ้าหน้าที่ (คุณ)"} • {new Date(msg.created_at).toLocaleTimeString('th-TH')}
                        </span>
                        <div className={`p-3 rounded-2xl shadow-sm text-sm whitespace-pre-line ${
                          isCustomer 
                            ? "bg-white border border-gray-200 text-gray-800 rounded-tl-none" 
                            : isBot
                            ? "bg-gray-100 text-gray-600 rounded-tr-none"
                            : "bg-amber-400 text-gray-900 rounded-tr-none"
                        }`}>
                          {msg.message}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Input สำหรับพิมพ์ตอบ */}
            <div className="p-4 border-t border-gray-200 bg-white">
              <div className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-xl p-2 focus-within:border-amber-400 focus-within:ring-2 focus-within:ring-amber-100 transition-all">
                <textarea
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSendReply();
                    }
                  }}
                  placeholder="พิมพ์ข้อความเพื่อตอบลูกค้า... (กด Enter เพื่อส่ง)"
                  className="flex-1 bg-transparent border-none focus:outline-none resize-none px-2 text-sm max-h-32 min-h-[40px] pt-2"
                  rows={1}
                />
                <button
                  onClick={handleSendReply}
                  disabled={!replyText.trim() || isSending}
                  className="w-10 h-10 flex-shrink-0 bg-amber-400 hover:bg-amber-500 text-gray-900 rounded-lg flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <Headphones className="w-16 h-16 mb-4 opacity-20" />
            <p className="text-lg font-semibold text-gray-500">เลือกรายการสนทนาเพื่อเริ่มต้นดูแลลูกค้า</p>
            <p className="text-sm mt-2">เมื่อพิมพ์ตอบ ข้อความจะถูกส่งไปที่ Line ของลูกค้าโดยตรง</p>
          </div>
        )}
      </div>
    </div>
  );
}