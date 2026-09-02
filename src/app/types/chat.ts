import type { ComponentType } from "react";

export type ActiveView =
  | "dashboard"
  | "unified-chat"
  | "search-history"
  | "integration"
  | "chat"
  | "bots"
  | "user-management";

export interface ChatSource {
  filename: string;
  snippet?: string;
}

export type ChatMode = "bot" | "waiting" | "human";

export interface ChatMessage {
  id: string;
  sender: "bot" | "user" | "staff";
  text: string;
  time: string;
  confidence?: number;
  category?: string;
  sources?: ChatSource[];
  offerHandoff?: boolean;
  senderName?: string;
}

export interface HistoryItem {
  id: string;
  query: string;
  category?: string;
  time: string;
  timestamp: number;
  sessionId?: string;
  botId?: string;
  messages?: ChatMessage[];
}

export interface MenuItem {
  id: ActiveView;
  label: string;
  icon: ComponentType<{ className?: string }>;
  /** Show unread badge when count > 0 (wired from notifications) */
  showUnreadBadge?: boolean;
}
