import { useState, useRef, useEffect } from "react";
import {
  LayoutDashboard, MessageSquare, Brain, FileText, History, Puzzle,
  LogOut, User, Search, Bell, ChevronDown, Sparkles, Zap, Plus, Mic,
  ImageIcon, Headphones, PenSquare, ChevronRight, Trash2, Clock, X,
  Home, Crown, Shield, UserCircle2, AlertTriangle, Send, Menu, Bot,
  Hourglass,Eye,
} from "lucide-react";
import { Link, useNavigate } from "react-router";
import { generateAIResponse, getTypingDelay } from "../../utils/aiEngine";
import { useAuth } from "../../contexts/AuthContext";
import Dashboard   from "../admin/Dashboard";
import AIAnalytics from "../admin/AIAnalytics";
import Documents   from "../admin/Documents";
import Integration from "../admin/Integration";
import SearchHistory from "../admin/SearchHistory";
import UnifiedChat from "../admin/UnifiedChat";
import { Tooltip, TooltipTrigger, TooltipContent } from "../ui/tooltip";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "../ui/alert-dialog";
import BotsPage from "./BotsPage";


/* ─────────────── Types ─────────────── */
type ActiveView =
  | "dashboard" | "unified-chat" | "analytics"
  | "documents" | "search-history" | "integration" | "chat" | "bots"  | "user-management";

interface Message {
  id: string;
  sender: "bot" | "user";
  text: string;
  time: string;
  confidence?: number;
  category?: string;
}

interface HistoryItem {
  id: string;
  query: string;
  category?: string;
  time: string;
  timestamp: number;
}

/* ─────────────── Constants ─────────────── */
const suggestedPrompts = [
  { id: "1", text: "📄 ระเบียบการลา" },
  { id: "2", text: "💰 สอบถามเงินเดือน" },
  { id: "3", text: "🏢 ข้อมูลองค์กร" },
  { id: "4", text: "🖥️ IT Support" },
  { id: "5", text: "⏰ เวลาทำงาน" },
  { id: "6", text: "🙋 ติดต่อเจ้าหน้าที่" },
];

const categoryColors: Record<string, string> = {
  "ระเบียบการลา": "bg-amber-100 text-amber-700",
  "เงินเดือน":    "bg-gray-100 text-gray-600",
  "ข้อมูลองค์กร": "bg-yellow-100 text-yellow-700",
  "IT Support":   "bg-gray-200 text-gray-700",
  "เวลาทำงาน":   "bg-amber-50 text-amber-600",
  "การสมัครงาน": "bg-gray-100 text-gray-600",
};

const viewLabels: Record<ActiveView, string> = {
  dashboard:        "Dashboard",
  "unified-chat":   "Unified Chat",
  analytics:        "AI Analytics",
  documents:        "Documents",
  "search-history": "ประวัติการค้นหา",
  integration:      "Integration",
  chat:             "Home",
  bots:             "Bots",
  "user-management": "User Management",
};

const userManagementUsers = [
  { id: "1", name: "John Smith", email: "john.smith@gmail.com", username: "jonny77", status: "Active", role: "Admin", joined: "March 12, 2023", lastActive: "1 minute ago" },
  { id: "2", name: "Olivia Bennett", email: "ollyben@gmail.com", username: "olly659", status: "Inactive", role: "User", joined: "June 27, 2022", lastActive: "1 month ago" },
  { id: "3", name: "Daniel Warren", email: "dwarren3@gmail.com", username: "dwarren3", status: "Banned", role: "User", joined: "January 8, 2024", lastActive: "4 days ago" },
  { id: "4", name: "Chloe Hayes", email: "chloehhye@gmail.com", username: "chloehh", status: "Pending", role: "Guest", joined: "October 5, 2021", lastActive: "10 days ago" },
  { id: "5", name: "Marcus Reed", email: "reeds777@gmail.com", username: "reeds7", status: "Suspended", role: "User", joined: "February 19, 2023", lastActive: "3 months ago" },
  { id: "6", name: "Isabelle Clark", email: "belleclark@gmail.com", username: "bellecl", status: "Active", role: "Moderator", joined: "August 30, 2022", lastActive: "1 week ago" },
];

function getStatusClass(status: string) {
  switch (status) {
    case "Active": return "bg-emerald-100 text-emerald-700";
    case "Inactive": return "bg-slate-100 text-slate-600";
    case "Banned": return "bg-rose-100 text-rose-700";
    case "Pending": return "bg-sky-100 text-sky-700";
    case "Suspended": return "bg-amber-100 text-amber-700";
    default: return "bg-gray-100 text-gray-600";
  }
}

function groupByDate(items: HistoryItem[]) {
  const today     = new Date(); today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
  const groups: Record<string, HistoryItem[]> = {};
  items.forEach((item) => {
    const d = new Date(item.timestamp); d.setHours(0, 0, 0, 0);
    const label =
      d.getTime() === today.getTime()     ? "วันนี้" :
      d.getTime() === yesterday.getTime() ? "เมื่อวาน" :
      d.toLocaleDateString("th-TH", { day: "numeric", month: "short" });
    if (!groups[label]) groups[label] = [];
    groups[label].push(item);
  });
  return groups;
}

/* ═══════════════ Main Component ═══════════════ */
export default function ChatInterface() {
  const [messages, setMessages]           = useState<Message[]>([]);
  const [inputValue, setInputValue]       = useState("");
  const [isTyping, setIsTyping]           = useState(false);
  const [historyItems, setHistoryItems]   = useState<HistoryItem[]>([]);
  const [historySearch, setHistorySearch] = useState("");
  const [showHistoryDrawer, setShowHistoryDrawer] = useState(false);
  const [showUserMenu, setShowUserMenu]   = useState(false);
  const [topSearch, setTopSearch]         = useState("");
  const [activeView, setActiveView]       = useState<ActiveView>("chat");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [roleFilter, setRoleFilter] = useState("All Roles");
  const [statusFilter, setStatusFilter] = useState("All Status");
  const [dateFilter, setDateFilter] = useState("All Dates");
  const [showRoleDropdown, setShowRoleDropdown] = useState(false);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [showDateDropdown, setShowDateDropdown] = useState(false);

  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [userToDelete, setUserToDelete] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef    = useRef<HTMLTextAreaElement>(null);
  const prevRoleRef    = useRef<string | undefined>(undefined);

  const { user, logout, isAuthenticated, isAdmin, isSupport } = useAuth();
  const navigate = useNavigate();
  const role = user?.role ?? "guest";

  /* Set default view per role on login */
  useEffect(() => {
    if (user?.role !== prevRoleRef.current) {
      prevRoleRef.current = user?.role;
      if (user?.role === "admin")   setActiveView("dashboard");
      else if (user?.role === "support") setActiveView("unified-chat");
      else setActiveView("chat");
    }
  }, [user?.role]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [inputValue]);

  const timeNow = () =>
    new Date().toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });

  const handleSend = (overrideText?: string) => {
    const text = (overrideText ?? inputValue).trim();
    if (!text || isTyping) return;
    const now = new Date();
    const timeStr = now.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });

    setMessages((prev) => [
      ...prev,
      { id: Date.now().toString(), sender: "user", text, time: timeStr },
    ]);
    setInputValue("");
    setIsTyping(true);

    const aiResult = generateAIResponse(text);
    const delay    = getTypingDelay(aiResult.response.length);

    /* Save history only for authenticated users */
    if (isAuthenticated) {
      setHistoryItems((prev) => [
        { id: Date.now().toString(), query: text, category: aiResult.category, time: timeStr, timestamp: now.getTime() },
        ...prev,
      ]);
    }

    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          sender: "bot",
          text: aiResult.response,
          time: timeNow(),
          confidence: aiResult.confidence,
          category: aiResult.category,
        },
      ]);
      setIsTyping(false);
    }, delay);
  };

  const handleNewChat = () => { setMessages([]); setInputValue(""); setActiveView("chat"); };

  const handleHistoryClick = (query: string) => {
    setShowHistoryDrawer(false);
    setActiveView("chat");
    setTimeout(() => handleSend(query), 150);
  };

  const handleLogout = () => { logout(); navigate("/login"); };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedUsers(new Set(userManagementUsers.map(u => u.id)));
    } else {
      setSelectedUsers(new Set());
    }
  };

  const handleSelectUser = (userId: string, checked: boolean) => {
    const newSelected = new Set(selectedUsers);
    if (checked) {
      newSelected.add(userId);
    } else {
      newSelected.delete(userId);
    }
    setSelectedUsers(newSelected);
  };

  const handleDeleteUser = (userId: string) => {
    // In real app, this would call an API
    console.log(`Deleting user ${userId}`);
    setUserToDelete(null);
  };

  const handleBulkDelete = () => {
    // In real app, this would call an API
    console.log(`Deleting users:`, Array.from(selectedUsers));
    setSelectedUsers(new Set());
  };

  const filteredHistory = historyItems.filter((h) =>
    h.query.toLowerCase().includes(historySearch.toLowerCase())
  );
  const groupedHistory  = groupByDate(filteredHistory);
  const isWelcomeScreen = messages.length === 0 && activeView === "chat";

  /* ──────────────────────────────────────────
     Role-based menu definitions
  ────────────────────────────────────────── */
  const adminMenuItems = [
    { id: "dashboard"       as ActiveView, label: "Dashboard",        icon: LayoutDashboard },
    { id: "unified-chat"    as ActiveView, label: "Unified Chat",      icon: MessageSquare, badge: true },
    { id: "analytics"       as ActiveView, label: "AI Analytics",      icon: Brain },
    { id: "documents"       as ActiveView, label: "Documents",         icon: FileText },
    { id: "search-history"  as ActiveView, label: "ประวัติการค้นหา",  icon: History },
    { id: "integration"     as ActiveView, label: "Integration",       icon: Puzzle },
    { id: "chat" as ActiveView, label: "Chat", icon: MessageSquare },
    { id: "user-management" as ActiveView, label: "User Management", icon: User },
    { id: "bots"            as ActiveView, label: "Bots",             icon: Bot },
  ];

  const supportMenuItems = [
    { id: "unified-chat" as ActiveView, label: "Unified Chat", icon: MessageSquare, badge: true },
  ];

  /* ──────────────────────────────────────────
     Render admin views
  ────────────────────────────────────────── */
  const renderUserManagement = () => (
    <div className="p-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">User Management</h1>
          <p className="mt-2 text-sm text-slate-500 max-w-2xl">
            Manage all users in one place. Control access, assign roles, and monitor activity across your platform.
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Total users</p>
          <p className="mt-3 text-3xl font-semibold text-slate-900">1,420</p>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Active</p>
          <p className="mt-3 text-3xl font-semibold text-slate-900">842</p>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Pending</p>
          <p className="mt-3 text-3xl font-semibold text-slate-900">112</p>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Banned</p>
          <p className="mt-3 text-3xl font-semibold text-slate-900">26</p>
        </div>
      </div>

      <div className="mt-6 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-slate-200 bg-slate-50 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 shadow-sm">
              <Search className="w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="search name"
                className="w-full border-0 bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
              />
            </div>
            <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 shadow-sm">
              <Search className="w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="search name"
                className="w-full border-0 bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
              />
            </div>

            {/* Role Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowRoleDropdown(!showRoleDropdown)}
                className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 shadow-sm hover:bg-slate-100 transition-colors"
              >
                {roleFilter}
                <ChevronDown className="w-4 h-4" />
              </button>
              {showRoleDropdown && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowRoleDropdown(false)} />
                  <div className="absolute top-full mt-1 w-40 rounded-lg border border-slate-200 bg-white shadow-lg z-20">
                    {["All Roles", "Admin", "User", "Moderator", "Guest"].map((role) => (
                      <button
                        key={role}
                        onClick={() => { setRoleFilter(role); setShowRoleDropdown(false); }}
                        className="w-full px-4 py-2 text-left text-sm text-slate-600 hover:bg-slate-50 first:rounded-t-lg last:rounded-b-lg"
                      >
                        {role}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Status Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowStatusDropdown(!showStatusDropdown)}
                className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 shadow-sm hover:bg-slate-100 transition-colors"
              >
                {statusFilter}
                <ChevronDown className="w-4 h-4" />
              </button>
              {showStatusDropdown && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowStatusDropdown(false)} />
                  <div className="absolute top-full mt-1 w-40 rounded-lg border border-slate-200 bg-white shadow-lg z-20">
                    {["All Status", "Active", "Inactive", "Pending", "Banned", "Suspended"].map((status) => (
                      <button
                        key={status}
                        onClick={() => { setStatusFilter(status); setShowStatusDropdown(false); }}
                        className="w-full px-4 py-2 text-left text-sm text-slate-600 hover:bg-slate-50 first:rounded-t-lg last:rounded-b-lg"
                      >
                        {status}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Date Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowDateDropdown(!showDateDropdown)}
                className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 shadow-sm hover:bg-slate-100 transition-colors"
              >
                {dateFilter}
                <ChevronDown className="w-4 h-4" />
              </button>
              {showDateDropdown && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowDateDropdown(false)} />
                  <div className="absolute top-full mt-1 w-40 rounded-lg border border-slate-200 bg-white shadow-lg z-20">
                    {["All Dates", "Last 7 days", "Last 30 days", "Last 3 months", "Last year"].map((date) => (
                      <button
                        key={date}
                        onClick={() => { setDateFilter(date); setShowDateDropdown(false); }}
                        className="w-full px-4 py-2 text-left text-sm text-slate-600 hover:bg-slate-50 first:rounded-t-lg last:rounded-b-lg"
                      >
                        {date}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            {selectedUsers.size > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-600">{selectedUsers.size} selected</span>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <button className="rounded-full border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-600 shadow-sm hover:bg-red-100 transition-colors">
                      Delete Selected
                    </button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Users</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to delete {selectedUsers.size} selected user(s)? This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleBulkDelete} className="bg-red-600 hover:bg-red-700">
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            )}
            <button className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 shadow-sm hover:bg-slate-100 transition-colors">
              Export
            </button>
            <Tooltip>
              <TooltipTrigger asChild>
                <button className="inline-flex items-center gap-2 rounded-full bg-amber-400 px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm hover:bg-amber-500 transition-colors">
                  Pending
                  <Hourglass className="w-4 h-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">Pending items</TooltipContent>
            </Tooltip>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-left text-sm">
            <thead>
              <tr className="bg-slate-100 text-slate-500">
                <th className="w-12 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selectedUsers.size === userManagementUsers.length && userManagementUsers.length > 0}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    className="h-4 w-4 text-amber-500"
                  />
                </th>
                <th className="px-4 py-3">Full Name</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Username</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Joined Date</th>
                <th className="px-4 py-3">Last Active</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {userManagementUsers.map((user) => (
                <tr key={user.id} className="border-t border-slate-200 hover:bg-slate-50">
                  <td className="px-4 py-4">
                    <input
                      type="checkbox"
                      checked={selectedUsers.has(user.id)}
                      onChange={(e) => handleSelectUser(user.id, e.target.checked)}
                      className="h-4 w-4 text-amber-500"
                    />
                  </td>
                  <td className="px-4 py-4 font-medium text-slate-900">{user.name}</td>
                  <td className="px-4 py-4 text-slate-600">{user.email}</td>
                  <td className="px-4 py-4 text-slate-600">{user.username}</td>
                  <td className="px-4 py-4">
                    <span className={`inline-flex rounded-full px-3 py-1 text-[11px] font-semibold ${getStatusClass(user.status)}`}>
                      {user.status}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-slate-600">{user.role}</td>
                  <td className="px-4 py-4 text-slate-600">{user.joined}</td>
                  <td className="px-4 py-4 text-slate-600">{user.lastActive}</td>
                  <td className="px-4 py-4 flex items-center gap-2 text-slate-500">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button className="rounded-full p-2 hover:bg-slate-100 transition-colors">
                          <Eye className="w-4 h-4" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="top">View user</TooltipContent>
                    </Tooltip>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <button
                          className="rounded-full p-2 hover:bg-red-50 hover:text-red-600 transition-colors"
                          onClick={() => setUserToDelete(user.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete User</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete "{user.name}"? This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDeleteUser(user.id)}
                            className="bg-red-600 hover:bg-red-700"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-3 border-t border-slate-200 bg-slate-50 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-500">Rows per page: <span className="font-semibold text-slate-900">10</span> of 140</p>
          <div className="flex items-center gap-2">
            <button className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 shadow-sm hover:bg-slate-100 transition-colors">&laquo;</button>
            <button className="rounded-full bg-slate-900 px-3 py-2 text-sm font-semibold text-white">1</button>
            <button className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 shadow-sm hover:bg-slate-100 transition-colors">2</button>
            <button className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 shadow-sm hover:bg-slate-100 transition-colors">3</button>
            <button className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 shadow-sm hover:bg-slate-100 transition-colors">...</button>
            <button className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 shadow-sm hover:bg-slate-100 transition-colors">10</button>
            <button className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 shadow-sm hover:bg-slate-100 transition-colors">&raquo;</button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderContent = () => {
    switch (activeView) {
      case "dashboard":      return <Dashboard />;
      case "unified-chat":   return <UnifiedChat />;
      case "analytics":      return <AIAnalytics />;
      case "documents":      return <Documents />;
      case "search-history": return <SearchHistory />;
      case "integration":    return <Integration />;
      case "user-management": return renderUserManagement();
      case "bots":           return <BotsPage />;
      case "chat":           return renderChat();
    }
  };

  /* ──────────────────────────────────────────
     Chat view
  ────────────────────────────────────────── */
  const renderChat = () => (
    <div className="flex flex-col h-full">
      {/* Chat top bar */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-amber-400 rounded-full flex items-center justify-center">
            <Zap className="w-4 h-4 text-gray-900" />
          </div>
          <div>
            <p className="text-sm text-gray-900" style={{ fontWeight: 600 }}>scopebot</p>
            <p className="text-[11px] text-green-500 flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse inline-block" />
              Online
            </p>
          </div>
        </div>
        <button
          onClick={handleNewChat}
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-amber-600 border border-gray-200 hover:border-amber-300 px-3 py-1.5 rounded-lg transition-colors"
        >
          <PenSquare className="w-3.5 h-3.5" />
          แชทใหม่
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto bg-gray-50">
        {isWelcomeScreen ? (
          <div className="flex flex-col items-center justify-center h-full px-6 pb-8">
            <div className="w-20 h-20 bg-amber-400 rounded-3xl flex items-center justify-center mb-5 shadow-lg shadow-amber-200">
              <Zap className="w-10 h-10 text-gray-900" />
            </div>
            <h1 className="text-gray-900 mb-2 text-center">Welcome to scopebot</h1>
            <p className="text-sm text-gray-500 text-center max-w-md leading-relaxed mb-8">
              ผู้ช่วยดิจิทัลอัจฉริยะ พร้อมให้บริการข้อมูลและความช่วยเหลือด้วยความเป็นมิตร
            </p>

            {/* Guest banner */}
            {!isAuthenticated && (
              <div className="w-full max-w-2xl mb-5">
                <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 flex items-center gap-3">
                  <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
                  <p className="text-sm text-amber-700 flex-1">
                    คุณกำลังใช้งานในโหมด Guest — ประวัติการแชทจะ<strong>ไม่ถูกบันทึก</strong>
                  </p>
                  <Link to="/signup" className="text-xs bg-amber-400 hover:bg-amber-500 text-gray-900 px-3 py-1.5 rounded-lg transition-colors flex-shrink-0" style={{ fontWeight: 600 }}>
                    สมัครฟรี
                  </Link>
                </div>
              </div>
            )}

            <div className="w-full max-w-2xl">
              <div className="bg-white rounded-2xl border-2 border-amber-400 shadow-md shadow-amber-100 px-4 pt-4 pb-3">
                <textarea
                  ref={textareaRef}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                  placeholder="How can I help today? ..."
                  rows={2}
                  className="w-full resize-none outline-none text-sm text-gray-700 placeholder-gray-400 min-h-[56px] max-h-40"
                />
                <div className="flex items-center justify-between pt-2">
                  <div className="flex items-center gap-3">
                    <button className="text-gray-400 hover:text-gray-600 transition-colors"><Plus className="w-4 h-4" /></button>
                    <button className="text-gray-400 hover:text-gray-600 transition-colors"><ImageIcon className="w-4 h-4" /></button>
                  </div>
                  <div className="flex items-center gap-2">
                    <button className="text-gray-400 hover:text-amber-500 transition-colors"><Mic className="w-4 h-4" /></button>
                    <button
                      onClick={() => handleSend()}
                      disabled={!inputValue.trim() || isTyping}
                      className="w-8 h-8 rounded-lg bg-amber-400 hover:bg-amber-500 flex items-center justify-center text-gray-900 transition-colors disabled:opacity-40"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
              <div className="mt-5">
                <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-3">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  Suggested
                </div>
                <div className="flex flex-wrap gap-2">
                  {suggestedPrompts.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => handleSend(p.text.replace(/[📄💰🏢🖥️⏰🙋]/g, "").trim())}
                      className="text-xs bg-white border border-gray-200 text-gray-600 px-4 py-2 rounded-full hover:border-amber-400 hover:text-amber-700 hover:bg-amber-50 transition-colors shadow-sm"
                    >
                      {p.text}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto px-6 py-6 space-y-5">
            {messages.map((message) => (
              <div key={message.id}>
                {message.sender === "bot" ? (
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-amber-400 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Zap className="w-4 h-4 text-gray-900" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-xs text-gray-400">{message.time}</span>
                        {message.category && (
                          <span className={`text-[10px] px-2 py-0.5 rounded-full ${categoryColors[message.category] ?? "bg-gray-100 text-gray-500"}`}>
                            {message.category}
                          </span>
                        )}
                        {message.confidence && message.confidence > 0.8 && (
                          <Sparkles className="w-3 h-3 text-amber-400" />
                        )}
                      </div>
                      <div className="bg-white rounded-2xl rounded-tl-none px-4 py-3 text-sm text-gray-800 whitespace-pre-line shadow-sm border border-gray-100 max-w-[85%]">
                        {message.text}
                      </div>
                      {message.confidence && (
                        <p className="mt-1 text-[10px] text-gray-400 ml-1">
                          ความมั่นใจ: {Math.round(message.confidence * 100)}%
                        </p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex justify-end">
                    <div>
                      <div className="flex items-center justify-end gap-2 mb-1.5">
                        <span className="text-xs text-gray-400">{message.time}</span>
                      </div>
                      <div className="bg-gray-900 text-white rounded-2xl rounded-tr-none px-4 py-3 text-sm max-w-[85%] shadow-sm">
                        {message.text}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
            {isTyping && (
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-amber-400 rounded-full flex items-center justify-center flex-shrink-0">
                  <Zap className="w-4 h-4 text-gray-900" />
                </div>
                <div className="bg-white rounded-2xl rounded-tl-none px-4 py-3 shadow-sm border border-gray-100">
                  <div className="flex gap-1 items-center h-4">
                    <div className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-bounce" />
                    <div className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }} />
                    <div className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: "0.4s" }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input bar (not on welcome screen) */}
      {!isWelcomeScreen && (
        <div className="border-t border-gray-200 bg-white px-6 py-4 flex-shrink-0">
          <div className="max-w-3xl mx-auto">
            <div className="bg-white rounded-2xl border-2 border-amber-400 px-4 pt-3 pb-3 shadow-sm shadow-amber-100">
              <textarea
                ref={textareaRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                placeholder="พิมพ์ข้อความ..."
                rows={1}
                className="w-full resize-none outline-none text-sm text-gray-700 placeholder-gray-400 max-h-32"
              />
              <div className="flex items-center justify-between pt-2">
                <div className="flex items-center gap-3">
                  <button className="text-gray-400 hover:text-gray-600 transition-colors"><Plus className="w-4 h-4" /></button>
                  <button className="text-gray-400 hover:text-gray-600 transition-colors"><ImageIcon className="w-4 h-4" /></button>
                </div>
                <div className="flex items-center gap-2">
                  <button className="text-gray-400 hover:text-amber-500 transition-colors"><Mic className="w-4 h-4" /></button>
                  <button
                    onClick={() => handleSend()}
                    disabled={!inputValue.trim() || isTyping}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-500 text-gray-900 text-xs transition-colors disabled:opacity-40"
                    style={{ fontWeight: 600 }}
                  >
                    <Send className="w-3.5 h-3.5" />
                    ส่ง
                  </button>
                </div>
              </div>
            </div>
            {/* Guest banner in chat mode */}
            {!isAuthenticated && (
              <div className="mt-2 flex items-center justify-center gap-2">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                <p className="text-xs text-amber-600">
                  โหมด Guest — ประวัติแชทจะไม่ถูกบันทึก{" "}
                  <Link to="/signup" className="underline hover:text-amber-800" style={{ fontWeight: 600 }}>สมัครสมาชิกฟรี</Link>
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );

  /* ══════════════════════════════════════════════
     Sidebar — role-based
  ══════════════════════════════════════════════ */
  const renderSidebar = () => {
    /* Profile badge config per role */
    const profileConfig = isAdmin
      ? { icon: Crown,       bg: "bg-amber-400",  text: "text-gray-900",  badge: "bg-amber-400 text-gray-900",  label: "Admin" }
      : isSupport
      ? { icon: Headphones,  bg: "bg-orange-400", text: "text-white",     badge: "bg-orange-400 text-white",    label: "Support" }
      : { icon: UserCircle2, bg: "bg-gray-600",   text: "text-white",     badge: "bg-gray-700 text-gray-300",   label: "User" };
    const ProfileIcon = profileConfig.icon;

    return (
      <>
        {/* ── Brand ── */}
        <div className={`border-b border-gray-800 flex items-center flex-shrink-0 ${sidebarCollapsed ? "flex-col gap-2 px-3 py-3" : "px-5 py-4 justify-between"}`}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-amber-400 rounded-lg flex items-center justify-center flex-shrink-0">
              <Zap className="w-4 h-4 text-gray-900" />
            </div>
            {!sidebarCollapsed && (
              <span className="text-white text-base whitespace-nowrap" style={{ fontWeight: 700 }}>scopebot</span>
            )}
          </div>
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="p-1.5 rounded-lg hover:bg-gray-800 transition-colors flex-shrink-0"
            title="Toggle Sidebar"
          >
            <Menu className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        {/* ── Auth area ── */}
        {!isAuthenticated ? (
          /* GUEST: big login CTA */
          <div className={`border-b border-gray-800 ${sidebarCollapsed ? "px-2 py-4 flex flex-col items-center gap-2" : "px-3 py-4 space-y-2"}`}>
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
          /* LOGGED IN: profile card */
          <div className={`border-b border-gray-800 ${sidebarCollapsed ? "px-2 py-3 flex items-center justify-center" : "px-3 py-3"}`}>
            {sidebarCollapsed ? (
              <div
                className={`w-9 h-9 ${profileConfig.bg} rounded-full flex items-center justify-center`}
                title={`${user?.name} (${profileConfig.label})`}
              >
                <ProfileIcon className={`w-4 h-4 ${profileConfig.text}`} />
              </div>
            ) : (
              <div className="flex items-center gap-3 bg-gray-800 rounded-xl px-3 py-2.5">
                <div className={`w-9 h-9 ${profileConfig.bg} rounded-full flex items-center justify-center flex-shrink-0`}>
                  <ProfileIcon className={`w-4 h-4 ${profileConfig.text}`} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-white truncate" style={{ fontWeight: 600 }}>{user?.name}</p>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${profileConfig.badge}`}>
                    {profileConfig.label}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Nav ── */}
        <nav className={`flex-1 overflow-y-auto py-3 space-y-0.5 ${sidebarCollapsed ? "px-2" : "px-3"}`}>

          {!sidebarCollapsed && <p className="text-[10px] text-gray-600 uppercase tracking-wider px-3 mb-1.5">ผู้ใช้งาน</p>}


          {/* ── เมนูหลัก section ── */}
          {(isAuthenticated) && (
            <>
              {sidebarCollapsed ? (
                <div className="border-t border-gray-800 my-2" />
              ) : (
                <div className="pt-3 pb-1">
                  <p className="text-[10px] text-gray-600 uppercase tracking-wider px-3">เมนูหลัก</p>
                </div>
              )}

              {/* USER role: inline history */}
              {role === "user" && (
                <>
                  {/* Bots */}
                  <button
                    onClick={() => setActiveView("bots")}
                    title={sidebarCollapsed ? "Bots" : undefined}
                    className={`w-full flex items-center rounded-lg text-sm transition-colors ${
                      sidebarCollapsed ? "justify-center p-2.5" : "gap-3 px-3 py-2.5"
                    } ${
                      activeView === "bots"
                        ? "bg-amber-400 text-gray-900"
                        : "text-gray-400 hover:bg-gray-800 hover:text-white"
                    }`}
                  >
                    <Bot className={`w-4 h-4 flex-shrink-0 ${activeView === "bots" ? "text-gray-900" : "text-gray-500"}`} />
                    {!sidebarCollapsed && <span className="flex-1">Bots</span>}
                  </button>

                  <button
                    onClick={() => setShowHistoryDrawer(true)}
                    title={sidebarCollapsed ? "ประวัติการค้นหา" : undefined}
                    className={`w-full flex items-center rounded-lg text-sm text-gray-400 hover:bg-gray-800 hover:text-white transition-colors ${sidebarCollapsed ? "justify-center p-2.5" : "gap-3 px-3 py-2.5"}`}
                  >
                    <History className="w-4 h-4 flex-shrink-0 text-gray-500" />
                    {!sidebarCollapsed && (
                      <>
                        <span className="flex-1">ประวัติการค้นหา</span>
                        {historyItems.length > 0 && (
                          <span className="text-[10px] bg-amber-400/20 text-amber-400 px-1.5 py-0.5 rounded-full">
                            {historyItems.length}
                          </span>
                        )}
                      </>
                    )}
                  </button>
                  {/* Recent items inline — only when expanded */}
                  {!sidebarCollapsed && historyItems.slice(0, 4).map((item) => (
                    <button
                      key={item.id}
                      onClick={() => handleHistoryClick(item.query)}
                      className="w-full flex items-center gap-2.5 pl-10 pr-3 py-2 rounded-lg text-xs text-gray-500 hover:bg-gray-800 hover:text-gray-300 transition-colors"
                    >
                      <Clock className="w-3 h-3 flex-shrink-0 text-gray-600" />
                      <span className="truncate">{item.query}</span>
                    </button>
                  ))}
                  {!sidebarCollapsed && historyItems.length > 4 && (
                    <button onClick={() => setShowHistoryDrawer(true)} className="pl-10 pr-3 py-1.5 text-[10px] text-amber-400 hover:text-amber-300">
                      ดูทั้งหมด ({historyItems.length}) →
                    </button>
                  )}
                </>
              )}

              {/* SUPPORT role: Unified Chat + history */}
              {role === "support" && (
                <>
                  {supportMenuItems.map((item) => {
                    const Icon   = item.icon;
                    const active = activeView === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => setActiveView(item.id)}
                        title={sidebarCollapsed ? item.label : undefined}
                        className={`w-full flex items-center rounded-lg text-sm transition-colors ${
                          sidebarCollapsed ? "justify-center p-2.5" : "gap-3 px-3 py-2.5"
                        } ${active ? "bg-amber-400 text-gray-900" : "text-gray-400 hover:bg-gray-800 hover:text-white"}`}
                      >
                        <Icon className={`w-4 h-4 flex-shrink-0 ${active ? "text-gray-900" : "text-gray-500"}`} />
                        {!sidebarCollapsed && (
                          <>
                            <span className="flex-1">{item.label}</span>
                            {item.badge && !active && <span className="w-2 h-2 bg-amber-400 rounded-full" />}
                          </>
                        )}
                      </button>
                    );
                  })}
                  <button
                    onClick={() => setShowHistoryDrawer(true)}
                    title={sidebarCollapsed ? "ประวัติการค้นหา" : undefined}
                    className={`w-full flex items-center rounded-lg text-sm text-gray-400 hover:bg-gray-800 hover:text-white transition-colors ${sidebarCollapsed ? "justify-center p-2.5" : "gap-3 px-3 py-2.5"}`}
                  >
                    <History className="w-4 h-4 flex-shrink-0 text-gray-500" />
                    {!sidebarCollapsed && (
                      <>
                        <span className="flex-1">ประวัติการค้นหา</span>
                        {historyItems.length > 0 && (
                          <span className="text-[10px] bg-amber-400/20 text-amber-400 px-1.5 py-0.5 rounded-full">
                            {historyItems.length}
                          </span>
                        )}
                      </>
                    )}
                  </button>
                </>
              )}

              {/* ADMIN role: all menus */}
              {role === "admin" && (
                <>
                  {adminMenuItems.map((item) => {
                    const Icon   = item.icon;
                    const active = activeView === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => setActiveView(item.id)}
                        title={sidebarCollapsed ? item.label : undefined}
                        className={`w-full flex items-center rounded-lg text-sm transition-colors ${
                          sidebarCollapsed ? "justify-center p-2.5" : "gap-3 px-3 py-2.5"
                        } ${active ? "bg-amber-400 text-gray-900" : "text-gray-400 hover:bg-gray-800 hover:text-white"}`}
                      >
                        <Icon className={`w-4 h-4 flex-shrink-0 ${active ? "text-gray-900" : "text-gray-500"}`} />
                        {!sidebarCollapsed && (
                          <>
                            <span className="flex-1">{item.label}</span>
                            {item.badge && !active && <span className="w-2 h-2 bg-amber-400 rounded-full" />}
                          </>
                        )}
                      </button>
                    );
                  })}
                </>
              )}
            </>
          )}
        </nav>

        {/* ── Logout ── */}
        {isAuthenticated && (
          <div className={`border-t border-gray-800 ${sidebarCollapsed ? "px-2 py-3 flex items-center justify-center" : "px-3 py-3"}`}>
            <button
              onClick={handleLogout}
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
  };

  /* ══════════════════════════════════════════════
     Top bar (admin views only)
  ══════════════════════════════════════════════ */
  const renderTopBar = () => (
    <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between flex-shrink-0">
      <div className="flex items-center gap-4 flex-1">
        <p className="text-sm text-gray-500 hidden sm:block">
          scopebot <span className="mx-1.5 text-gray-300">/</span>
          <span className="text-gray-900" style={{ fontWeight: 500 }}>{viewLabels[activeView]}</span>
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
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-amber-400 rounded-full" />
        </button>

        <div className="relative">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-2 hover:bg-gray-100 rounded-lg px-2 py-1.5 transition-colors"
          >
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
              isAdmin ? "bg-amber-400" : isSupport ? "bg-orange-400" : "bg-gray-600"
            }`}>
              {isAdmin
                ? <Crown className="w-4 h-4 text-gray-900" />
                : isSupport
                ? <Headphones className="w-4 h-4 text-white" />
                : <User className="w-4 h-4 text-white" />
              }
            </div>
            <span className="text-sm text-gray-700 hidden sm:block">{user?.name}</span>
            <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
          </button>

          {showUserMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)} />
              <div className="absolute right-0 mt-2 w-52 bg-white rounded-xl shadow-xl border border-gray-100 py-2 z-50">
                <div className="px-4 py-2.5 border-b border-gray-100">
                  <p className="text-sm text-gray-900" style={{ fontWeight: 600 }}>{user?.name}</p>
                  <p className="text-xs text-gray-400">{user?.email}</p>
                </div>
                <button
                  onClick={() => { setShowUserMenu(false); setActiveView("chat"); }}
                  className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-600 hover:bg-amber-50 hover:text-amber-700 transition-colors w-full text-left"
                >
                  <Home className="w-4 h-4" />
                  Home
                </button>
                <button
                  onClick={() => { setShowUserMenu(false); handleLogout(); }}
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

  /* ══════════════════════════════════════════════
     History Drawer
  ══════════════════════════════════════════════ */
  const renderHistoryDrawer = () => (
    <>
      <div
        className={`fixed inset-0 bg-black/30 z-30 transition-opacity duration-300 ${
          showHistoryDrawer ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onClick={() => setShowHistoryDrawer(false)}
      />
      <div
        className={`fixed top-0 right-0 h-full w-80 bg-white shadow-2xl z-40 flex flex-col transform transition-transform duration-300 ease-in-out ${
          showHistoryDrawer ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="bg-gray-900 text-white px-5 py-4 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-amber-400" />
            <span className="text-sm">ประวัติการค้นหา</span>
            {historyItems.length > 0 && (
              <span className="bg-amber-400 text-gray-900 text-[10px] px-1.5 py-0.5 rounded-full">{historyItems.length}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {historyItems.length > 0 && (
              <button
                onClick={() => setHistoryItems([])}
                className="text-gray-400 hover:text-white text-[11px] flex items-center gap-1 hover:bg-white/10 px-2 py-1 rounded-lg transition-colors"
              >
                <Trash2 className="w-3 h-3" /> ล้างทั้งหมด
              </button>
            )}
            <button onClick={() => setShowHistoryDrawer(false)} className="hover:bg-white/10 rounded-full p-1 transition-colors">
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
            {historySearch && <button onClick={() => setHistorySearch("")}><X className="w-3 h-3 text-gray-400" /></button>}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {historyItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 px-6">
              <Clock className="w-10 h-10 mb-3 opacity-40" />
              <p className="text-sm text-center">ยังไม่มีประวัติการค้นหา</p>
              <p className="text-xs text-center mt-1 opacity-70">คำถามที่คุณถามจะปรากฏที่นี่</p>
            </div>
          ) : filteredHistory.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 px-6">
              <Search className="w-8 h-8 mb-2 opacity-40" />
              <p className="text-sm">ไม่พบประวัติที่ค้นหา</p>
            </div>
          ) : (
            <div className="py-2">
              {Object.entries(groupedHistory).map(([label, items]) => (
                <div key={label}>
                  <div className="px-4 py-2 sticky top-0 bg-white">
                    <span className="text-[10px] text-gray-400 uppercase tracking-wider">{label}</span>
                  </div>
                  {items.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => handleHistoryClick(item.query)}
                      className="w-full text-left px-4 py-3 hover:bg-amber-50 transition-colors group flex items-start gap-3 border-b border-gray-50"
                    >
                      <div className="w-7 h-7 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Clock className="w-3.5 h-3.5 text-amber-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-gray-700 line-clamp-2 leading-relaxed">{item.query}</p>
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                          {item.category && (
                            <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${categoryColors[item.category] ?? "bg-gray-100 text-gray-500"}`}>
                              {item.category}
                            </span>
                          )}
                          <span className="text-[9px] text-gray-400">{item.time}</span>
                        </div>
                      </div>
                      <div className="flex-shrink-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => { e.stopPropagation(); setHistoryItems((prev) => prev.filter((h) => h.id !== item.id)); }}
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
            <p className="text-[10px] text-gray-400 text-center">กดที่รายการเพื่อถามคำถามซ้ำอีกครั้ง</p>
          </div>
        )}
      </div>
    </>
  );

  /* ══════════════════════════════════════════════
     Root layout
  ══════════════════════════════════════════════ */
  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">

      {/* ── Sidebar ── */}
      <aside className={`${sidebarCollapsed ? "w-14" : "w-60"} bg-gray-900 flex flex-col flex-shrink-0 transition-all duration-300 ease-in-out overflow-hidden`}>
        {renderSidebar()}
      </aside>

      {/* ── Main ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {activeView !== "chat" && renderTopBar()}
        <main className={`flex-1 ${activeView === "chat" || activeView === "bots" ? "overflow-y-auto" : "overflow-y-auto p-6"}`}>
          {renderContent()}
        </main>
      </div>

      {/* ── History Drawer ── */}
      {renderHistoryDrawer()}
    </div>
  );
}