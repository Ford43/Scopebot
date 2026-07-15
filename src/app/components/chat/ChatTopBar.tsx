import { useMemo, useState } from "react";
import {
  Search,
  Bell,
  ChevronDown,
  Crown,
  Headphones,
  User,
  LogOut,
  Bot,
  CheckCheck,
} from "lucide-react";
import type { ActiveView } from "../../types/chat";
import { VIEW_LABELS } from "../../constants/chat";
import type { AppNotification } from "../../hooks/useNotifications";

interface ChatTopBarProps {
  activeView: ActiveView;
  userName?: string;
  userEmail?: string;
  isAdmin: boolean;
  isSupport: boolean;
  unreadNotifs: number;
  notifications: AppNotification[];
  searchPlaceholder?: string;
  onSearch: (query: string) => void;
  onMarkRead: (id: number) => void;
  onMarkAllRead: () => void;
  onNavigateBots: () => void;
  onLogout: () => void;
}

function timeAgo(dateStr: string): string {
  const raw = dateStr.endsWith("Z") || dateStr.includes("+") ? dateStr : `${dateStr}Z`;
  const diff = Date.now() - new Date(raw).getTime();
  const mins = Math.floor(diff / 60000);
  if (Number.isNaN(mins) || mins < 1) return "เมื่อกี้";
  if (mins < 60) return `${mins} นาทีที่แล้ว`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} ชม.ที่แล้ว`;
  return `${Math.floor(hrs / 24)} วันที่แล้ว`;
}

export default function ChatTopBar({
  activeView,
  userName,
  userEmail,
  isAdmin,
  isSupport,
  unreadNotifs,
  notifications,
  searchPlaceholder = "ค้นหาบอทหรือประวัติ...",
  onSearch,
  onMarkRead,
  onMarkAllRead,
  onNavigateBots,
  onLogout,
}: ChatTopBarProps) {
  const [topSearch, setTopSearch] = useState("");
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotifs, setShowNotifs] = useState(false);

  const sortedNotifs = useMemo(
    () =>
      [...notifications].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      ),
    [notifications]
  );

  const submitSearch = () => {
    onSearch(topSearch.trim());
  };

  return (
    <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between flex-shrink-0">
      <div className="flex items-center gap-4 flex-1">
        <p className="text-sm text-gray-500 hidden sm:block">
          scopebot <span className="mx-1.5 text-gray-300">/</span>
          <span className="text-gray-900" style={{ fontWeight: 500 }}>
            {VIEW_LABELS[activeView]}
          </span>
        </p>
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            type="text"
            value={topSearch}
            onChange={(e) => setTopSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submitSearch();
              }
            }}
            placeholder={searchPlaceholder}
            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
          />
        </div>
      </div>

      <div className="flex items-center gap-2 ml-4">
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setShowNotifs((v) => !v);
              setShowUserMenu(false);
            }}
            className="relative p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
            aria-label="การแจ้งเตือน"
          >
            <Bell className="w-4 h-4" />
            {unreadNotifs > 0 && (
              <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center">
                {unreadNotifs > 9 ? "9+" : unreadNotifs}
              </span>
            )}
          </button>

          {showNotifs && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowNotifs(false)}
              />
              <div className="absolute right-0 mt-2 w-80 max-h-96 bg-white rounded-xl shadow-xl border border-gray-100 z-50 flex flex-col overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                  <p className="text-sm text-gray-900" style={{ fontWeight: 600 }}>
                    การแจ้งเตือน
                  </p>
                  {unreadNotifs > 0 && (
                    <button
                      type="button"
                      onClick={onMarkAllRead}
                      className="text-[11px] text-amber-700 hover:text-amber-800 flex items-center gap-1"
                    >
                      <CheckCheck className="w-3.5 h-3.5" />
                      อ่านทั้งหมด
                    </button>
                  )}
                </div>
                <div className="overflow-y-auto flex-1">
                  {sortedNotifs.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-10">
                      ยังไม่มีการแจ้งเตือน
                    </p>
                  ) : (
                    sortedNotifs.map((n) => (
                      <button
                        key={n.id}
                        type="button"
                        onClick={() => {
                          if (!n.is_read) onMarkRead(n.id);
                        }}
                        className={`w-full text-left px-4 py-3 border-b border-gray-50 hover:bg-amber-50/60 transition-colors ${
                          n.is_read ? "bg-white" : "bg-amber-50/40"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p
                            className="text-sm text-gray-900"
                            style={{ fontWeight: n.is_read ? 500 : 650 }}
                          >
                            {n.title}
                          </p>
                          {!n.is_read && (
                            <span className="mt-1 w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" />
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                          {n.message}
                        </p>
                        <p className="text-[10px] text-gray-400 mt-1.5">
                          {timeAgo(n.created_at)}
                        </p>
                      </button>
                    ))
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setShowUserMenu(!showUserMenu);
              setShowNotifs(false);
            }}
            className="flex items-center gap-2 hover:bg-gray-100 rounded-lg px-2 py-1.5 transition-colors"
          >
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center ${
                isAdmin
                  ? "bg-amber-400"
                  : isSupport
                    ? "bg-orange-400"
                    : "bg-gray-600"
              }`}
            >
              {isAdmin ? (
                <Crown className="w-4 h-4 text-gray-900" />
              ) : isSupport ? (
                <Headphones className="w-4 h-4 text-white" />
              ) : (
                <User className="w-4 h-4 text-white" />
              )}
            </div>
            <span className="text-sm text-gray-700 hidden sm:block">{userName}</span>
            <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
          </button>

          {showUserMenu && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowUserMenu(false)}
              />
              <div className="absolute right-0 mt-2 w-52 bg-white rounded-xl shadow-xl border border-gray-100 py-2 z-50">
                <div className="px-4 py-2.5 border-b border-gray-100">
                  <p className="text-sm text-gray-900" style={{ fontWeight: 600 }}>
                    {userName}
                  </p>
                  <p className="text-xs text-gray-400">{userEmail}</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowUserMenu(false);
                    onNavigateBots();
                  }}
                  className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-600 hover:bg-amber-50 hover:text-amber-700 transition-colors w-full text-left"
                >
                  <Bot className="w-4 h-4" />
                  Bots
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowUserMenu(false);
                    onLogout();
                  }}
                  className="flex items-center gap-2 w-full text-left px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  ออกจากระบบ
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
