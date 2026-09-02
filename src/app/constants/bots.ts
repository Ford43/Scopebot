export const BOT_AVATAR_COLOURS = [
  "bg-amber-400",
  "bg-orange-400",
  "bg-sky-400",
  "bg-emerald-400",
  "bg-violet-400",
] as const;

/** Must match api/routers/documents.py ALLOWED_EXTENSIONS */
export const ALLOWED_DOC_EXTENSIONS = [
  ".pdf",
  ".txt",
  ".docx",
  ".csv",
  ".json",
  ".html",
  ".md",
] as const;

export const ALLOWED_DOC_ACCEPT = ALLOWED_DOC_EXTENSIONS.join(",");

export const MAX_DOC_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

export const ALLOWED_DOC_LABEL =
  "PDF, DOCX, CSV, TXT, JSON, HTML, MD (สูงสุด 10 MB / ไฟล์)";

/** หมวดหมู่เอกสาร — ใช้กรอง/ค้นหาเมื่อบอทมีหลายไฟล์ */
export const DOC_CATEGORIES = [
  "ทั่วไป",
  "นโยบาย",
  "ระเบียบ",
  "คู่มือ",
  "FAQ",
  "สินค้า",
  "อื่นๆ",
] as const;

export function botAvatarColour(index: number): string {
  return BOT_AVATAR_COLOURS[index % BOT_AVATAR_COLOURS.length];
}

export function isAllowedDocFile(file: File): string | null {
  const name = file.name.toLowerCase();
  const ext = name.includes(".") ? `.${name.split(".").pop()}` : "";
  if (!(ALLOWED_DOC_EXTENSIONS as readonly string[]).includes(ext)) {
    return `ไฟล์ประเภท ${ext || "(ไม่มีนามสกุล)"} ไม่รองรับ (รองรับ: ${ALLOWED_DOC_LABEL})`;
  }
  if (file.size > MAX_DOC_SIZE_BYTES) {
    const mb = (file.size / (1024 * 1024)).toFixed(1);
    return `ไฟล์ใหญ่เกิน 10 MB (ขนาดปัจจุบัน ${mb} MB)`;
  }
  return null;
}
