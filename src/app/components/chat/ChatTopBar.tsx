import { useState } from "react";
import {
  Search,
  Bell,
  ChevronDown,
  Crown,
  Headphones,
  User,
  LogOut,
  Bot,
} from "lucide-react";
import type { ActiveView } from "../../types/chat";
import { VIEW_LABELS } from "../../constants/chat";

interface ChatTopBarProps {
  activeView: ActiveView;
  userName?: string;
  userEmail?: string;
  isAdmin: boolean;
  isSupport: boolean;
  unreadNotifs: number;
  onNavigateBots: () => void;
  onLogout: () => void;
}

export default function ChatTopBar({
  activeView,
  userName,
  userEmail,
  isAdmin,
  isSupport,
  unreadNotifs,
  onNavigateBots,
  onLogout,
}: ChatTopBarProps) {
  const [topSearch, setTopSearch] = useState("");
  const [showUserMenu, setShowUserMenu] = useState(false);

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
            placeholder="ค้นหา..."
            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
          />
        </div>
      </div>

      <div className="flex items-center gap-2 ml-4">
        <button className="relative p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors">
          <Bell className="w-4 h-4" />
          {unreadNotifs > 0 && (
            <span className="absolute top-1.5 right-1.5 flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
            </span>
          )}
        </button>

        <div className="relative">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
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
            <span className="text-sm text-gray-700 hidden sm:block">
              {userName}
            </span>
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
                  <p
                    className="text-sm text-gray-900"
                    style={{ fontWeight: 600 }}
                  >
                    {userName}
                  </p>
                  <p className="text-xs text-gray-400">{userEmail}</p>
                </div>
                <button
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
