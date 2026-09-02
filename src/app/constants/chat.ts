import {
  LayoutDashboard,
  MessageSquare,
  History,
  Puzzle,
  User,
  Bot,
} from "lucide-react";
import type { ActiveView, MenuItem } from "../types/chat";

export const SUGGESTED_PROMPTS = [
  { id: "1", text: "📄 ระเบียบการลา" },
  { id: "2", text: "💰 สอบถามเงินเดือน" },
  { id: "3", text: "🏢 ข้อมูลองค์กร" },
  { id: "4", text: "🖥️ IT Support" },
  { id: "5", text: "⏰ เวลาทำงาน" },
  { id: "6", text: "🙋 ติดต่อเจ้าหน้าที่" },
];

export const CATEGORY_COLORS: Record<string, string> = {
  "ระเบียบการลา": "bg-amber-100 text-amber-700",
  "เงินเดือน": "bg-gray-100 text-gray-600",
  "ข้อมูลองค์กร": "bg-yellow-100 text-yellow-700",
  "IT Support": "bg-gray-200 text-gray-700",
  "เวลาทำงาน": "bg-amber-50 text-amber-600",
  "การสมัครงาน": "bg-gray-100 text-gray-600",
  Error: "bg-red-100 text-red-600",
  Support: "bg-sky-100 text-sky-700",
  system: "bg-gray-100 text-gray-600",
};

export const VIEW_LABELS: Record<ActiveView, string> = {
  dashboard: "แดชบอร์ด",
  "unified-chat": "แชทรวม",
  "search-history": "ประวัติการสนทนา",
  integration: "การเชื่อมต่อ",
  chat: "แชท",
  bots: "บอท",
  "user-management": "จัดการผู้ใช้งาน",
};

export const PRODUCT_MENU_ITEMS: MenuItem[] = [
  { id: "dashboard", label: "แดชบอร์ด", icon: LayoutDashboard },
  { id: "bots", label: "บอท", icon: Bot },
  {
    id: "unified-chat",
    label: "แชทรวม",
    icon: MessageSquare,
    showUnreadBadge: true,
  },
  { id: "search-history", label: "ประวัติการสนทนา", icon: History },
  { id: "integration", label: "การเชื่อมต่อ", icon: Puzzle },
];

/** เจ้าของร้าน — เมนูสินค้าทั้งหมด ยกเว้นจัดการผู้ใช้ */
export const USER_MENU_ITEMS: MenuItem[] = PRODUCT_MENU_ITEMS;

export const ADMIN_MENU_ITEMS: MenuItem[] = [
  { id: "dashboard", label: "แดชบอร์ด", icon: LayoutDashboard },
  { id: "bots", label: "บอท", icon: Bot },
  {
    id: "unified-chat",
    label: "แชทรวม",
    icon: MessageSquare,
    showUnreadBadge: true,
  },
  { id: "user-management", label: "จัดการผู้ใช้งาน", icon: User },
  { id: "search-history", label: "ประวัติการสนทนา", icon: History },
  { id: "integration", label: "การเชื่อมต่อ", icon: Puzzle },
];

/** ซัพพอร์ตแพลตฟอร์ม — คุมบัญชีอย่างเดียว */
export const SUPPORT_MENU_ITEMS: MenuItem[] = [
  { id: "user-management", label: "จัดการผู้ใช้งาน", icon: User },
];

export function menuItemsForRole(role: string): MenuItem[] {
  if (role === "admin") return ADMIN_MENU_ITEMS;
  if (role === "support") return SUPPORT_MENU_ITEMS;
  return USER_MENU_ITEMS;
}

export function defaultViewForRole(role: string): ActiveView {
  if (role === "admin") return "dashboard";
  if (role === "support") return "user-management";
  return "bots";
}

export function roleCanAccessView(role: string, view: ActiveView): boolean {
  if (view === "chat") return role === "admin" || role === "user";
  return menuItemsForRole(role).some((item) => item.id === view);
}

/** Build suggested prompt chips from bot description when no top-questions yet */
export function promptsFromDescription(description?: string): string[] {
  if (!description?.trim()) return [];
  return description
    .split(/[。.!?！？\n;；|]/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 6 && s.length <= 60)
    .slice(0, 4);
}
