import { CheckCircle, Clock, AlertCircle } from "lucide-react";

export function BotStatusBadge({ status }: { status?: string }) {
  if (status === "ready" || status === "active")
    return (
      <span className="flex items-center gap-1 text-[11px] text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
        <CheckCircle className="w-3 h-3" /> พร้อมใช้งาน
      </span>
    );
  if (status === "processing")
    return (
      <span className="flex items-center gap-1 text-[11px] text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
        <Clock className="w-3 h-3 animate-spin" /> กำลังประมวลผล
      </span>
    );
  if (status === "pending")
    return (
      <span className="flex items-center gap-1 text-[11px] text-sky-600 bg-sky-50 px-2 py-0.5 rounded-full">
        <Clock className="w-3 h-3" /> รอสร้างบอท
      </span>
    );
  if (status === "inactive")
    return (
      <span className="flex items-center gap-1 text-[11px] text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
        <AlertCircle className="w-3 h-3" /> ยังไม่พร้อม
      </span>
    );
  return (
    <span className="flex items-center gap-1 text-[11px] text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
      <AlertCircle className="w-3 h-3" /> ยังไม่พร้อม
    </span>
  );
}
