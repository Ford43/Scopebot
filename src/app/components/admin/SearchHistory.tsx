import { useEffect, useState } from "react";
import { Search, Clock, MessageSquare, ChevronDown, ChevronUp, Smartphone, Globe, Bot } from "lucide-react";

interface ChatMessage { id: number; question: string; answer: string; is_answered_by_bot: boolean; created_at: string; }
interface ChatSession {
  session_id: string; bot_id: string; bot_name: string;
  title: string; source_channel: string;
  started_at: string; last_at: string;
  msg_count: number; answered_count: number;
  messages: ChatMessage[];
}
interface BotItem { bot_id: string; name: string; }

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr + "Z").getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "เมื่อกี้";
  if (mins < 60) return `${mins} นาทีที่แล้ว`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} ชั่วโมงที่แล้ว`;
  const days = Math.floor(hrs / 24);
  return days === 1 ? "เมื่อวาน" : `${days} วันที่แล้ว`;
}

export default function SearchHistory() {
  const [bots, setBots] = useState<BotItem[]>([]);
  const [selectedBot, setSelectedBot] = useState("all");
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const LIMIT = 20;

  // โหลด Bot list
  useEffect(() => {
    const token = localStorage.getItem("scopebot_token");
    fetch("/api/bots/", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => setBots(Array.isArray(data) ? data : []));
  }, []);

  // โหลด Sessions
  useEffect(() => {
    setLoading(true);
    const token = localStorage.getItem("scopebot_token");
    let url = `/api/chat/sessions/all?page=${page}&limit=${LIMIT}`;
    if (selectedBot !== "all") url += `&bot_id_filter=${selectedBot}`;

    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => { setSessions(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [selectedBot, page]);

  const filtered = sessions.filter(s =>
    s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.bot_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-gray-900">ประวัติการสนทนา</h1>
        <span className="text-sm text-gray-400">{filtered.length} sessions</span>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <select
          aria-label="เลือก Bot"
          value={selectedBot}
          onChange={e => { setSelectedBot(e.target.value); setPage(1); }}
          className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white text-gray-700 outline-none"
        >
          <option value="all">บอททั้งหมด</option>
          {bots.map(b => <option key={b.bot_id} value={b.bot_id}>{b.name}</option>)}
        </select>

        <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2 bg-white">
          <Search className="w-4 h-4 text-gray-400" />
          <input
            type="text" value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="ค้นหาการสนทนา..."
            className="text-sm text-gray-600 outline-none bg-transparent w-44"
          />
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 border-4 border-amber-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-gray-400">
          <MessageSquare className="w-12 h-12 mb-3 opacity-30" />
          <p className="text-sm">ไม่พบประวัติการสนทนา</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map(session => (
            <div key={session.session_id} className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
              {/* Session header — กดเพื่อขยาย */}
              <div
                className="flex items-center gap-3 px-5 py-4 cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => setExpandedId(expandedId === session.session_id ? null : session.session_id)}
              >
                {/* Bot icon */}
                <div className="w-9 h-9 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <Bot className="w-4 h-4 text-amber-600" />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-sm font-semibold text-gray-800 truncate">{session.title}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <Bot className="w-2.5 h-2.5" />{session.bot_name}
                    </span>
                    {session.source_channel === "line" ? (
                      <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <Smartphone className="w-2.5 h-2.5" />Line
                      </span>
                    ) : (
                      <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <Globe className="w-2.5 h-2.5" />Web
                      </span>
                    )}
                    <span className="text-[10px] text-gray-400 flex items-center gap-1">
                      <Clock className="w-2.5 h-2.5" />{timeAgo(session.last_at)}
                    </span>
                  </div>
                </div>

                {/* Stats */}
                <div className="flex items-center gap-3 flex-shrink-0 text-right">
                  <div className="hidden sm:block">
                    <p className="text-xs text-gray-400">ข้อความ</p>
                    <p className="text-sm font-bold text-gray-700">{session.msg_count}</p>
                  </div>
                  <div className="hidden sm:block">
                    <p className="text-xs text-gray-400">ตอบได้</p>
                    <p className="text-sm font-bold text-green-600">{session.answered_count}</p>
                  </div>
                  {expandedId === session.session_id
                    ? <ChevronUp className="w-4 h-4 text-gray-400" />
                    : <ChevronDown className="w-4 h-4 text-gray-400" />
                  }
                </div>
              </div>

              {/* Messages — ขยายออกมา */}
              {expandedId === session.session_id && (
                <div className="border-t border-gray-100 bg-gray-50 px-5 py-4 space-y-3 max-h-80 overflow-y-auto">
                  {session.messages.map(msg => (
                    <div key={msg.id} className="bg-white rounded-lg p-3 border border-gray-100">
                      <div className="flex items-start gap-2 mb-2">
                        <span className="text-xs bg-gray-900 text-white px-2 py-0.5 rounded-full flex-shrink-0">Q</span>
                        <p className="text-sm text-gray-800">{msg.question}</p>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${msg.is_answered_by_bot ? "bg-green-100 text-green-700" : "bg-red-100 text-red-500"}`}>
                          {msg.is_answered_by_bot ? "A" : "—"}
                        </span>
                        <p className="text-sm text-gray-600 leading-relaxed">{msg.answer}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {!loading && sessions.length > 0 && (
        <div className="flex items-center justify-center gap-3 mt-6">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-4 py-2 text-sm border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50"
          >← ก่อนหน้า</button>
          <span className="text-sm text-gray-500">หน้า {page}</span>
          <button
            onClick={() => setPage(p => p + 1)}
            disabled={sessions.length < LIMIT}
            className="px-4 py-2 text-sm border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50"
          >ถัดไป →</button>
        </div>
      )}
    </div>
  );
}