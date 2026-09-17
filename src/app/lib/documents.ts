import { apiFetch, authHeaders } from "./api";
import type { BotDocument } from "../types/bot";

export async function fetchLibraryDocuments(): Promise<BotDocument[]> {
  return apiFetch<BotDocument[]>("/api/documents/");
}

export async function uploadDocument(
  file: File,
  category = "ทั่วไป",
  confirmReplace?: (filename: string, assignedBots: string[]) => boolean | Promise<boolean>
): Promise<BotDocument | null> {
  const submit = async (replaceExisting: boolean) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("category", (category || "ทั่วไป").trim() || "ทั่วไป");
    formData.append("replace_existing", String(replaceExisting));
    const res = await fetch("/api/documents/upload", {
      method: "POST", headers: authHeaders(), body: formData,
    });
    return { res, data: await res.json() };
  };

  let { res, data } = await submit(false);
  if (res.status === 409 && data?.detail?.code === "document_exists" && confirmReplace) {
    const approved = await confirmReplace(file.name, data.detail.assigned_bots || []);
    if (!approved) return null;
    ({ res, data } = await submit(true));
  }
  if (!res.ok) {
    throw new Error(
      typeof data?.detail === "string" ? data.detail : data?.detail?.message || "อัปโหลดไม่สำเร็จ"
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

export async function unassignDocumentFromBot(
  docId: number,
  botId: string
): Promise<void> {
  await apiFetch(`/api/documents/${docId}/unassign/${botId}`, {
    method: "DELETE",
  });
}

export async function updateDocumentCategory(
  docId: number,
  category: string
): Promise<BotDocument> {
  return apiFetch<BotDocument>(`/api/documents/${docId}`, {
    method: "PATCH",
    body: JSON.stringify({ category }),
  });
}
