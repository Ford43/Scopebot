export interface BotDocument {
  id: number;
  filename: string;
  file_size: number;
  category: string;
  uploaded_at: string;
  status?: "ready" | "processing" | "error";
  assigned_bots?: string[];
}

export interface BotItem {
  id: number;
  bot_id: string;
  name: string;
  description: string;
  status: string;
  system_prompt?: string;
  is_line_connected?: boolean;
  is_web_connected?: boolean;
  owner_id?: number;
  created_at: string;
  documents?: BotDocument[];
}
