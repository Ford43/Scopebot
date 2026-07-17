import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "../../contexts/AuthContext";
import { useChatSession } from "../../hooks/useChatSession";
import { useNotifications } from "../../hooks/useNotifications";
import type { ActiveView } from "../../types/chat";
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
  const [showHistoryDrawer, setShowHistoryDrawer] = useState(false);
  const [activeView, setActiveView] = useState<ActiveView>("bots");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeBot, setActiveBot] = useState<BotItem | null>(null);
  const [forceEditBot, setForceEditBot] = useState<string | null>(null);

  const prevRoleRef = useRef<string | undefined>(undefined);
  const { user, logout, isAuthenticated, isAdmin, isSupport } = useAuth();
  const navigate = useNavigate();
  const role = user?.role ?? "guest";

  const {
    unreadCount: unreadNotifs,
    notifications,
    markRead,
    markAllRead,
  } = useNotifications(isAuthenticated);
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
    handleSend,
    handleNewChat,
    resetSessionForBot,
  } = useChatSession({
    isAuthenticated,
    activeBot,
    isChatActive: activeView === "chat",
  });

  useEffect(() => {
    if (user?.role !== prevRoleRef.current) {
      prevRoleRef.current = user?.role;
      if (user?.role === "admin") setActiveView("dashboard");
      else if (user?.role === "support") setActiveView("unified-chat");
      else setActiveView("bots");
    }
  }, [user?.role]);

  const handleHistoryClick = (query: string) => {
    setShowHistoryDrawer(false);
    setActiveView("chat");
    setTimeout(() => handleSend(query), 150);
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const handleSelectBot = (bot: BotItem) => {
    if (bot.status === "inactive" || bot.status === "processing") {
      alert(
        bot.status === "processing"
          ? "บอทกำลังประมวลผลเอกสารอยู่ กรุณารอให้สถานะเป็นพร้อมใช้งานก่อนเข้าแชท"
          : "ไม่สามารถเข้าหน้าแชทได้: บอทตัวนี้ยังไม่มีฐานความรู้ หรือยังไม่ได้ตั้งค่าเอกสาร"
      );
      setForceEditBot(bot.bot_id);
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
        return <Dashboard />;
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
            onClearForceEdit={() => setForceEditBot(null)}
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
            isAuthenticated={isAuthenticated}
            isWelcomeScreen={isWelcomeScreen}
            textareaRef={textareaRef}
            messagesEndRef={messagesEndRef}
            onInputChange={setInputValue}
            onSend={handleSend}
            onNewChat={handleNewChat}
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
          historyItems={historyItems}
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
          onViewChange={setActiveView}
          onShowHistory={() => setShowHistoryDrawer(true)}
          onHistoryClick={handleHistoryClick}
          onLogout={handleLogout}
        />
      </aside>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {activeView !== "chat" && (
          <ChatTopBar
            activeView={activeView}
            userName={user?.name}
            userEmail={user?.email}
            isAdmin={isAdmin}
            isSupport={isSupport}
            unreadNotifs={unreadNotifs}
            notifications={notifications}
            onMarkRead={markRead}
            onMarkAllRead={markAllRead}
            onSearch={(query) => {
              setGlobalSearchQuery(query);
              if (isAdmin || isSupport) {
                if (activeView === "user-management") {
                  setActiveView("user-management");
                } else if (activeView === "bots") {
                  setActiveView("bots");
                } else {
                  setActiveView("search-history");
                }
              } else {
                setHistorySearchQuery(query);
                setShowHistoryDrawer(true);
              }
            }}
            onNavigateBots={() => setActiveView("bots")}
            onLogout={handleLogout}
          />
        )}
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
        onSelect={handleHistoryClick}
        onClearAll={() => setHistoryItems([])}
        onRemoveItem={(id) =>
          setHistoryItems((prev) => prev.filter((h) => h.id !== id))
        }
      />
    </div>
  );
}
