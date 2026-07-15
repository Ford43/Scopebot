import { apiFetch } from "./api";
import type { BotDocument, BotItem } from "../types/bot";

export interface BotPayload {
  name: string;
  description: string;
  system_prompt: string;
}

export async function fetchBots(): Promise<BotItem[]> {
  return apiFetch<BotItem[]>("/api/bots/");
}

export async function fetchBot(botId: string): Promise<BotItem> {
  return apiFetch<BotItem>(`/api/bots/${botId}`);
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

export async function fetchBotDocuments(botId: string): Promise<BotDocument[]> {
  return apiFetch<BotDocument[]>(`/api/bots/${botId}/documents`);
}
