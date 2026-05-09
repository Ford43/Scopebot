import { Outlet, Link, useLocation, useNavigate } from "react-router";
import { useState } from "react";
import {
  LayoutDashboard,
  MessageSquare,
  FileText,
  Search,
  User,
  LogOut,
  ChevronDown,
  Puzzle,
  History,
  Zap,
  Brain,
  Bell,
  X,
} from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";

const menuItems = [
  { id: "dashboard",      label: "Dashboard",           path: "/",               icon: LayoutDashboard },
  { id: "chat",           label: "Unified Chat",         path: "/unified-chat",   icon: MessageSquare,  badge: true },
  { id: "documents",      label: "Documents",            path: "/documents",      icon: FileText },
  { id: "search-history", label: "ประวัติการค้นหา",     path: "/search-history", icon: History },
  { id: "integration",    label: "Integration",          path: "/integration",    icon: Puzzle },
];

export default function AdminLayout() {
  const location  = useLocation();
  const navigate  = useNavigate();
  const { user, logout, isAuthenticated } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const isActive = (path: string) =>
    path === "/" ? location.pathname === "/" : location.pathname.startsWith(path);

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">

      {/* ── Sidebar ── */}
      <aside className="w-64 bg-gray-900 flex flex-col flex-shrink-0">

        {/* Brand + User card */}
        <div className="px-5 py-5 border-b border-gray-800 space-y-4">
          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-amber-400 rounded-lg flex items-center justify-center">
              <Zap className="w-4 h-4 text-gray-900" />
            </div>
            <span className="text-white text-base" style={{ fontWeight: 700 }}>scopebot</span>
          </div>

          {/* User card */}
          {isAuthenticated && user ? (
            <div className="flex items-center gap-3 bg-gray-800 rounded-xl px-3 py-2.5">
              <div className="w-8 h-8 bg-amber-400 rounded-full flex items-center justify-center flex-shrink-0">
                <User className="w-4 h-4 text-gray-900" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-white truncate" style={{ fontWeight: 500 }}>{user.name}</p>
                <p className="text-[11px] text-gray-500 truncate">{user.email}</p>
              </div>
            </div>
          ) : (
            <Link
              to="/login"
              className="flex items-center gap-2 bg-amber-400/10 border border-amber-400/30 rounded-xl px-3 py-2.5 text-sm text-amber-400 hover:bg-amber-400/20 transition-colors"
            >
              <User className="w-4 h-4" />
              <span>เข้าสู่ระบบ</span>
            </Link>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 overflow-y-auto">
          <p className="text-[10px] text-gray-600 uppercase tracking-wider px-3 mb-2">เมนูหลัก</p>
          <ul className="space-y-0.5">
            {menuItems.map((item) => {
              const Icon   = item.icon;
              const active = isActive(item.path);
              return (
                <li key={item.id}>
                  <Link
                    to={item.path}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-sm ${
                      active
                        ? "bg-amber-400 text-gray-900"
                        : "text-gray-400 hover:bg-gray-800 hover:text-white"
                    }`}
                  >
                    <Icon className={`w-4 h-4 flex-shrink-0 ${active ? "text-gray-900" : "text-gray-500"}`} />
                    <span className="flex-1">{item.label}</span>
                    {item.badge && !active && (
                      <span className="w-2 h-2 bg-amber-400 rounded-full" />
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>

          {/* User Chat section */}
          <div className="mt-4 pt-4 border-t border-gray-800">
            <p className="text-[10px] text-gray-600 uppercase tracking-wider px-3 mb-2">ผู้ใช้งาน</p>
            <Link
              to="/chat"
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                location.pathname === "/chat"
                  ? "bg-amber-400 text-gray-900"
                  : "text-gray-400 hover:bg-gray-800 hover:text-white"
              }`}
            >
              <MessageSquare className={`w-4 h-4 flex-shrink-0 ${location.pathname === "/chat" ? "text-gray-900" : "text-gray-500"}`} />
              <span>หน้าแชทผู้ใช้</span>
            </Link>
          </div>
        </nav>

        {/* Logout */}
        {isAuthenticated && (
          <div className="px-3 py-4 border-t border-gray-800">
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-400 hover:bg-gray-800 hover:text-red-400 transition-colors w-full text-sm"
            >
              <LogOut className="w-4 h-4 text-gray-500" />
              <span>ออกจากระบบ</span>
            </button>
          </div>
        )}
      </aside>

      {/* ── Main ── */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Top bar */}
        <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between flex-shrink-0">
          {/* Search */}
          <div className="flex-1 max-w-lg">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="ค้นหา..."
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
              />
            </div>
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-2 ml-4">
            {/* Notification bell */}
            <button className="relative p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors">
              <Bell className="w-4 h-4" />
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-amber-400 rounded-full" />
            </button>

            {/* User dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center gap-2 hover:bg-gray-100 rounded-lg px-2 py-1.5 transition-colors"
              >
                <div className="w-8 h-8 bg-amber-400 rounded-full flex items-center justify-center">
                  <User className="w-4 h-4 text-gray-900" />
                </div>
                <span className="text-sm text-gray-700 hidden sm:block">
                  {isAuthenticated ? user?.name : "Guest"}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
              </button>

              {showUserMenu && (
                <>
                  {/* Backdrop */}
                  <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)} />
                  <div className="absolute right-0 mt-2 w-52 bg-white rounded-xl shadow-xl border border-gray-100 py-2 z-50">
                    <div className="px-4 py-2.5 border-b border-gray-100">
                      <p className="text-sm text-gray-900" style={{ fontWeight: 600 }}>
                        {isAuthenticated ? user?.name : "Guest"}
                      </p>
                      <p className="text-xs text-gray-400">
                        {isAuthenticated ? user?.email : "ยังไม่ได้เข้าสู่ระบบ"}
                      </p>
                    </div>
                    <Link
                      to="/chat"
                      className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-600 hover:bg-amber-50 hover:text-amber-700 transition-colors"
                      onClick={() => setShowUserMenu(false)}
                    >
                      <MessageSquare className="w-4 h-4" />
                      หน้าแชทผู้ใช้
                    </Link>
                    {isAuthenticated ? (
                      <button
                        onClick={() => { setShowUserMenu(false); handleLogout(); }}
                        className="flex items-center gap-2 w-full text-left px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 transition-colors"
                      >
                        <LogOut className="w-4 h-4" />
                        ออกจากระบบ
                      </button>
                    ) : (
                      <Link
                        to="/login"
                        className="flex items-center gap-2 px-4 py-2.5 text-sm text-amber-600 hover:bg-amber-50 transition-colors"
                        onClick={() => setShowUserMenu(false)}
                      >
                        <User className="w-4 h-4" />
                        เข้าสู่ระบบ
                      </Link>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}