import { apiFetch } from "./api";
import type { BotDocument, BotItem } from "../types/bot";

export interface BotPayload {
  name?: string;
  description?: string;
  system_prompt?: string;
  line_channel_token?: string;
  line_channel_secret?: string;
}

export async function fetchBots(scope?: "all" | "mine"): Promise<BotItem[]> {
  const q = scope ? `?scope=${encodeURIComponent(scope)}` : "";
  return apiFetch<BotItem[]>(`/api/bots/${q}`);
}

export async function fetchBot(botId: string): Promise<BotItem> {
  return apiFetch<BotItem>(`/api/bots/${botId}`);
}

export async function fetchBotDocuments(botId: string): Promise<BotDocument[]> {
  return apiFetch<BotDocument[]>(`/api/bots/${botId}/documents`);
}

export async function createBot(payload: BotPayload): Promise<BotItem> {
  return apiFetch<BotItem>("/api/bots/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateBot(
  botId: string,
  payload: BotPayload
): Promise<BotItem> {
  return apiFetch<BotItem>(`/api/bots/${botId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function deleteBot(botId: string): Promise<void> {
  await apiFetch(`/api/bots/${botId}`, { method: "DELETE" });
}

export async function reindexBot(botId: string): Promise<void> {
  await apiFetch(`/api/bots/${botId}/reindex`, { method: "POST" });
}

export async function toggleBotLine(botId: string): Promise<boolean> {
  const data = await apiFetch<{ is_line_connected: boolean }>(
    `/api/bots/${botId}/toggle-line`,
    { method: "POST" }
  );
  return data.is_line_connected;
}

export async function toggleBotWeb(botId: string): Promise<boolean> {
  const data = await apiFetch<{ is_web_connected: boolean }>(
    `/api/bots/${botId}/toggle-web`,
    { method: "POST" }
  );
  return data.is_web_connected;
}
