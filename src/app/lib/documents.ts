import { apiFetch, authHeaders } from "./api";
import type { BotDocument } from "../types/bot";

export async function uploadDocument(
  file: File,
  category = "ทั่วไป"
): Promise<BotDocument> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("category", category);

  const res = await fetch("/api/documents/upload", {
    method: "POST",
    headers: authHeaders(),
    body: formData,
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(
      typeof data?.detail === "string" ? data.detail : "อัปโหลดไม่สำเร็จ"
    );
  }
  return data;
}

export async function assignDocumentToBot(
  docId: number,
  botId: string
): Promise<void> {
  await apiFetch(`/api/documents/${docId}/assign/${botId}`, { method: "POST" });
}

export async function deleteDocument(docId: number): Promise<void> {
  await apiFetch(`/api/documents/${docId}`, { method: "DELETE" });
}
