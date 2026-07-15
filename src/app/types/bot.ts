export interface BotDocument {
  id: number;
  filename: string;
  file_size: number;
  category: string;
  uploaded_at: string;
  status?: "ready" | "processing" | "error";
}

export interface BotItem {
  id: number;
  bot_id: string;
  name: string;
  description: string;
  status: string;
  system_prompt?: string;
  created_at: string;
  documents?: BotDocument[];
}
