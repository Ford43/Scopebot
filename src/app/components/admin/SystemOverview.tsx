import { useEffect, useState } from "react";
import {
  Users,
  Clock,
  Bot,
  MessageSquare,
  AlertTriangle,
  CheckCircle,
  Smartphone,
  Shield,
} from "lucide-react";
import { Card } from "../ui/card";
import { authHeaders } from "../../lib/api";

interface SystemOverview {
  users: {
    total: number;
    pending: number;
    active: number;
    banned: number;
    admin: number;
    support: number;
    shop: number;
    recent_signups_7d: number;
  };
  bots: {
    total: number;
    active: number;
    processing: number;
    inactive: number;
    line_connected: number;
  };
  chats: {
    total_sessions: number;
    today_sessions: number;
    waiting_queue: number;
    success_rate: number;
    line: number;
    web: number;
  };
}

export default function SystemOverviewPage({
  onGoToUsers,
}: {
  onGoToUsers?: () => void;
}) {
  const [stats, setStats] = useState<SystemOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch("/api/dashboard/system", { headers: authHeaders() });
      if (!res.ok) throw new Error("forbidden");
      setStats(await res.json());
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3 text-gray-400">
          <div className="w-8 h-8 border-4 border-amber-400 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm">กำลังโหลดภาพรวมระบบ...</p>
        </div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="flex items-center justify-center h-64 text-center">
        <div>
          <p className="text-red-500 mb-2">โหลดภาพรวมระบบไม่ได้</p>
          <button
            type="button"
            onClick={() => void load()}
            className="px-4 py-2 bg-amber-400 text-gray-900 rounded-lg text-sm font-semibold"
          >
            ลองใหม่
          </button>
        </div>
      </div>
    );
  }

  const cards = [
    {
      label: "บัญชีทั้งหมด",
      value: stats.users.total.toLocaleString(),
      sub: `ร้าน ${stats.users.shop} · แอดมิน ${stats.users.admin} · ซัพพอร์ต ${stats.users.support}`,
      icon: Users,
      iconBg: "bg-amber-100",
      iconColor: "text-amber-600",
    },
    {
      label: "รออนุมัติ",
      value: stats.users.pending,
      sub:
        stats.users.pending > 0
          ? "คลิกเพื่อไปหน้าจัดการผู้ใช้"
          : "ไม่มีคิวรอ",
      icon: Clock,
      iconBg: stats.users.pending > 0 ? "bg-sky-100" : "bg-gray-100",
      iconColor: stats.users.pending > 0 ? "text-sky-600" : "text-gray-400",
      goToUsers: stats.users.pending > 0,
    },
    {
      label: "บอททั้งระบบ",
      value: stats.bots.total.toLocaleString(),
      sub: `พร้อมใช้ ${stats.bots.active} · กำลังประมวลผล ${stats.bots.processing} · ยังไม่พร้อม ${stats.bots.inactive}`,
      icon: Bot,
      iconBg: "bg-violet-100",
      iconColor: "text-violet-600",
    },
    {
      label: "แชททั้งหมด",
      value: stats.chats.total_sessions.toLocaleString(),
      sub: `วันนี้ ${stats.chats.today_sessions} แชท · บอทตอบได้ ${stats.chats.success_rate}%`,
      icon: MessageSquare,
      iconBg: "bg-blue-100",
      iconColor: "text-blue-600",
    },
    {
      label: "คิวรอเจ้าหน้าที่",
      value: stats.chats.waiting_queue,
      sub: "จำนวนคิวรวมทุกบัญชี — อ่านอย่างเดียว",
      icon: AlertTriangle,
      iconBg: stats.chats.waiting_queue > 0 ? "bg-red-100" : "bg-gray-100",
      iconColor: stats.chats.waiting_queue > 0 ? "text-red-500" : "text-gray-400",
    },
    {
      label: "เชื่อม LINE",
      value: stats.bots.line_connected,
      sub: `จากบอททั้งหมด ${stats.bots.total} ตัว`,
      icon: Smartphone,
      iconBg: "bg-green-100",
      iconColor: "text-green-600",
    },
  ];

  return (
    <div className="space-y-5 p-1">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">ภาพรวมระบบ</h1>
        <p className="text-xs text-gray-400 mt-0.5">
          ตัวเลขรวมทุกบัญชี ดูได้อย่างเดียว ไม่สามารถแก้บอทหรือเอกสารของร้านอื่นได้
          {" · "}
          {new Date().toLocaleTimeString("th-TH")}
        </p>
      </div>

      {stats.users.pending > 0 && (
        <div className="flex items-center gap-3 bg-sky-50 border border-sky-200 rounded-xl px-4 py-3">
          <Shield className="w-4 h-4 text-sky-600 flex-shrink-0" />
          <p className="text-sm text-sky-800 flex-1">
            มี <span className="font-bold">{stats.users.pending}</span> บัญชีรออนุมัติ
          </p>
          <button
            type="button"
            onClick={() => onGoToUsers?.()}
            className="text-xs font-semibold text-sky-700 hover:underline"
          >
            ไปอนุมัติ
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Card
              key={card.label}
              className={`p-5 rounded-2xl border border-gray-200 shadow-sm ${
                card.goToUsers ? "cursor-pointer hover:border-amber-300" : ""
              }`}
              onClick={() => {
                if (card.goToUsers) onGoToUsers?.();
              }}
            >
              <div className="flex items-start justify-between mb-4">
                <div className={`w-10 h-10 rounded-xl ${card.iconBg} flex items-center justify-center`}>
                  <Icon className={`w-5 h-5 ${card.iconColor}`} />
                </div>
              </div>
              <p className="text-xs text-gray-500 mb-1">{card.label}</p>
              <p className="text-2xl font-bold text-gray-900">{card.value}</p>
              <p className="text-xs text-gray-400 mt-1 leading-relaxed">{card.sub}</p>
            </Card>
          );
        })}
      </div>

      <Card className="p-5 rounded-2xl border border-gray-200">
        <p className="text-sm font-semibold text-gray-800 mb-3">สถานะบัญชี</p>
        <div className="flex flex-wrap gap-3 text-sm">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700">
            <CheckCircle className="w-3.5 h-3.5" />
            ใช้งานปกติ {stats.users.active}
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-50 text-sky-700">
            รออนุมัติ {stats.users.pending}
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-50 text-rose-700">
            ถูกระงับ {stats.users.banned}
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-50 text-gray-600">
            สมัคร 7 วันล่าสุด {stats.users.recent_signups_7d}
          </span>
        </div>
        <p className="text-[11px] text-gray-400 mt-4">
          LINE {stats.chats.line.toLocaleString()} แชท · เว็บ {stats.chats.web.toLocaleString()} แชท
        </p>
      </Card>
    </div>
  );
}
