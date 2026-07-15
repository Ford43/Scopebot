import type { ComponentType } from "react";

export type ActiveView =
  | "dashboard"
  | "unified-chat"
  | "search-history"
  | "integration"
  | "chat"
  | "bots"
  | "user-management";

export interface ChatMessage {
  id: string;
  sender: "bot" | "user";
  text: string;
  time: string;
  confidence?: number;
  category?: string;
}

export interface HistoryItem {
  id: string;
  query: string;
  category?: string;
  time: string;
  timestamp: number;
}

export interface MenuItem {
  id: ActiveView;
  label: string;
  icon: ComponentType<{ className?: string }>;
  badge?: boolean;
}
