<<<<<<< HEAD
import { MessageSquare, Clock, FileText, CheckCircle, TrendingUp } from "lucide-react";
import { Card } from "../ui/card";

// ข้อมูลสำหรับส่วนภาพรวมระบบ (Overview)
const stats = [
  { id: "1", label: "แชททั้งหมด", value: "128", icon: MessageSquare },
  { id: "2", label: "รอเจ้าหน้าที่ตอบ", value: "3", icon: Clock, alert: true },
  { id: "3", label: "ไฟล์เอกสาร", value: "15", icon: FileText },
];

// ข้อมูลสำหรับส่วน AI Analytics
const aiMetrics = [
  {
    id: "1",
    label: "คำถามที่ตอบได้",
    value: "95.3%",
    change: "+2.1%",
    icon: CheckCircle,
    color: "text-green-600",
    bgColor: "bg-green-100",
  },
  {
    id: "3",
    label: "คำถามต่อวัน",
    value: "342",
    change: "+15%",
    icon: MessageSquare,
    color: "text-purple-600",
    bgColor: "bg-purple-100",
  },
  {
    id: "4",
    label: "อัตราความพึงพอใจ",
    value: "4.8/5",
    change: "+0.3",
    icon: TrendingUp,
    color: "text-orange-600",
    bgColor: "bg-orange-100",
  },
];

const topQuestions = [
  { id: "1", question: "ระเบียบการลางาน", count: 45, category: "ระเบียบการ" },
  { id: "2", question: "เงินเดือน", count: 38, category: "สวัสดิการ" },
  { id: "3", question: "เวลาทำงาน", count: 32, category: "ข้อมูลทั่วไป" },
  { id: "4", question: "สมัครงาน", count: 28, category: "HR" },
  { id: "5", question: "IT Support", count: 24, category: "IT" },
];

const categoryDistribution = [
  { category: "ระเบียบการ", percentage: 35, color: "bg-blue-500" },
  { category: "สวัสดิการ", percentage: 25, color: "bg-purple-500" },
  { category: "ข้อมูลทั่วไป", percentage: 20, color: "bg-green-500" },
  { category: "HR", percentage: 12, color: "bg-orange-500" },
  { category: "IT", percentage: 8, color: "bg-red-500" },
];

export default function Dashboard() {
  return (
    <div>
      <h1 className="mb-6">ภาพรวมระบบ (Overview)</h1>

      {/* Statistics cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card
              key={stat.id}
              className="p-6 border-2 border-amber-200 hover:border-amber-400 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm mb-2">{stat.label}</p>
                  <div className="flex items-center gap-2">
                    <p className="text-3xl font-bold">{stat.value}</p>
                    {stat.alert && <span className="text-red-500 text-xl">🔴</span>}
                  </div>
                </div>
                <div className="w-12 h-12 bg-amber-400 rounded-lg flex items-center justify-center">
                  <Icon className="w-6 h-6 text-gray-900" />
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* --- ส่วนที่ย้ายมาจาก AI Analytics --- */}
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">AI Analytics</h2>
      </div>

      {/* AI Performance Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {aiMetrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <Card key={metric.id} className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className={`w-12 h-12 ${metric.bgColor} rounded-lg flex items-center justify-center`}>
                  <Icon className={`w-6 h-6 ${metric.color}`} />
                </div>
                <span className="text-sm text-green-600 bg-green-50 px-2 py-1 rounded">
                  {metric.change}
                </span>
              </div>
              <p className="text-2xl font-bold mb-1">{metric.value}</p>
              <p className="text-sm text-gray-600">{metric.label}</p>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Questions */}
        <Card className="p-6">
          <h2 className="mb-4 font-semibold text-lg text-gray-800">คำถามยอดนิยม</h2>
          <div className="space-y-3">
            {topQuestions.map((item, index) => (
              <div key={item.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-full flex items-center justify-center text-sm font-semibold">
                    {index + 1}
                  </div>
                  <div>
                    <p className="font-medium text-gray-800">{item.question}</p>
                    <p className="text-xs text-gray-500">{item.category}</p>
                  </div>
                </div>
                <span className="text-sm font-semibold text-purple-600">
                  {item.count} ครั้ง
                </span>
              </div>
            ))}
          </div>
        </Card>

        {/* Category Distribution */}
        <Card className="p-6">
          <h2 className="mb-4 font-semibold text-lg text-gray-800">การกระจายตามหมวดหมู่</h2>
          <div className="space-y-4">
            {categoryDistribution.map((item) => (
              <div key={item.category}>
                <div className="flex justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">{item.category}</span>
                  <span className="text-sm text-gray-600">{item.percentage}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`${item.color} h-2 rounded-full transition-all duration-500`}
                    style={{ width: `${item.percentage}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
=======
import { useEffect, useState } from "react";
import {
  MessageSquare, Clock, FileText, CheckCircle,
  TrendingUp, Bot, Users, Smartphone, Globe,
  AlertTriangle, ArrowRight,
} from "lucide-react";
import { Card } from "../ui/card";

/* ─────────────── Types ─────────────── */
interface DailyStats { date: string; total: number; line: number; web: number; }
interface BotStat { bot_name: string; bot_id: string; status: string; total_conversations: number; success_rate: number; document_count: number; }
interface TopQuestion { question: string; count: number; }

interface DashboardStats {
  total_bots: number; active_bots: number;
  total_sessions: number; today_sessions: number;
  unanswered: number; success_rate: number;
  total_documents: number; unread_notifications: number;
  platform: { line: number; web: number };
  users: { new: number; returning: number };
  daily_stats: DailyStats[];
  days: number;
}

/* ─────────────── Bar Chart ─────────────── */
function BarChart({ data, keys, colors, height = 120 }: {
  data: any[]; keys: string[]; colors: string[]; height?: number;
}) {
  const [tooltip, setTooltip] = useState<{ i: number; k: string; v: number } | null>(null);
  const max = Math.max(...data.flatMap(d => keys.map(k => d[k] || 0)), 1);
  return (
    <div className="relative">
      <div className="flex items-end gap-1" style={{ height }}>
        {data.map((d, i) => (
          <div key={i} className="flex flex-col items-center gap-0.5 flex-1">
            <div className="flex items-end gap-0.5 w-full" style={{ height: height - 20 }}>
              {keys.map((k, ki) => (
                <div
                  key={k}
                  className={`flex-1 rounded-t transition-all duration-500 cursor-pointer hover:opacity-70 ${colors[ki]}`}
                  style={{ height: `${Math.round(((d[k] || 0) / max) * 100)}%`, minHeight: (d[k] || 0) > 0 ? 3 : 0 }}
                  onMouseEnter={() => setTooltip({ i, k, v: d[k] || 0 })}
                  onMouseLeave={() => setTooltip(null)}
                />
              ))}
            </div>
            <span className="text-[9px] text-gray-400">{d.date}</span>
          </div>
        ))}
      </div>
      {tooltip && (
        <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-[10px] px-2 py-1 rounded-md whitespace-nowrap pointer-events-none">
          {tooltip.k}: {tooltip.v}
        </div>
      )}
    </div>
  );
}

/* ─────────────── Line Chart ─────────────── */
function LineChart({ data, dataKey, color = "#8b5cf6", height = 100 }: {
  data: any[]; dataKey: string; color?: string; height?: number;
}) {
  const values = data.map(d => d[dataKey] || 0);
  const max = Math.max(...values, 1);
  const w = data.length > 1 ? 100 / (data.length - 1) : 100;
  const points = values.map((v, i) => `${i * w},${100 - (v / max) * 100}`).join(" ");
  return (
    <div style={{ height }} className="w-full">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full">
        <defs>
          <linearGradient id="lgrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.25" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon points={`0,100 ${points} 100,100`} fill="url(#lgrad)" />
        <polyline points={points} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
        {values.map((v, i) => (
          <circle key={i} cx={i * w} cy={100 - (v / max) * 100} r="2" fill={color} vectorEffect="non-scaling-stroke" />
        ))}
      </svg>
    </div>
  );
}

/* ─────────────── Donut Chart ─────────────── */
function DonutChart({ segments, size = 100 }: {
  segments: { value: number; color: string; label: string }[]; size?: number;
}) {
  const total = segments.reduce((s, sg) => s + sg.value, 0) || 1;
  let offset = 0;
  const r = 30; const circ = 2 * Math.PI * r;
  return (
    <div className="flex items-center gap-5">
      <svg width={size} height={size} viewBox="0 0 80 80" className="flex-shrink-0">
        <circle cx="40" cy="40" r={r} fill="none" stroke="#f3f4f6" strokeWidth="10" />
        {segments.map((sg, i) => {
          const pct = sg.value / total;
          const el = (
            <circle key={i} cx="40" cy="40" r={r} fill="none" stroke={sg.color} strokeWidth="10"
              strokeDasharray={`${pct * circ} ${(1 - pct) * circ}`}
              strokeDashoffset={-offset * circ} strokeLinecap="butt"
              style={{ transform: "rotate(-90deg)", transformOrigin: "40px 40px" }}
            />
          );
          offset += pct;
          return el;
        })}
        <text x="40" y="36" textAnchor="middle" fontSize="7" fill="#9ca3af">รวม</text>
        <text x="40" y="48" textAnchor="middle" fontSize="13" fontWeight="bold" fill="#111827">{total === 1 && segments.every(s => s.value === 0) ? 0 : segments.reduce((a, b) => a + b.value, 0)}</text>
      </svg>
      <div className="flex flex-col gap-2">
        {segments.map((sg, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: sg.color }} />
            <span className="text-xs text-gray-500">{sg.label}</span>
            <span className="text-xs font-bold text-gray-800">{sg.value}</span>
            <span className="text-[10px] text-gray-400">({Math.round(sg.value / total * 100)}%)</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─────────────── Progress Bar ─────────────── */
function ProgressBar({ value, color = "bg-green-500" }: { value: number; color?: string }) {
  return (
    <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
      <div className={`h-2 rounded-full transition-all duration-700 ${color}`} style={{ width: `${Math.min(value, 100)}%` }} />
    </div>
  );
}

/* ═══════════════ Main Component ═══════════════ */
export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [botStats, setBotStats] = useState<BotStat[]>([]);
  const [topQuestions, setTopQuestions] = useState<TopQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [days, setDays] = useState(7);

  const fetchAll = async (d: number) => {
    setLoading(true);
    setError(false);
    const token = localStorage.getItem("scopebot_token");
    const headers = { Authorization: `Bearer ${token}` };
    try {
      const [statsRes, botsRes, topRes] = await Promise.all([
        fetch(`/api/dashboard/stats?days=${d}`, { headers }),
        fetch("/api/bots/", { headers }),
        fetch(`/api/dashboard/top-questions?days=${d}`, { headers }),
      ]);
      const statsData = await statsRes.json();
      const botsData = await botsRes.json();
      const topData = await topRes.json();
      setStats(statsData);
      setTopQuestions(Array.isArray(topData) ? topData : []);

      // ดึง bot-stats แต่ละตัว
      if (Array.isArray(botsData) && botsData.length > 0) {
        const botStatResults = await Promise.all(
          botsData.map((b: any) =>
            fetch(`/api/dashboard/bot-stats/${b.bot_id}`, { headers }).then(r => r.json())
          )
        );
        setBotStats(botStatResults.filter(Boolean));
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(days); }, [days]);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="flex flex-col items-center gap-3 text-gray-400">
        <div className="w-8 h-8 border-4 border-amber-400 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm">กำลังโหลดข้อมูล...</p>
      </div>
    </div>
  );

  if (error || !stats) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-center">
        <p className="text-red-400 text-lg mb-2">⚠️ โหลดข้อมูลไม่ได้</p>
        <p className="text-gray-400 text-sm mb-4">กรุณาตรวจสอบว่า Backend รันอยู่</p>
        <button onClick={() => fetchAll(days)} className="px-4 py-2 bg-amber-400 text-gray-900 rounded-lg text-sm font-semibold">ลองใหม่</button>
      </div>
    </div>
  );

  return (
    <div className="space-y-5 p-1">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">ภาพรวมระบบ</h1>
          <p className="text-xs text-gray-400 mt-0.5">อัปเดต: {new Date().toLocaleTimeString("th-TH")}</p>
        </div>
        <select
          aria-label="ช่วงเวลา"
          value={days}
          onChange={e => setDays(Number(e.target.value))}
          className="text-sm border border-gray-200 rounded-xl px-4 py-2.5 bg-white text-gray-700 outline-none shadow-sm"
        >
          <option value={7}>7 วันย้อนหลัง</option>
          <option value={14}>14 วันย้อนหลัง</option>
          <option value={30}>30 วันย้อนหลัง</option>
        </select>
      </div>

      {/* ── Alert: มีคำถามค้าง ── */}
      {stats.unanswered > 0 && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
          <p className="text-sm text-red-700 flex-1">
            มี <span className="font-bold">{stats.unanswered}</span> คำถามที่ Bot ตอบไม่ได้ รอเจ้าหน้าที่ดำเนินการ
          </p>
          <button className="flex items-center gap-1 text-xs text-red-600 font-semibold hover:underline">
            ดูเลย <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* ── Overview Cards ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          {
            label: "แชททั้งหมด", value: stats.total_sessions.toLocaleString(),
            sub: `วันนี้ ${stats.today_sessions} แชท`, icon: MessageSquare,
            iconBg: "bg-blue-100", iconColor: "text-blue-600",
            badge: stats.today_sessions > 0 ? `+${stats.today_sessions} วันนี้` : null,
            badgeColor: "bg-blue-100 text-blue-700",
          },
          {
            label: "รอเจ้าหน้าที่ตอบ", value: stats.unanswered,
            sub: stats.unanswered > 0 ? "⚠️ ต้องดำเนินการ" : "✅ ไม่มีค้าง",
            icon: Clock, iconBg: stats.unanswered > 0 ? "bg-red-100" : "bg-gray-100",
            iconColor: stats.unanswered > 0 ? "text-red-500" : "text-gray-400",
            badge: null, badgeColor: "",
          },
          {
            label: "เอกสารใน Library", value: stats.total_documents,
            sub: `Bot ${stats.active_bots}/${stats.total_bots} ตัว active`,
            icon: FileText, iconBg: "bg-purple-100", iconColor: "text-purple-600",
            badge: null, badgeColor: "",
          },
        ].map((card, i) => {
          const Icon = card.icon;
          return (
            <Card key={i} className="p-5 rounded-2xl border border-gray-200 shadow-sm hover:-translate-y-0.5 hover:shadow-md transition-all">
              <div className="flex items-start justify-between mb-4">
                <div className={`w-11 h-11 ${card.iconBg} rounded-xl flex items-center justify-center`}>
                  <Icon className={`w-5 h-5 ${card.iconColor}`} />
                </div>
                {card.badge && (
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${card.badgeColor}`}>{card.badge}</span>
                )}
              </div>
              <p className="text-3xl font-bold text-gray-900 mb-1">{card.value}</p>
              <p className="text-sm font-medium text-gray-600">{card.label}</p>
              <p className="text-xs text-gray-400 mt-0.5">{card.sub}</p>
            </Card>
          );
        })}
      </div>

      {/* ── Metric Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "อัตราตอบสำเร็จ", value: `${stats.success_rate}%`, icon: CheckCircle, color: "text-green-600", bg: "bg-green-50", border: "border-green-200", progress: stats.success_rate, pColor: "bg-green-500" },
          { label: "แชทวันนี้",       value: stats.today_sessions,     icon: TrendingUp,   color: "text-purple-600", bg: "bg-purple-50", border: "border-purple-200", progress: null, pColor: "" },
          { label: "Bot พร้อมใช้",    value: `${stats.active_bots}/${stats.total_bots}`, icon: Bot, color: "text-orange-600", bg: "bg-orange-50", border: "border-orange-200", progress: stats.total_bots > 0 ? (stats.active_bots / stats.total_bots * 100) : 0, pColor: "bg-orange-400" },
          { label: "ผู้ใช้วันนี้",    value: stats.users.new + stats.users.returning, icon: Users, color: "text-blue-600", bg: "bg-blue-50", border: "border-blue-200", progress: null, pColor: "" },
        ].map((card, i) => {
          const Icon = card.icon;
          return (
            <Card key={i} className={`p-4 rounded-2xl border ${card.border} ${card.bg} shadow-sm`}>
              <Icon className={`w-5 h-5 ${card.color} mb-3`} />
              <p className={`text-2xl font-bold ${card.color} mb-0.5`}>{card.value}</p>
              <p className="text-xs text-gray-500 mb-2">{card.label}</p>
              {card.progress !== null && (
                <ProgressBar value={card.progress} color={card.pColor} />
              )}
            </Card>
          );
        })}
      </div>

      {/* ── Charts Row 1 ── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Card className="xl:col-span-2 p-5 rounded-2xl border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-semibold text-gray-800">แชทรายวัน</h2>
            <div className="flex gap-3 text-xs text-gray-500">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-green-400 inline-block" />Line</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-blue-400 inline-block" />Web</span>
            </div>
          </div>
          {stats.daily_stats.every(d => d.total === 0)
            ? <div className="flex items-center justify-center h-28 text-gray-400 text-sm">ยังไม่มีข้อมูล</div>
            : <BarChart data={stats.daily_stats} keys={["line", "web"]} colors={["bg-green-400", "bg-blue-400"]} height={140} />
          }
        </Card>

        <Card className="p-5 rounded-2xl border border-gray-200 shadow-sm">
          <h2 className="font-semibold text-gray-800 mb-5">แพลตฟอร์ม</h2>
          <DonutChart segments={[
            { value: stats.platform.line, color: "#4ade80", label: "Line" },
            { value: stats.platform.web,  color: "#60a5fa", label: "Web" },
          ]} size={110} />
          <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-2 gap-2">
            <div className="text-center">
              <p className="text-lg font-bold text-green-600">{stats.platform.line}</p>
              <p className="text-[10px] text-gray-400 flex items-center justify-center gap-1"><Smartphone className="w-2.5 h-2.5" />Line</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-blue-500">{stats.platform.web}</p>
              <p className="text-[10px] text-gray-400 flex items-center justify-center gap-1"><Globe className="w-2.5 h-2.5" />Web</p>
            </div>
          </div>
        </Card>
      </div>

      {/* ── Charts Row 2 ── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Card className="xl:col-span-2 p-5 rounded-2xl border border-gray-200 shadow-sm">
          <h2 className="font-semibold text-gray-800 mb-5">แนวโน้มการใช้งาน</h2>
          {stats.daily_stats.every(d => d.total === 0)
            ? <div className="flex items-center justify-center h-24 text-gray-400 text-sm">ยังไม่มีข้อมูล</div>
            : <>
                <LineChart data={stats.daily_stats} dataKey="total" color="#8b5cf6" height={110} />
                <div className="flex justify-between mt-2">
                  {stats.daily_stats.map((d, i) => (
                    <span key={i} className="text-[9px] text-gray-400 flex-1 text-center">{d.date}</span>
                  ))}
                </div>
              </>
          }
        </Card>

        <Card className="p-5 rounded-2xl border border-gray-200 shadow-sm">
          <h2 className="font-semibold text-gray-800 mb-5">ผู้ใช้วันนี้</h2>
          <DonutChart segments={[
            { value: stats.users.new,       color: "#f59e0b", label: "ใหม่" },
            { value: stats.users.returning, color: "#8b5cf6", label: "กลับมา" },
          ]} size={110} />
          {stats.users.new === 0 && stats.users.returning === 0 && (
            <p className="text-xs text-gray-400 text-center mt-3">ยังไม่มีผู้ใช้วันนี้</p>
          )}
        </Card>
      </div>

      {/* ── Bot Performance + Top Questions ── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">

        {/* Bot Stats Table */}
        <Card className="p-5 rounded-2xl border border-gray-200 shadow-sm">
          <h2 className="font-semibold text-gray-800 mb-4">ประสิทธิภาพแต่ละ Bot</h2>
          {botStats.length === 0 ? (
            <div className="flex items-center justify-center h-24 text-gray-400 text-sm">ยังไม่มีข้อมูล Bot</div>
          ) : (
            <div className="space-y-4">
              {botStats.map((b, i) => (
                <div key={i}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${b.status === "active" ? "bg-green-400" : "bg-gray-300"}`} />
                      <span className="text-sm font-medium text-gray-700 truncate max-w-[140px]"title={b.bot_name}>{b.bot_name}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      <span className="flex items-center gap-1"><MessageSquare className="w-3 h-3" />{b.total_conversations}</span>
                      <span className="flex items-center gap-1"><FileText className="w-3 h-3" />{b.document_count}</span>
                      <span className={`font-semibold ${b.success_rate >= 70 ? "text-green-600" : b.success_rate >= 40 ? "text-amber-500" : "text-red-500"}`}>
                        {b.success_rate}%
                      </span>
                    </div>
                  </div>
                  <ProgressBar
                    value={b.success_rate}
                    color={b.success_rate >= 70 ? "bg-green-400" : b.success_rate >= 40 ? "bg-amber-400" : "bg-red-400"}
                  />
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Top Questions */}
        <Card className="p-5 rounded-2xl border border-gray-200 shadow-sm">
          <h2 className="font-semibold text-gray-800 mb-4">คำถามยอดนิยม</h2>
          {topQuestions.length === 0 ? (
            <div className="flex items-center justify-center h-24 text-gray-400 text-sm">ยังไม่มีข้อมูล</div>
          ) : (
            <div className="space-y-3">
              {topQuestions.map((q, i) => {
                const maxCount = topQuestions[0]?.count || 1;
                return (
                  <div key={i}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <span className="text-xs font-bold text-gray-400 w-4">{i + 1}</span>
                        <span className="text-xs text-gray-700 truncate">{q.question}</span>
                      </div>
                      <span className="text-xs font-semibold text-gray-500 ml-2 flex-shrink-0">{q.count} ครั้ง</span>
                    </div>
                    <ProgressBar
                      value={Math.round((q.count / maxCount) * 100)}
                      color="bg-amber-400"
                    />
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

    </div>
  );
>>>>>>> master
}