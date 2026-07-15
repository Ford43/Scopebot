import type { HistoryItem } from "../types/chat";

export function groupByDate(items: HistoryItem[]): Record<string, HistoryItem[]> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const groups: Record<string, HistoryItem[]> = {};

  items.forEach((item) => {
    const d = new Date(item.timestamp);
    d.setHours(0, 0, 0, 0);
    const label =
      d.getTime() === today.getTime()
        ? "วันนี้"
        : d.getTime() === yesterday.getTime()
          ? "เมื่อวาน"
          : d.toLocaleDateString("th-TH", { day: "numeric", month: "short" });
    if (!groups[label]) groups[label] = [];
    groups[label].push(item);
  });

  return groups;
}

export function timeNow(): string {
  return new Date().toLocaleTimeString("th-TH", {
    hour: "2-digit",
    minute: "2-digit",
  });
}
