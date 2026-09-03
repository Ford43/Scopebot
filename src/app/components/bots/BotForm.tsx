import { useState, useEffect, useRef, useCallback } from "react";
import {
  Search,
  ArrowLeft,
  Bot,
  Trash2,
  Upload,
  FileText,
  Clock,
  Tag,
} from "lucide-react";
import { toast } from "sonner";
import type { BotDocument, BotItem } from "../../types/bot";
import {
  createBot,
  deleteBot,
  fetchBot,
  fetchBotDocuments,
  reindexBot,
  updateBot,
} from "../../lib/bots";
import {
  assignDocumentToBot,
  unassignDocumentFromBot,
  uploadDocument,
  updateDocumentCategory,
} from "../../lib/documents";
import {
  ALLOWED_DOC_ACCEPT,
  ALLOWED_DOC_LABEL,
  DOC_CATEGORIES,
  isAllowedDocFile,
} from "../../constants/bots";
import { formatBytes } from "../../utils/format";
import { BotStatusBadge } from "./BotStatusBadge";
import { BotFileIcon } from "./BotFileIcon";

interface BotFormProps {
  existing?: BotItem;
  onBack: () => void;
  /** Called after save/delete. leave=true returns to list (e.g. after delete). */
  onSaveSuccess: (options?: { leave?: boolean }) => void;
  /** Inline notice when redirected here (e.g. inactive bot can't chat yet) */
  statusNotice?: string | null;
  onDismissNotice?: () => void;
}

function docBadgeStatus(
  botStatus: string,
  isNewBot: boolean
): "pending" | "processing" | "ready" | "inactive" {
  if (isNewBot) return "pending";
  if (botStatus === "processing") return "processing";
  if (botStatus === "active") return "ready";
  return "inactive";
}

export default function BotForm({
  existing,
  onBack,
  onSaveSuccess,
  statusNotice,
  onDismissNotice,
}: BotFormProps) {
  const [currentBot, setCurrentBot] = useState<BotItem | undefined>(existing);
  const [activeTab, setActiveTab] = useState<"general" | "knowledge">(
    existing ? "general" : "knowledge"
  );
  const [name, setName] = useState(existing?.name ?? "");
  const [desc, setDesc] = useState(existing?.description ?? "");
  const [systemPrompt, setSystemPrompt] = useState(existing?.system_prompt ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [docs, setDocs] = useState<BotDocument[]>([]);
  const [docSearch, setDocSearch] = useState("");
  const [uploadCategory, setUploadCategory] = useState("ทั่วไป");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [customCategory, setCustomCategory] = useState("");
  const [dragging, setDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [botStatus, setBotStatus] = useState<string>(
    existing?.status || "inactive"
  );
  const [processingStuck, setProcessingStuck] = useState(false);
  const prevStatusRef = useRef<string>(existing?.status || "inactive");

  const isNewBot = !currentBot;
  const isProcessing = botStatus === "processing" && !processingStuck;
  const canCreate = !!name.trim() && docs.length > 0;
  const canSave =
    !isSaving &&
    !isUploading &&
    !isProcessing &&
    (isNewBot ? canCreate : !!name.trim());

  const fetchDocs = useCallback(async () => {
    if (!currentBot?.bot_id) return;
    try {
      const data = await fetchBotDocuments(currentBot.bot_id);
      setDocs(data);
    } catch (error) {
      console.error("Failed to fetch documents", error);
    }
  }, [currentBot?.bot_id]);

  useEffect(() => {
    if (currentBot) fetchDocs();
  }, [currentBot, fetchDocs]);

  // Sync status from server on mount / when editing existing bot
  useEffect(() => {
    if (!currentBot?.bot_id) return;
    let cancelled = false;

    const sync = async () => {
      try {
        const data = await fetchBot(currentBot.bot_id);
        if (!cancelled) setBotStatus(data.status);
      } catch (error) {
        console.error("Initial status sync error:", error);
      }
    };
    sync();
    return () => {
      cancelled = true;
    };
  }, [currentBot?.bot_id]);

  useEffect(() => {
    if (!currentBot?.bot_id) return;
    if (botStatus !== "processing") return;

    const checkBotStatus = async () => {
      try {
        const data = await fetchBot(currentBot.bot_id);
        setBotStatus(data.status);
        if (data.status !== "processing") {
          fetchDocs();
        }
      } catch (error) {
        console.error("Check status error:", error);
      }
    };

    checkBotStatus();
    const interval = setInterval(checkBotStatus, 2000);
    const stuckTimer = setTimeout(() => setProcessingStuck(true), 90000);
    return () => {
      clearInterval(interval);
      clearTimeout(stuckTimer);
    };
  }, [currentBot?.bot_id, botStatus, fetchDocs]);

  // Toast when ingest finishes
  useEffect(() => {
    const prev = prevStatusRef.current;
    if (prev === "processing" && botStatus === "active") {
      setProcessingStuck(false);
      toast.success("บอทพร้อมใช้งานแล้ว", {
        description: "ฐานความรู้ประมวลผลเสร็จ สามารถเข้าแชทได้",
      });
    } else if (prev === "processing" && botStatus === "inactive") {
      setProcessingStuck(false);
      toast.error("ประมวลผลเอกสารไม่สำเร็จ", {
        description: "บอทยังไม่พร้อมใช้งาน — ตรวจสอบเอกสารแล้วลองใหม่",
      });
    }
    prevStatusRef.current = botStatus;
  }, [botStatus]);

  const usedCategories = Array.from(
    new Set(docs.map((d) => d.category || "ทั่วไป"))
  );
  const categoryOptions = Array.from(
    new Set([...DOC_CATEGORIES, ...usedCategories])
  );
  const resolvedUploadCategory =
    uploadCategory === "__custom__"
      ? customCategory.trim() || "ทั่วไป"
      : uploadCategory;

  const filteredDocs = docs.filter((d) => {
    const q = docSearch.trim().toLowerCase();
    const cat = d.category || "ทั่วไป";
    const matchSearch =
      !q ||
      d.filename.toLowerCase().includes(q) ||
      cat.toLowerCase().includes(q);
    const matchCat = categoryFilter === "all" || cat === categoryFilter;
    return matchSearch && matchCat;
  });

  const validate = () => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = "กรุณากรอกชื่อบอท";
    if (isNewBot && docs.length === 0) {
      e.docs = "กรุณาอัปโหลดเอกสารอย่างน้อย 1 ไฟล์ก่อนสร้างบอท";
    }
    setErrors(e);
    if (e.name) setActiveTab("general");
    else if (e.docs) setActiveTab("knowledge");
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (isProcessing) return;
    if (!validate()) return;
    setIsSaving(true);
    try {
      const payload = {
        name: name.trim(),
        description: desc.trim(),
        system_prompt: systemPrompt.trim(),
      };

      const wasNew = !currentBot;
      const savedBot = currentBot
        ? await updateBot(currentBot.bot_id, payload)
        : await createBot(payload);

      if (wasNew && docs.length > 0) {
        for (const doc of docs) {
          await assignDocumentToBot(doc.id, savedBot.bot_id);
        }
        setCurrentBot(savedBot);
        setBotStatus("processing");
        prevStatusRef.current = "processing";
        toast.success("สร้างบอทแล้ว", {
          description: "กำลังประมวลผลเอกสาร — ดูสถานะได้ที่หน้าจัดการบอท",
        });
      } else {
        setCurrentBot(savedBot);
        toast.success("บันทึกการตั้งค่าเรียบร้อย");
      }
      onSaveSuccess({ leave: true });
    } catch (error) {
      console.error("Save bot error:", error);
      toast.error(error instanceof Error ? error.message : "บันทึกไม่สำเร็จ");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteBot = async () => {
    if (!currentBot?.bot_id) return;
    if (
      !window.confirm(
        "คุณแน่ใจหรือไม่ว่าต้องการลบบอทนี้? ข้อมูลและเอกสารจะถูกลบทั้งหมด"
      )
    )
      return;

    try {
      await deleteBot(currentBot.bot_id);
      toast.success("ลบบอทเรียบร้อย");
      onSaveSuccess({ leave: true });
    } catch (error) {
      console.error("Delete bot error:", error);
      toast.error(error instanceof Error ? error.message : "ลบบอทไม่สำเร็จ");
    }
  };

  const addFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    if (isProcessing) return;
    setIsUploading(true);
    setErrors((p) => ({ ...p, docs: "" }));

    let bot = currentBot;
    if (!bot && name.trim()) {
      try {
        bot = await createBot({
          name: name.trim(),
          description: desc.trim(),
          system_prompt: systemPrompt.trim(),
        });
        setCurrentBot(bot);
        onSaveSuccess({ leave: false });
        toast.success("สร้างบอทแล้ว", {
          description: "กำลังอัปโหลดเอกสารเข้าฐานความรู้",
        });
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "สร้างบอทไม่สำเร็จ — จะอัปโหลดไฟล์ไว้ก่อน แล้วกดสร้างบอทอีกครั้ง"
        );
      }
    }

    let assignedAny = false;

    for (const file of Array.from(files)) {
      const validationError = isAllowedDocFile(file);
      if (validationError) {
        toast.error(validationError);
        continue;
      }

      try {
        const docData = await uploadDocument(file, resolvedUploadCategory);

        if (bot?.bot_id) {
          await assignDocumentToBot(docData.id, bot.bot_id);
          assignedAny = true;
          toast.success(`อัปโหลด ${file.name} แล้ว`, {
            description: `หมวดหมู่: ${docData.category || resolvedUploadCategory} — กำลังประมวลผล`,
          });
        } else {
          setDocs((prev) => {
            if (prev.some((d) => d.id === docData.id)) {
              toast.message(`ใช้ไฟล์ที่มีอยู่แล้ว: ${file.name}`);
              return prev;
            }
            return [...prev, docData];
          });
          toast.success(`อัปโหลด ${file.name} แล้ว`, {
            description: name.trim()
              ? undefined
              : "กรอกชื่อบอทแล้วกดสร้างบอท เพื่อเริ่มประมวลผลฐานความรู้",
          });
        }
      } catch (error) {
        console.error("File processing error", error);
        toast.error(
          error instanceof Error
            ? error.message
            : `อัปโหลดไฟล์ ${file.name} ไม่สำเร็จ`
        );
      }
    }

    if (bot?.bot_id && assignedAny) {
      setProcessingStuck(false);
      setBotStatus("processing");
      prevStatusRef.current = "processing";
      await fetchDocs();
    }
    setIsUploading(false);
  };

  const handleCategoryChange = async (docId: number, category: string) => {
    const next = category.trim().slice(0, 40) || "ทั่วไป";
    setDocs((prev) =>
      prev.map((d) => (d.id === docId ? { ...d, category: next } : d))
    );
    try {
      await updateDocumentCategory(docId, next);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "เปลี่ยนหมวดหมู่ไม่สำเร็จ"
      );
      fetchDocs();
    }
  };

  const handleReindex = async () => {
    if (!currentBot?.bot_id) return;
    try {
      setProcessingStuck(false);
      setBotStatus("processing");
      prevStatusRef.current = "processing";
      await reindexBot(currentBot.bot_id);
      toast.success("เริ่มประมวลผลเอกสารใหม่แล้ว");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "เริ่มประมวลผลใหม่ไม่สำเร็จ"
      );
    }
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!isProcessing) setDragging(true);
  };
  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
  };
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (!isProcessing) addFiles(e.dataTransfer.files);
  };

  const handleDeleteDoc = async (docId: number) => {
    if (isNewBot) {
      setDocs((prev) => prev.filter((d) => d.id !== docId));
      return;
    }
    if (!currentBot?.bot_id) return;
    if (
      !window.confirm(
        "ต้องการถอดเอกสารนี้ออกจากบอทใช่หรือไม่? (ไฟล์ยังอยู่ใน Library)"
      )
    )
      return;

    try {
      await unassignDocumentFromBot(docId, currentBot.bot_id);
      toast.success("ถอดเอกสารออกจากบอทแล้ว");
      fetchDocs();
    } catch (error) {
      console.error("Unassign doc error:", error);
      toast.error(
        error instanceof Error ? error.message : "ถอดเอกสารไม่สำเร็จ"
      );
    }
  };

  const saveButtonLabel = () => {
    if (isSaving) return "กำลังบันทึก...";
    if (isProcessing) return "กำลังประมวลผลเอกสาร...";
    if (isUploading) return "กำลังอัปโหลด...";
    if (currentBot) return "บันทึกการตั้งค่า";
    return "สร้างบอท";
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-white">
      {statusNotice && (
        <div className="mx-4 sm:mx-8 mt-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <span className="flex-1 leading-relaxed">{statusNotice}</span>
          {onDismissNotice && (
            <button
              type="button"
              onClick={onDismissNotice}
              className="text-amber-700/70 hover:text-amber-900 flex-shrink-0"
              aria-label="ปิดการแจ้งเตือน"
            >
              ×
            </button>
          )}
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-8 py-4 border-b border-gray-100 flex-shrink-0 sticky top-0 bg-white z-20">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          กลับไปจัดการบอท
        </button>
        <div className="flex items-center gap-3">
          {isNewBot && docs.length === 0 && (
            <p className="text-xs text-amber-700 hidden sm:block">
              อัปโหลดเอกสารอย่างน้อย 1 ไฟล์ก่อนสร้างบอท
            </p>
          )}
          <button
            onClick={handleSave}
            disabled={!canSave}
            title={
              isNewBot && docs.length === 0
                ? "กรุณาอัปโหลดเอกสารอย่างน้อย 1 ไฟล์"
                : isProcessing
                  ? "รอระบบประมวลผลเอกสารให้เสร็จก่อน"
                  : undefined
            }
            className="px-4 sm:px-6 py-2 rounded-xl bg-amber-400 hover:bg-amber-500 text-gray-900 text-sm transition-colors shadow-sm shadow-amber-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-amber-400"
            style={{ fontWeight: 600 }}
          >
            {saveButtonLabel()}
          </button>
        </div>
      </div>

      <div className="flex-1 px-4 sm:px-8 py-6 max-w-4xl w-full mx-auto">
        <div className="flex items-center gap-4 sm:gap-5 mb-8">
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-3xl bg-amber-100 flex items-center justify-center shadow-sm flex-shrink-0">
            <Bot className="w-8 h-8 sm:w-10 sm:h-10 text-amber-500" />
          </div>
          <div className="flex-1 min-w-0">
            <h1
              className="text-2xl text-gray-900 truncate"
              style={{ fontWeight: 700 }}
            >
              {name || "บอทใหม่ยังไม่มีชื่อ"}
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              ID: {currentBot?.bot_id ?? "จะถูกสร้างอัตโนมัติ"}
            </p>
            {currentBot && <BotStatusBadge status={botStatus} />}
          </div>
        </div>

        <div className="flex gap-6 border-b border-gray-200 mb-8">
          {(["general", "knowledge"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`pb-3 text-sm transition-colors relative flex items-center gap-2 ${
                activeTab === tab
                  ? "text-amber-600 font-semibold"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab === "general" ? "ตั้งค่าทั่วไป" : "ฐานความรู้ (เอกสาร)"}
              {tab === "knowledge" && (
                <span
                  className={`px-2 py-0.5 rounded-md text-[10px] ${
                    isNewBot && docs.length === 0
                      ? "bg-amber-100 text-amber-700"
                      : "bg-gray-100 text-gray-600"
                  }`}
                >
                  {docs.length}
                </span>
              )}
              {activeTab === tab && (
                <span className="absolute bottom-0 left-0 w-full h-0.5 bg-amber-400 rounded-t-full" />
              )}
            </button>
          ))}
        </div>

        {activeTab === "general" && (
          <div className="space-y-6 max-w-2xl">
            <div>
              <label
                className="block text-sm text-gray-800 mb-2"
                style={{ fontWeight: 600 }}
              >
                ชื่อบอท (Bot Name)
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setErrors((p) => ({ ...p, name: "" }));
                }}
                placeholder="เช่น บอทฝ่ายบุคคล, บอทตอบลูกค้า"
                className={`w-full border rounded-xl px-4 py-3 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-amber-400 transition-colors ${errors.name ? "border-red-400" : "border-gray-200"}`}
              />
              {errors.name && (
                <p className="text-xs text-red-500 mt-1">{errors.name}</p>
              )}
            </div>

            <div>
              <label
                className="block text-sm text-gray-800 mb-2"
                style={{ fontWeight: 600 }}
              >
                คำอธิบาย (Description)
              </label>
              <textarea
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                placeholder="อธิบายสั้นๆ ว่าบอทตัวนี้ทำหน้าที่อะไร..."
                rows={3}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 outline-none focus:ring-2 focus:ring-amber-400 resize-none bg-gray-50"
              />
            </div>

            <div className="pt-2">
              <label
                className="block text-sm text-gray-800 mb-2"
                style={{ fontWeight: 600 }}
              >
                System Prompt (พฤติกรรมบอท)
              </label>
              <p className="text-xs text-gray-500 mb-2">
                กำหนดบุคลิก กฎเกณฑ์ หรือวิธีการตอบของบอทตัวนี้
                (ปล่อยว่างไว้หากต้องการใช้ค่าเริ่มต้น)
              </p>
              <textarea
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                placeholder="ตัวอย่าง: คุณคือผู้ช่วยฝ่ายบุคคลของบริษัท..."
                rows={5}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 outline-none focus:ring-2 focus:ring-amber-400 bg-white font-mono"
              />
            </div>

            {isNewBot && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
                กรอกชื่อบอท แล้วไปที่แท็บ{" "}
                <button
                  type="button"
                  onClick={() => setActiveTab("knowledge")}
                  className="underline font-semibold"
                >
                  ฐานความรู้ (เอกสาร)
                </button>{" "}
                เพื่อเพิ่มไฟล์
              </div>
            )}

            {currentBot && (
              <div className="pt-8 mt-6 border-t border-red-100 flex flex-col items-center">
                <button
                  onClick={handleDeleteBot}
                  disabled={isUploading || isSaving}
                  className="flex items-center gap-2 px-4 py-2.5 text-sm text-red-600 bg-red-50 hover:bg-red-100 rounded-xl transition-colors border border-red-200 font-medium disabled:opacity-50"
                >
                  <Trash2 className="w-4 h-4" />
                  ลบบอท
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === "knowledge" && (
          <div className="space-y-6">
            {errors.docs && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
                {errors.docs}
              </div>
            )}

            {isProcessing && (
              <div className="bg-amber-50 border border-amber-200 text-amber-700 px-4 py-3 rounded-xl flex items-center gap-3">
                <Clock className="w-5 h-5 animate-spin text-amber-500 flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold">
                    กำลังประมวลผลเอกสาร...
                  </p>
                  <p className="text-xs opacity-80">
                    ระบบกำลังหั่นเอกสารและสร้างฐานความรู้ — สถานะจะเปลี่ยนเป็น
                    “พร้อมใช้งาน” เมื่อเสร็จ
                  </p>
                </div>
              </div>
            )}

            {processingStuck && botStatus === "processing" && (
              <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-xl flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex-1">
                  <p className="text-sm font-semibold">ประมวลผลเอกสารค้างอยู่</p>
                  <p className="text-xs opacity-80 mt-0.5">
                    มักเกิดจากไฟล์ที่อ่านไม่ได้หรือโมเดลใช้เวลานาน — ลองใหม่ หรือลบบอทนี้แล้วสร้างใหม่
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    type="button"
                    onClick={handleReindex}
                    className="px-3 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold"
                  >
                    ลองประมวลผลใหม่
                  </button>
                  <button
                    type="button"
                    onClick={handleDeleteBot}
                    className="px-3 py-2 rounded-lg border border-red-200 bg-white hover:bg-red-50 text-red-700 text-xs font-semibold"
                  >
                    ลบบอท
                  </button>
                </div>
              </div>
            )}

            {isNewBot && (
              <div className="space-y-2">
                <label
                  className="block text-sm text-gray-800"
                  style={{ fontWeight: 600 }}
                >
                  ชื่อบอท
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    setErrors((p) => ({ ...p, name: "" }));
                  }}
                  placeholder="เช่น บอทตอบลูกค้า"
                  className={`w-full border rounded-xl px-4 py-3 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-amber-400 ${errors.name ? "border-red-400" : "border-gray-200"}`}
                />
              </div>
            )}

            <div className="flex flex-col sm:flex-row sm:items-end gap-3">
              <div className="flex-1">
                <label
                  className="flex items-center gap-1.5 text-sm text-gray-800 mb-2"
                  style={{ fontWeight: 600 }}
                >
                  <Tag className="w-3.5 h-3.5 text-amber-500" />
                  หมวดหมู่ไฟล์ที่อัปโหลด
                </label>
                <select
                  value={uploadCategory}
                  onChange={(e) => setUploadCategory(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white outline-none focus:ring-2 focus:ring-amber-400"
                >
                  {categoryOptions.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                  <option value="__custom__">กำหนดเอง...</option>
                </select>
              </div>
              {uploadCategory === "__custom__" && (
                <input
                  type="text"
                  value={customCategory}
                  onChange={(e) => setCustomCategory(e.target.value)}
                  placeholder="เช่น สัญญา, ราคา"
                  maxLength={40}
                  className="sm:w-56 border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-amber-400"
                />
              )}
            </div>

            <div
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
              onClick={() =>
                !isUploading &&
                !isProcessing &&
                fileInputRef.current?.click()
              }
              className={`border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center transition-all ${
                isUploading || isProcessing
                  ? "opacity-50 cursor-not-allowed border-gray-300 bg-gray-50"
                  : dragging
                    ? "border-amber-400 bg-amber-50 scale-[1.01] cursor-pointer"
                    : "border-gray-300 hover:border-amber-400 hover:bg-amber-50/40 bg-gray-50 cursor-pointer"
              }`}
            >
              <div
                className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-3 transition-colors ${
                  dragging ? "bg-amber-400" : "bg-white border border-gray-200"
                }`}
              >
                {isUploading || isProcessing ? (
                  <Clock className="w-5 h-5 animate-spin text-amber-500" />
                ) : (
                  <Upload
                    className={`w-5 h-5 transition-colors ${dragging ? "text-gray-900" : "text-gray-400"}`}
                  />
                )}
              </div>
              <p className="text-gray-700 mb-1" style={{ fontWeight: 600 }}>
                {isProcessing
                  ? "รอประมวลผลเอกสารให้เสร็จก่อนอัปโหลดเพิ่ม"
                  : isUploading
                    ? "กำลังอัปโหลดไฟล์..."
                    : dragging
                      ? "วางไฟล์ที่นี่เลย!"
                      : "ลากไฟล์มาวางที่นี่ หรือ คลิกเพื่อเลือกไฟล์"}
              </p>
              <p className="text-xs text-gray-400">
                รองรับ {ALLOWED_DOC_LABEL}
              </p>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept={ALLOWED_DOC_ACCEPT}
                className="hidden"
                onChange={(e) => {
                  addFiles(e.target.files);
                  e.target.value = "";
                }}
                disabled={isUploading || isProcessing}
              />
            </div>

            <div className="space-y-2">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  value={docSearch}
                  onChange={(e) => setDocSearch(e.target.value)}
                  placeholder="ค้นหาชื่อไฟล์หรือหมวดหมู่..."
                  className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg bg-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>
              {usedCategories.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => setCategoryFilter("all")}
                    className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors ${
                      categoryFilter === "all"
                        ? "bg-amber-400 border-amber-400 text-gray-900"
                        : "bg-white border-gray-200 text-gray-600 hover:border-amber-300"
                    }`}
                  >
                    ทั้งหมด ({docs.length})
                  </button>
                  {usedCategories.map((c) => {
                    const count = docs.filter(
                      (d) => (d.category || "ทั่วไป") === c
                    ).length;
                    return (
                      <button
                        type="button"
                        key={c}
                        onClick={() =>
                          setCategoryFilter((prev) => (prev === c ? "all" : c))
                        }
                        className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors ${
                          categoryFilter === c
                            ? "bg-amber-400 border-amber-400 text-gray-900"
                            : "bg-white border-gray-200 text-gray-600 hover:border-amber-300"
                        }`}
                      >
                        {c} ({count})
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {filteredDocs.length === 0 ? (
              <div className="bg-white border border-gray-200 rounded-2xl p-10 text-center">
                <FileText className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                <p className="text-sm text-gray-400">
                  {docs.length === 0
                    ? "ยังไม่มีเอกสารในบอทนี้"
                    : "ไม่พบเอกสารตามคำค้นหาหรือหมวดหมู่ที่เลือก"}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredDocs.map((doc) => (
                  <div
                    key={doc.id}
                    className="bg-white border border-gray-200 rounded-xl px-4 py-3.5 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 hover:border-amber-300 transition-all"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <BotFileIcon filename={doc.filename} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p
                            className="text-sm text-gray-800 truncate"
                            style={{ fontWeight: 500 }}
                          >
                            {doc.filename}
                          </p>
                          <select
                            value={doc.category || "ทั่วไป"}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) =>
                              handleCategoryChange(doc.id, e.target.value)
                            }
                            disabled={isProcessing}
                            className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded border-0 outline-none focus:ring-1 focus:ring-amber-400 max-w-[140px] cursor-pointer disabled:opacity-50"
                            title="เปลี่ยนหมวดหมู่"
                          >
                            {Array.from(
                              new Set([doc.category || "ทั่วไป", ...categoryOptions])
                            ).map((c) => (
                              <option key={c} value={c}>
                                {c}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="flex items-center gap-3 mt-1 flex-wrap">
                          <p className="text-[11px] text-gray-400">
                            {formatBytes(doc.file_size)} •{" "}
                            {new Date(doc.uploaded_at).toLocaleDateString("th-TH")}
                          </p>
                          <BotStatusBadge
                            status={docBadgeStatus(botStatus, isNewBot)}
                          />
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteDoc(doc.id)}
                      disabled={isProcessing}
                      className="self-end sm:self-auto p-2 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      title="ถอดเอกสารออกจากบอท"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
