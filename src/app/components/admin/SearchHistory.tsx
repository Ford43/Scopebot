<<<<<<< HEAD
import { useState } from "react";
import { Search, Plus, Trash2, Clock, User, Tag } from "lucide-react";

interface SearchRecord {
  id: string;
  query: string;
  description: string;
  user: string;
  category: string;
  confidence: number;
  updatedAt: string;
  updatedLabel: string;
}

const mockHistory: SearchRecord[] = [
  {
    id: "1",
    query: "วิธีขอลาพักร้อน",
    description:
      "พนักงานสอบถามขั้นตอนการยื่นคำร้องขอลาพักร้อน และจำนวนวันลาที่ได้รับต่อปี",
    user: "สมชาย ใจดี",
    category: "ระเบียบการลา",
    confidence: 95,
    updatedAt: "2026-02-20T10:26:00",
    updatedLabel: "4 นาทีที่แล้ว",
  },
  {
    id: "2",
    query: "เงินเดือนออกวันไหน",
    description:
      "สอบถามกำหนดการจ่ายเงินเดือนประจำเดือน และช่องทางการตรวจสอบยอดเงิน",
    user: "วิไล รักงาน",
    category: "เงินเดือน",
    confidence: 98,
    updatedAt: "2026-02-20T09:15:00",
    updatedLabel: "1 ชั่วโมงที่แล้ว",
  },
  {
    id: "3",
    query: "สวัสดิการพนักงาน",
    description:
      "สอบถามสิทธิ์ประกันสังคม ประกันสุขภาพ และสวัสดิการอื่นๆ ของบริษัท",
    user: "มานะ ตั้งใจ",
    category: "ข้อมูลองค์กร",
    confidence: 87,
    updatedAt: "2026-02-20T08:40:00",
    updatedLabel: "2 ชั่วโมงที่แล้ว",
  },
  {
    id: "4",
    query: "reset รหัสผ่าน Windows",
    description:
      "ขอความช่วยเหลือด้าน IT เรื่องการ reset รหัสผ่านเข้าสู่ระบบคอมพิวเตอร์",
    user: "ประภา สุขใส",
    category: "IT Support",
    confidence: 92,
    updatedAt: "2026-02-19T15:30:00",
    updatedLabel: "เมื่อวาน",
  },
  {
    id: "5",
    query: "เวลาทำงานยืดหยุ่น",
    description:
      "สอบถามนโยบาย Flexible Working Hours และการบันทึกเวลาเข้าออกงาน",
    user: "อนันต์ พรหมมา",
    category: "เวลาทำงาน",
    confidence: 80,
    updatedAt: "2026-02-19T11:00:00",
    updatedLabel: "เมื่อวาน",
  },
  {
    id: "6",
    query: "ขั้นตอนสมัครงาน",
    description:
      "สอบถามกระบวนการสมัครงานภายใน การโอนย้ายตำแหน่ง และเงื่อนไขที่เกี่ยวข้อง",
    user: "นภา จิตรดี",
    category: "การสมัครงาน",
    confidence: 88,
    updatedAt: "2026-02-18T14:20:00",
    updatedLabel: "2 วันที่แล้ว",
  },
];

const categoryColors: Record<string, string> = {
  "ระเบียบการลา": "bg-blue-100 text-blue-700",
  "เงินเดือน": "bg-green-100 text-green-700",
  "ข้อมูลองค์กร": "bg-purple-100 text-purple-700",
  "IT Support": "bg-red-100 text-red-700",
  "เวลาทำงาน": "bg-yellow-100 text-yellow-700",
  "การสมัครงาน": "bg-indigo-100 text-indigo-700",
};

export default function SearchHistory() {
  const [records, setRecords] = useState<SearchRecord[]>(mockHistory);
  const [searchQuery, setSearchQuery] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const filtered = records.filter(
    (r) =>
      r.query.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.user.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleDelete = (id: string) => {
    setDeleteId(id);
    setShowConfirm(true);
  };

  const confirmDelete = () => {
    if (deleteId) {
      setRecords((prev) => prev.filter((r) => r.id !== deleteId));
    }
    setShowConfirm(false);
    setDeleteId(null);
  };

  const handleClearAll = () => {
    setDeleteId(null);
    setShowConfirm(true);
  };

  const confirmClearAll = () => {
    if (!deleteId) {
      setRecords([]);
    }
    setShowConfirm(false);
    setDeleteId(null);
  };

  return (
    <div>
      {/* Page header */}
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-2xl text-gray-800">ประวัติการค้นหา</h1>
        <button
          onClick={handleClearAll}
          className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white text-sm px-4 py-2 rounded-lg hover:opacity-90 transition-opacity"
        >
          <Trash2 className="w-4 h-4" />
          ล้างประวัติทั้งหมด
          <span className="ml-1 bg-white/20 px-1.5 py-0.5 rounded text-xs">+</span>
        </button>
      </div>

      {/* Search bar */}
      <div className="flex items-center gap-2 text-gray-400 mb-6">
        <Search className="w-4 h-4" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="ค้นหาประวัติ..."
          className="text-sm text-gray-600 outline-none bg-transparent placeholder-gray-400 w-56"
        />
      </div>

      {/* Count */}
      <p className="text-sm text-gray-400 mb-4">
        {filtered.length} รายการ
      </p>

      {/* Cards grid */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-gray-400">
          <Clock className="w-12 h-12 mb-3 opacity-40" />
          <p className="text-sm">ไม่พบประวัติการค้นหา</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((record) => (
            <div
              key={record.id}
              className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col gap-3"
            >
              {/* Title row */}
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-gray-800 text-sm leading-snug line-clamp-1">
                  {record.query}
                </h3>
                <button
                  onClick={() => handleDelete(record.id)}
                  className="text-gray-300 hover:text-red-500 transition-colors flex-shrink-0 mt-0.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Description */}
              <p className="text-xs text-gray-500 leading-relaxed line-clamp-2">
                {record.description}
              </p>

              {/* Category tag + confidence */}
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1 ${
                    categoryColors[record.category] ?? "bg-gray-100 text-gray-600"
                  }`}
                >
                  <Tag className="w-2.5 h-2.5" />
                  {record.category}
                </span>
                <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                  {record.confidence}% confidence
                </span>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between pt-2 border-t border-gray-100 text-[11px] text-gray-400">
                <span className="flex items-center gap-1">
                  <User className="w-3 h-3" />
                  By {record.user}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Update เมื่อ {record.updatedLabel}
                </span>
              </div>
=======
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
>>>>>>> master
            </div>
          ))}
        </div>
      )}

<<<<<<< HEAD
      {/* Confirm modal */}
      {showConfirm && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
          onClick={() => setShowConfirm(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl p-6 w-80 mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <h3 className="text-gray-800 text-sm">
                  {deleteId ? "ลบรายการนี้?" : "ล้างประวัติทั้งหมด?"}
                </h3>
                <p className="text-xs text-gray-400">
                  {deleteId
                    ? "รายการนี้จะถูกลบและไม่สามารถกู้คืนได้"
                    : "ประวัติทั้งหมดจะถูกลบถาวร"}
                </p>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 border border-gray-200 text-gray-600 py-2 rounded-lg text-sm hover:bg-gray-50 transition-colors"
              >
                ยกเลิก
              </button>
              <button
                onClick={deleteId ? confirmDelete : confirmClearAll}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white py-2 rounded-lg text-sm transition-colors"
              >
                ลบ
              </button>
            </div>
          </div>
=======
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
>>>>>>> master
        </div>
      )}
    </div>
  );
<<<<<<< HEAD
}
=======
}
>>>>>>> master
