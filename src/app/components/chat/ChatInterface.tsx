import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "../../contexts/AuthContext";
import {
  AdminScopeProvider,
  useAdminScope,
} from "../../contexts/AdminScopeContext";
import { useChatSession } from "../../hooks/useChatSession";
import {
  resolveNotificationView,
  useNotifications,
} from "../../hooks/useNotifications";
import { useWaitingQueueCount } from "../../hooks/useWaitingQueueCount";
import {
  defaultViewForRole,
  roleCanAccessView,
} from "../../constants/chat";
import type { ActiveView, HistoryItem } from "../../types/chat";
import type { BotItem } from "../../types/bot";
import Dashboard from "../admin/Dashboard";
import Integration from "../admin/Integration";
import SearchHistory from "../admin/SearchHistory";
import UnifiedChat from "../admin/UnifiedChat";
import UserManagement from "../admin/UserManagement";
import BotsPage from "./BotsPage";
import ChatView from "./ChatView";
import ChatSidebar from "./ChatSidebar";
import ChatTopBar from "./ChatTopBar";
import HistoryDrawer from "./HistoryDrawer";

export default function ChatInterface() {
  const { isAdmin } = useAuth();
  return (
    <AdminScopeProvider isAdmin={!!isAdmin}>
      <ChatShell />
    </AdminScopeProvider>
  );
}

function ChatShell() {
  const { user, logout, isAuthenticated, isAdmin, isSupport } = useAuth();
  const { scopeParam } = useAdminScope();
  const navigate = useNavigate();
  const role = user?.role ?? "guest";

  const [showHistoryDrawer, setShowHistoryDrawer] = useState(false);
  const [activeView, setActiveView] = useState<ActiveView>(() =>
    defaultViewForRole(user?.role ?? "user")
  );
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeBot, setActiveBot] = useState<BotItem | null>(null);
  const [forceEditBot, setForceEditBot] = useState<string | null>(null);
  const [forceEditReason, setForceEditReason] = useState<string | null>(null);
  const prevRoleRef = useRef<string | undefined>(undefined);

  const {
    unreadCount: unreadNotifs,
    notifications,
    markRead,
    markAllRead,
    clearAll,
  } = useNotifications(isAuthenticated);
  const waitingQueueCount = useWaitingQueueCount(
    isAuthenticated && !isSupport,
    10000,
    scopeParam
  );
  const [historySearchQuery, setHistorySearchQuery] = useState("");
  const [globalSearchQuery, setGlobalSearchQuery] = useState("");

  const {
    messages,
    inputValue,
    setInputValue,
    isTyping,
    historyItems,
    setHistoryItems,
    messagesEndRef,
    textareaRef,
    chatMode,
    handleSend,
    handleContactStaff,
    handleNewChat,
    resetSessionForBot,
    restoreSession,
  } = useChatSession({
    isAuthenticated,
    activeBot,
    isChatActive: activeView === "chat",
  });

  useEffect(() => {
    if (user?.role !== prevRoleRef.current) {
      prevRoleRef.current = user?.role;
      if (user?.role) setActiveView(defaultViewForRole(user.role));
    }
  }, [user?.role]);

  useEffect(() => {
    if (!user?.role) return;
    if (!roleCanAccessView(user.role, activeView)) {
      setActiveView(defaultViewForRole(user.role));
    }
  }, [user?.role, activeView]);

  const handleHistorySelect = (item: HistoryItem) => {
    setShowHistoryDrawer(false);
    restoreSession(item);
    setActiveView("chat");
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const handleSelectBot = (bot: BotItem) => {
    if (bot.status === "inactive" || bot.status === "processing") {
      setForceEditBot(bot.bot_id);
      setForceEditReason(
        bot.status === "processing"
          ? "บอทกำลังประมวลผลเอกสารอยู่ — รอให้สถานะเป็นพร้อมใช้งานก่อนเข้าแชท หรือตรวจสอบเอกสารด้านล่าง"
          : "บอทยังไม่พร้อมใช้งาน — อัปโหลดหรือตรวจสอบเอกสารฐานความรู้ก่อนเข้าแชท"
      );
      setActiveView("bots");
      return;
    }

    if (activeBot?.bot_id === bot.bot_id) {
      setActiveView("chat");
    } else {
      resetSessionForBot();
      setActiveBot(bot);
      setActiveView("chat");
    }
  };

  const isWelcomeScreen = messages.length === 0 && activeView === "chat";

  const renderContent = () => {
    switch (activeView) {
      case "dashboard":
        return <Dashboard onNavigate={setActiveView} />;
      case "unified-chat":
        return <UnifiedChat />;
      case "search-history":
        return <SearchHistory initialQuery={globalSearchQuery} />;
      case "integration":
        return <Integration />;
      case "user-management":
        return <UserManagement initialQuery={globalSearchQuery} />;
      case "bots":
        return (
          <BotsPage
            onSelectBot={handleSelectBot}
            forceEditBotId={forceEditBot}
            forceEditReason={forceEditReason}
            onClearForceEdit={() => {
              setForceEditBot(null);
              setForceEditReason(null);
            }}
            initialSearch={globalSearchQuery}
          />
        );
      case "chat":
        return (
          <ChatView
            activeBot={activeBot}
            messages={messages}
            inputValue={inputValue}
            isTyping={isTyping}
            isWelcomeScreen={isWelcomeScreen}
            chatMode={chatMode}
            textareaRef={textareaRef}
            messagesEndRef={messagesEndRef}
            onInputChange={setInputValue}
            onSend={handleSend}
            onNewChat={handleNewChat}
            onContactStaff={handleContactStaff}
            onBackToBots={() => setActiveView("bots")}
            onEditBot={() => {
              if (activeBot) {
                setForceEditBot(activeBot.bot_id);
                setActiveView("bots");
              }
            }}
          />
        );
    }
  };

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <aside
        className={`${sidebarCollapsed ? "w-14" : "w-60"} bg-gray-900 flex flex-col flex-shrink-0 transition-all duration-300 ease-in-out overflow-hidden`}
      >
        <ChatSidebar
          activeView={activeView}
          sidebarCollapsed={sidebarCollapsed}
          isAuthenticated={isAuthenticated}
          isAdmin={isAdmin}
          isSupport={isSupport}
          role={role}
          userName={user?.name}
          unreadCount={waitingQueueCount}
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
          onViewChange={setActiveView}
          onLogout={handleLogout}
        />
      </aside>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <ChatTopBar
          activeView={activeView}
          userName={user?.name}
          userEmail={user?.email}
          isAdmin={isAdmin}
          isSupport={isSupport}
          unreadNotifs={unreadNotifs}
          notifications={notifications}
          searchPlaceholder={
            isSupport ? "ค้นหาผู้ใช้งาน..." : "ค้นหาบอทหรือประวัติ..."
          }
          hideSearch={activeView === "chat"}
          onMarkRead={markRead}
          onMarkAllRead={markAllRead}
          onClearNotifications={clearAll}
          onNotificationClick={(n) => {
            if (isSupport) {
              setActiveView("user-management");
              return;
            }
            const target = resolveNotificationView(n);
            if (target === "unified-chat") {
              setActiveView("unified-chat");
            } else if (target === "dashboard") {
              setActiveView("dashboard");
            } else {
              setActiveView("bots");
            }
          }}
          onSearch={(query) => {
            setGlobalSearchQuery(query);
            if (isSupport) {
              setActiveView("user-management");
            } else if (activeView === "user-management") {
              setActiveView("user-management");
            } else if (activeView === "bots") {
              setActiveView("bots");
            } else {
              setActiveView("search-history");
              setHistorySearchQuery(query);
            }
          }}
          onNavigateBots={() => setActiveView("bots")}
          onLogout={handleLogout}
        />
        <main
          className={`flex-1 ${activeView === "chat" || activeView === "bots" ? "overflow-y-auto" : "overflow-y-auto p-6"}`}
        >
          {renderContent()}
        </main>
      </div>

      <HistoryDrawer
        open={showHistoryDrawer}
        historyItems={historyItems}
        initialSearch={historySearchQuery}
        onClose={() => setShowHistoryDrawer(false)}
        onSelect={handleHistorySelect}
        onClearAll={() => setHistoryItems([])}
        onRemoveItem={(id) =>
          setHistoryItems((prev) => prev.filter((h) => h.id !== id))
        }
      />
    </div>
  );
}
