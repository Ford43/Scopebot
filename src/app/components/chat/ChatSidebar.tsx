import type { ComponentType } from "react";
import { Link } from "react-router";
import {
  LogOut,
  User,
  Menu,
  Zap,
  Crown,
  Headphones,
  UserCircle2,
} from "lucide-react";
import type { ActiveView } from "../../types/chat";
import { menuItemsForRole } from "../../constants/chat";

interface ChatSidebarProps {
  activeView: ActiveView;
  sidebarCollapsed: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isSupport: boolean;
  role: string;
  userName?: string;
  unreadCount?: number;
  onToggleCollapse: () => void;
  onViewChange: (view: ActiveView) => void;
  onLogout: () => void;
}

export default function ChatSidebar({
  activeView,
  sidebarCollapsed,
  isAuthenticated,
  isAdmin,
  isSupport,
  role,
  userName,
  unreadCount = 0,
  onToggleCollapse,
  onViewChange,
  onLogout,
}: ChatSidebarProps) {
  const profileConfig = isAdmin
    ? {
        icon: Crown,
        bg: "bg-amber-400",
        text: "text-gray-900",
        badge: "bg-amber-400 text-gray-900",
        label: "Admin",
      }
    : isSupport
      ? {
          icon: Headphones,
          bg: "bg-orange-400",
          text: "text-white",
          badge: "bg-orange-400 text-white",
          label: "Support",
        }
      : {
          icon: UserCircle2,
          bg: "bg-gray-600",
          text: "text-white",
          badge: "bg-gray-700 text-gray-300",
          label: "User",
        };
  const ProfileIcon = profileConfig.icon;
  const menuItems = menuItemsForRole(role);

  return (
    <>
      <div
        className={`border-b border-gray-800 flex items-center flex-shrink-0 ${sidebarCollapsed ? "flex-col gap-2 px-3 py-3" : "px-5 py-4 justify-between"}`}
      >
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-amber-400 rounded-lg flex items-center justify-center flex-shrink-0">
            <Zap className="w-4 h-4 text-gray-900" />
          </div>
          {!sidebarCollapsed && (
            <span
              className="text-white text-base whitespace-nowrap"
              style={{ fontWeight: 700 }}
            >
              scopebot
            </span>
          )}
        </div>
        <button
          onClick={onToggleCollapse}
          className="p-1.5 rounded-lg hover:bg-gray-800 transition-colors flex-shrink-0"
          title="Toggle Sidebar"
        >
          <Menu className="w-4 h-4 text-gray-400" />
        </button>
      </div>

      {!isAuthenticated ? (
        <div
          className={`border-b border-gray-800 ${sidebarCollapsed ? "px-2 py-4 flex flex-col items-center gap-2" : "px-3 py-4 space-y-2"}`}
        >
          {sidebarCollapsed ? (
            <Link
              to="/login"
              title="เข้าสู่ระบบ"
              className="w-9 h-9 bg-amber-400 hover:bg-amber-500 text-gray-900 rounded-xl flex items-center justify-center transition-colors"
            >
              <User className="w-4 h-4" />
            </Link>
          ) : (
            <>
              <Link
                to="/login"
                className="flex items-center justify-center gap-2 w-full bg-amber-400 hover:bg-amber-500 text-gray-900 py-2.5 rounded-xl text-sm transition-colors"
                style={{ fontWeight: 700 }}
              >
                <User className="w-4 h-4" />
                เข้าสู่ระบบ
              </Link>
              <Link
                to="/signup"
                className="flex items-center justify-center gap-2 w-full bg-gray-800 hover:bg-gray-700 text-gray-300 py-2 rounded-xl text-sm transition-colors border border-gray-700"
              >
                สมัครสมาชิกฟรี
              </Link>
            </>
          )}
        </div>
      ) : (
        <div
          className={`border-b border-gray-800 ${sidebarCollapsed ? "px-2 py-3 flex items-center justify-center" : "px-3 py-3"}`}
        >
          {sidebarCollapsed ? (
            <div
              className={`w-9 h-9 ${profileConfig.bg} rounded-full flex items-center justify-center`}
              title={`${userName} (${profileConfig.label})`}
            >
              <ProfileIcon className={`w-4 h-4 ${profileConfig.text}`} />
            </div>
          ) : (
            <div className="flex items-center gap-3 bg-gray-800 rounded-xl px-3 py-2.5">
              <div
                className={`w-9 h-9 ${profileConfig.bg} rounded-full flex items-center justify-center flex-shrink-0`}
              >
                <ProfileIcon className={`w-4 h-4 ${profileConfig.text}`} />
              </div>
              <div className="min-w-0 flex-1">
                <p
                  className="text-sm text-white truncate"
                  style={{ fontWeight: 600 }}
                >
                  {userName}
                </p>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-full ${profileConfig.badge}`}
                >
                  {profileConfig.label}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      <nav
        className={`flex-1 overflow-y-auto py-3 space-y-0.5 ${sidebarCollapsed ? "px-2" : "px-3"}`}
      >
        {isAuthenticated && (
          <>
            {sidebarCollapsed ? (
              <div className="border-t border-gray-800 my-2" />
            ) : (
              <div className="pt-3 pb-1">
                <p className="text-[10px] text-gray-600 uppercase tracking-wider px-3">
                  เมนูหลัก
                </p>
              </div>
            )}

            {menuItems.map((item) => (
              <NavButton
                key={item.id}
                id={item.id}
                label={item.label}
                icon={item.icon}
                badgeCount={
                  item.showUnreadBadge && unreadCount > 0
                    ? unreadCount
                    : undefined
                }
                activeView={activeView}
                sidebarCollapsed={sidebarCollapsed}
                onClick={() => onViewChange(item.id)}
              />
            ))}
          </>
        )}
      </nav>

      {isAuthenticated && (
        <div
          className={`border-t border-gray-800 ${sidebarCollapsed ? "px-2 py-3 flex items-center justify-center" : "px-3 py-3"}`}
        >
          <button
            onClick={onLogout}
            title={sidebarCollapsed ? "ออกจากระบบ" : undefined}
            className={`flex items-center rounded-lg text-gray-400 hover:bg-gray-800 hover:text-red-400 transition-colors ${sidebarCollapsed ? "p-2.5" : "gap-3 px-3 py-2.5 w-full text-sm"}`}
          >
            <LogOut className="w-4 h-4 text-gray-500" />
            {!sidebarCollapsed && <span>ออกจากระบบ</span>}
          </button>
        </div>
      )}
    </>
  );
}

function NavButton({
  id,
  label,
  icon: Icon,
  badgeCount,
  activeView,
  sidebarCollapsed,
  onClick,
}: {
  id: ActiveView;
  label: string;
  icon: ComponentType<{ className?: string }>;
  badgeCount?: number;
  activeView: ActiveView;
  sidebarCollapsed: boolean;
  onClick: () => void;
}) {
  const active = activeView === id;
  return (
    <button
      onClick={onClick}
      title={
        sidebarCollapsed
          ? badgeCount
            ? `${label} (${badgeCount})`
            : label
          : undefined
      }
      className={`w-full flex items-center rounded-lg text-sm transition-colors relative ${
        sidebarCollapsed ? "justify-center p-2.5" : "gap-3 px-3 py-2.5"
      } ${
        active
          ? "bg-amber-400 text-gray-900"
          : "text-gray-400 hover:bg-gray-800 hover:text-white"
      }`}
    >
      <Icon
        className={`w-4 h-4 flex-shrink-0 ${active ? "text-gray-900" : "text-gray-500"}`}
      />
      {sidebarCollapsed && !!badgeCount && !active && (
        <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-amber-400 rounded-full" />
      )}
      {!sidebarCollapsed && (
        <>
          <span className="flex-1 text-left">{label}</span>
          {!!badgeCount && !active && (
            <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-amber-400 text-gray-900 text-[10px] flex items-center justify-center">
              {badgeCount > 9 ? "9+" : badgeCount}
            </span>
          )}
        </>
      )}
    </button>
  );
}
