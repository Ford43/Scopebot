import { useEffect, useState } from "react";
import { Search, ScrollText } from "lucide-react";
import { authHeaders } from "../../lib/api";

interface AuditItem {
  id: number;
  actor_name: string;
  action: string;
  target_name: string | null;
  detail: string;
  created_at: string;
}

const ACTION_LABELS: Record<string, string> = {
  signup: "สมัครสมาชิก",
  approve: "อนุมัติ",
  reject: "ปฏิเสธ",
  ban: "ระงับบัญชี",
  unban: "ปลดระงับ",
  change_role: "เปลี่ยนบทบาท",
  change_quota: "ปรับโควต้า",
  delete_user: "ลบบัญชี",
  reset_password: "รีเซ็ตรหัสผ่าน",
};

const ACTION_FILTERS = [
  { value: "", label: "ทุกประเภท" },
  { value: "signup", label: "สมัครสมาชิก" },
  { value: "approve", label: "อนุมัติ" },
  { value: "reject", label: "ปฏิเสธ" },
  { value: "ban", label: "ระงับ" },
  { value: "unban", label: "ปลดระงับ" },
  { value: "change_role", label: "เปลี่ยนบทบาท" },
  { value: "change_quota", label: "โควต้าบอท" },
  { value: "delete_user", label: "ลบบัญชี" },
  { value: "reset_password", label: "รีเซ็ตรหัส" },
];

function actionBadgeClass(action: string): string {
  switch (action) {
    case "approve":
    case "unban":
      return "bg-emerald-100 text-emerald-700";
    case "reject":
    case "ban":
    case "delete_user":
      return "bg-rose-100 text-rose-700";
    case "signup":
      return "bg-sky-100 text-sky-700";
    case "reset_password":
    case "change_role":
    case "change_quota":
      return "bg-amber-100 text-amber-800";
    default:
      return "bg-gray-100 text-gray-600";
  }
}

function formatWhen(dateStr: string): string {
  const raw = dateStr.endsWith("Z") || dateStr.includes("+") ? dateStr : `${dateStr}Z`;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleString("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function AuditLogPage() {
  const [items, setItems] = useState<AuditItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState("");
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ limit: "80", offset: "0" });
        if (action) params.set("action", action);
        if (search.trim()) params.set("q", search.trim());
        const res = await fetch(`/api/audit-logs/?${params}`, {
          headers: authHeaders(),
        });
        if (!res.ok) throw new Error("load failed");
        const data = await res.json();
        if (cancelled) return;
        setTotal(data.total ?? 0);
        setItems(Array.isArray(data.items) ? data.items : []);
      } catch {
        if (!cancelled) {
          setItems([]);
          setTotal(0);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [action, search]);

  return (
    <div>
      <div className="flex items-end justify-between gap-3 mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Log</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            บันทึกการสมัคร อนุมัติ ระงับ เปลี่ยนสิทธิ์ และลบบัญชี — ดูได้อย่างเดียว
          </p>
        </div>
        <span className="text-sm text-gray-400">{total} รายการ</span>
      </div>

      <div className="flex flex-wrap gap-3 mb-5">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") setSearch(q);
            }}
            placeholder="ค้นหาชื่อผู้ทำ / เป้าหมาย / รายละเอียด"
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg bg-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
        </div>
        <select
          aria-label="กรองประเภท Log"
          value={action}
          onChange={(e) => setAction(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:ring-2 focus:ring-amber-400"
        >
          {ACTION_FILTERS.map((f) => (
            <option key={f.value || "all"} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setSearch(q)}
          className="px-4 py-2 rounded-lg bg-amber-400 text-gray-900 text-sm font-semibold"
        >
          ค้นหา
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16 text-gray-400">
          <div className="w-8 h-8 border-4 border-amber-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
          <ScrollText className="w-10 h-10 mb-3 opacity-40" />
          <p className="text-sm">ยังไม่มี Log</p>
          <p className="text-xs mt-1">เมื่อมีการสมัครหรือจัดการบัญชี จะแสดงที่นี่</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((row) => (
            <div
              key={row.id}
              className="bg-white border border-gray-200 rounded-xl px-4 py-3 flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-4"
            >
              <div className="sm:w-40 flex-shrink-0">
                <span
                  className={`inline-flex text-[11px] px-2 py-0.5 rounded-full font-semibold ${actionBadgeClass(row.action)}`}
                >
                  {ACTION_LABELS[row.action] || row.action}
                </span>
                <p className="text-[11px] text-gray-400 mt-1">{formatWhen(row.created_at)}</p>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-gray-800">{row.detail || "—"}</p>
                <p className="text-[11px] text-gray-400 mt-1">
                  โดย {row.actor_name}
                  {row.target_name ? ` · เป้าหมาย ${row.target_name}` : ""}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
