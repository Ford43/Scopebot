import { useEffect, useState } from "react";
import { History, Search, Trash2, X, Clock, ChevronRight } from "lucide-react";
import type { HistoryItem } from "../../types/chat";
import { CATEGORY_COLORS } from "../../constants/chat";
import { groupByDate } from "../../utils/date";

interface HistoryDrawerProps {
  open: boolean;
  historyItems: HistoryItem[];
  initialSearch?: string;
  onClose: () => void;
  onSelect: (query: string) => void;
  onClearAll: () => void;
  onRemoveItem: (id: string) => void;
}

export default function HistoryDrawer({
  open,
  historyItems,
  initialSearch = "",
  onClose,
  onSelect,
  onClearAll,
  onRemoveItem,
}: HistoryDrawerProps) {
  const [historySearch, setHistorySearch] = useState(initialSearch);

  useEffect(() => {
    if (open) setHistorySearch(initialSearch);
  }, [open, initialSearch]);

  const filteredHistory = historyItems.filter((h) =>
    h.query.toLowerCase().includes(historySearch.toLowerCase())
  );
  const groupedHistory = groupByDate(filteredHistory);

  return (
    <>
      <div
        className={`fixed inset-0 bg-black/30 z-30 transition-opacity duration-300 ${
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
      />
      <div
        className={`fixed top-0 right-0 h-full w-80 bg-white shadow-2xl z-40 flex flex-col transform transition-transform duration-300 ease-in-out ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="bg-gray-900 text-white px-5 py-4 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-amber-400" />
            <span className="text-sm">ประวัติการค้นหา</span>
            {historyItems.length > 0 && (
              <span className="bg-amber-400 text-gray-900 text-[10px] px-1.5 py-0.5 rounded-full">
                {historyItems.length}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {historyItems.length > 0 && (
              <button
                onClick={onClearAll}
                className="text-gray-400 hover:text-white text-[11px] flex items-center gap-1 hover:bg-white/10 px-2 py-1 rounded-lg transition-colors"
              >
                <Trash2 className="w-3 h-3" /> ล้างทั้งหมด
              </button>
            )}
            <button
              onClick={onClose}
              className="hover:bg-white/10 rounded-full p-1 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="px-4 py-3 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-full px-3 py-1.5">
            <Search className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
            <input
              type="text"
              value={historySearch}
              onChange={(e) => setHistorySearch(e.target.value)}
              placeholder="ค้นหาในประวัติ..."
              className="text-xs text-gray-600 bg-transparent outline-none flex-1 placeholder-gray-400"
            />
            {historySearch && (
              <button onClick={() => setHistorySearch("")}>
                <X className="w-3 h-3 text-gray-400" />
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {historyItems.length === 0 ? (
            <EmptyState
              icon={Clock}
              title="ยังไม่มีประวัติการค้นหา"
              subtitle="คำถามที่คุณถามจะปรากฏที่นี่"
            />
          ) : filteredHistory.length === 0 ? (
            <EmptyState
              icon={Search}
              title="ไม่พบประวัติที่ค้นหา"
            />
          ) : (
            <div className="py-2">
              {Object.entries(groupedHistory).map(([label, items]) => (
                <div key={label}>
                  <div className="px-4 py-2 sticky top-0 bg-white">
                    <span className="text-[10px] text-gray-400 uppercase tracking-wider">
                      {label}
                    </span>
                  </div>
                  {items.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => onSelect(item.query)}
                      className="w-full text-left px-4 py-3 hover:bg-amber-50 transition-colors group flex items-start gap-3 border-b border-gray-50"
                    >
                      <div className="w-7 h-7 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Clock className="w-3.5 h-3.5 text-amber-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-gray-700 line-clamp-2 leading-relaxed">
                          {item.query}
                        </p>
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                          {item.category && (
                            <span
                              className={`text-[9px] px-1.5 py-0.5 rounded-full ${CATEGORY_COLORS[item.category] ?? "bg-gray-100 text-gray-500"}`}
                            >
                              {item.category}
                            </span>
                          )}
                          <span className="text-[9px] text-gray-400">
                            {item.time}
                          </span>
                        </div>
                      </div>
                      <div className="flex-shrink-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onRemoveItem(item.id);
                          }}
                          className="p-1 hover:bg-red-50 rounded-full text-gray-300 hover:text-red-400 transition-colors"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                        <ChevronRight className="w-3.5 h-3.5 text-gray-300" />
                      </div>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>

        {historyItems.length > 0 && (
          <div className="flex-shrink-0 px-4 py-3 border-t border-gray-100 bg-gray-50">
            <p className="text-[10px] text-gray-400 text-center">
              กดที่รายการเพื่อถามคำถามซ้ำอีกครั้ง
            </p>
          </div>
        )}
      </div>
    </>
  );
}

function EmptyState({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-gray-400 px-6">
      <Icon className="w-10 h-10 mb-3 opacity-40" />
      <p className="text-sm text-center">{title}</p>
      {subtitle && (
        <p className="text-xs text-center mt-1 opacity-70">{subtitle}</p>
      )}
    </div>
  );
}
