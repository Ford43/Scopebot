import { useState, useEffect, useRef, useCallback } from "react";
import {
  Search,
  ArrowLeft,
  Bot,
  Trash2,
  Upload,
  FileText,
  Clock,
} from "lucide-react";
import type { BotDocument, BotItem } from "../../types/bot";
import {
  createBot,
  deleteBot,
  fetchBot,
  fetchBotDocuments,
  updateBot,
} from "../../lib/bots";
import {
  assignDocumentToBot,
  deleteDocument,
  uploadDocument,
} from "../../lib/documents";
import { formatBytes } from "../../utils/format";
import { BotStatusBadge } from "./BotStatusBadge";
import { BotFileIcon } from "./BotFileIcon";

interface BotFormProps {
  existing?: BotItem;
  onBack: () => void;
  onSaveSuccess: () => void;
}

export default function BotForm({
  existing,
  onBack,
  onSaveSuccess,
}: BotFormProps) {
  const [activeTab, setActiveTab] = useState<"general" | "knowledge">("general");
  const [name, setName] = useState(existing?.name ?? "");
  const [desc, setDesc] = useState(existing?.description ?? "");
  const [systemPrompt, setSystemPrompt] = useState(existing?.system_prompt ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [docs, setDocs] = useState<BotDocument[]>([]);
  const [docSearch, setDocSearch] = useState("");
  const [dragging, setDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [botStatus, setBotStatus] = useState<string>(
    existing?.status || "active"
  );

  const fetchDocs = useCallback(async () => {
    if (!existing?.bot_id) return;
    try {
      const data = await fetchBotDocuments(existing.bot_id);
      setDocs(data);
    } catch (error) {
      console.error("Failed to fetch documents", error);
    }
  }, [existing?.bot_id]);

  useEffect(() => {
    if (existing) fetchDocs();
  }, [existing, fetchDocs]);

  useEffect(() => {
    if (!existing?.bot_id) return;
    let interval: ReturnType<typeof setInterval>;

    const checkBotStatus = async () => {
      try {
        const data = await fetchBot(existing.bot_id);
        setBotStatus(data.status);
        if (data.status !== "processing") {
          clearInterval(interval);
          fetchDocs();
        }
      } catch (error) {
        console.error("Check status error:", error);
      }
    };

    if (botStatus === "processing") {
      interval = setInterval(checkBotStatus, 3000);
    }

    return () => clearInterval(interval);
  }, [existing?.bot_id, botStatus, fetchDocs]);

  const filteredDocs = docs.filter((d) =>
    d.filename.toLowerCase().includes(docSearch.toLowerCase())
  );

  const validate = () => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = "กรุณากรอกชื่อบอท";
    setErrors(e);
    if (Object.keys(e).length > 0) setActiveTab("general");
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setIsSaving(true);
    try {
      const payload = {
        name: name.trim(),
        description: desc.trim(),
        system_prompt: systemPrompt.trim(),
      };

      const savedBot = existing
        ? await updateBot(existing.bot_id, payload)
        : await createBot(payload);

      if (!existing && docs.length > 0) {
        for (const doc of docs) {
          await assignDocumentToBot(doc.id, savedBot.bot_id);
        }
      }
      onSaveSuccess();
    } catch (error) {
      console.error("Save bot error:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteBot = async () => {
    if (!existing?.bot_id) return;
    if (
      !window.confirm(
        "คุณแน่ใจหรือไม่ว่าต้องการลบบอทนี้? ข้อมูลและเอกสารจะถูกลบทั้งหมด"
      )
    )
      return;

    try {
      await deleteBot(existing.bot_id);
      onSaveSuccess();
    } catch (error) {
      console.error("Delete bot error:", error);
    }
  };

  const addFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setIsUploading(true);

    for (const file of Array.from(files)) {
      try {
        const docData = await uploadDocument(file);

        if (existing?.bot_id) {
          await assignDocumentToBot(docData.id, existing.bot_id);
        } else {
          setDocs((prev) => [...prev, docData]);
        }
      } catch (error) {
        console.error("File processing error", error);
      }
    }

    if (existing?.bot_id) await fetchDocs();
    setIsUploading(false);
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(true);
  };
  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
  };
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    addFiles(e.dataTransfer.files);
  };

  const handleDeleteDoc = async (docId: number) => {
    if (!existing?.bot_id) return;
    if (
      !window.confirm(
        "คุณต้องการลบเอกสารนี้ออกจากระบบอย่างถาวรใช่หรือไม่?"
      )
    )
      return;

    try {
      await deleteDocument(docId);
      fetchDocs();
    } catch (error) {
      console.error("Delete doc error:", error);
    }
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-white">
      <div className="flex items-center justify-between px-8 py-4 border-b border-gray-100 flex-shrink-0 sticky top-0 bg-white z-20">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          กลับหน้าหลัก
        </button>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="px-6 py-2 rounded-xl bg-amber-400 hover:bg-amber-500 text-gray-900 text-sm transition-colors shadow-sm shadow-amber-200 disabled:opacity-50"
          style={{ fontWeight: 600 }}
        >
          {isSaving
            ? "กำลังบันทึก..."
            : existing
              ? "บันทึกการตั้งค่า"
              : "สร้างบอท"}
        </button>
      </div>

      <div className="flex-1 px-8 py-6 max-w-4xl w-full mx-auto">
        <div className="flex items-center gap-5 mb-8">
          <div className="w-20 h-20 rounded-3xl bg-amber-100 flex items-center justify-center shadow-sm flex-shrink-0">
            <Bot className="w-10 h-10 text-amber-500" />
          </div>
          <div className="flex-1 min-w-0">
            <h1
              className="text-2xl text-gray-900 truncate"
              style={{ fontWeight: 700 }}
            >
              {name || "บอทใหม่ยังไม่มีชื่อ"}
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              ID: {existing?.bot_id ?? "จะถูกสร้างอัตโนมัติ"}
            </p>
            {existing && (
              <BotStatusBadge
                status={
                  botStatus === "processing" ? "processing" : existing.status
                }
              />
            )}
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
                <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-md text-[10px]">
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

            {existing && (
              <div className="pt-8 mt-6 border-t border-red-100 flex flex-col items-center">
                <button
                  onClick={handleDeleteBot}
                  className="flex items-center gap-2 px-4 py-2.5 text-sm text-red-600 bg-red-50 hover:bg-red-100 rounded-xl transition-colors border border-red-200 font-medium"
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
            {botStatus === "processing" && (
              <div className="bg-amber-50 border border-amber-200 text-amber-700 px-4 py-3 rounded-xl flex items-center gap-3">
                <Clock className="w-5 h-5 animate-spin text-amber-500" />
                <div>
                  <p className="text-sm font-semibold">
                    กำลังเรียนรู้เอกสาร (Processing...)
                  </p>
                  <p className="text-xs opacity-80">
                    โปรดรอสักครู่ ระบบกำลังแปลงไฟล์เพื่อนำไปสร้างฐานความรู้
                  </p>
                </div>
              </div>
            )}

            <div
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
              onClick={() => !isUploading && fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center transition-all ${
                isUploading
                  ? "opacity-50 cursor-wait border-gray-300 bg-gray-50"
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
                {isUploading ? (
                  <Clock className="w-5 h-5 animate-spin text-amber-500" />
                ) : (
                  <Upload
                    className={`w-5 h-5 transition-colors ${dragging ? "text-gray-900" : "text-gray-400"}`}
                  />
                )}
              </div>
              <p className="text-gray-700 mb-1" style={{ fontWeight: 600 }}>
                {isUploading
                  ? "กำลังประมวลผลไฟล์..."
                  : dragging
                    ? "วางไฟล์ที่นี่เลย!"
                    : "ลากไฟล์มาวางที่นี่ หรือ คลิกเพื่อเลือกไฟล์"}
              </p>
              <p className="text-xs text-gray-400">
                รองรับ PDF, DOC, DOCX, XLSX, CSV, TXT (สูงสุด 10 MB / ไฟล์)
              </p>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.doc,.docx,.xlsx,.csv,.txt"
                className="hidden"
                onChange={(e) => addFiles(e.target.files)}
                disabled={isUploading}
              />
            </div>

            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                value={docSearch}
                onChange={(e) => setDocSearch(e.target.value)}
                placeholder="ค้นหาเอกสารในบอทนี้..."
                className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg bg-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>

            {filteredDocs.length === 0 ? (
              <div className="bg-white border border-gray-200 rounded-2xl p-10 text-center">
                <FileText className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                <p className="text-sm text-gray-400">ยังไม่มีเอกสารในบอทนี้</p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredDocs.map((doc) => (
                  <div
                    key={doc.id}
                    className="bg-white border border-gray-200 rounded-xl px-4 py-3.5 flex items-center gap-4 hover:border-amber-300 transition-all"
                  >
                    <BotFileIcon filename={doc.filename} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p
                          className="text-sm text-gray-800 truncate"
                          style={{ fontWeight: 500 }}
                        >
                          {doc.filename}
                        </p>
                        <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">
                          {doc.category || "ทั่วไป"}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1">
                        <p className="text-[11px] text-gray-400">
                          {formatBytes(doc.file_size)} •{" "}
                          {new Date(doc.uploaded_at).toLocaleDateString("th-TH")}
                        </p>
                        <BotStatusBadge
                          status={
                            botStatus === "processing" ? "processing" : "ready"
                          }
                        />
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteDoc(doc.id)}
                      className="p-2 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                      title="นำเอกสารออก"
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
