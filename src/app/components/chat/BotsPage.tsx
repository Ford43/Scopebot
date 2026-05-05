import { useState, useEffect, useRef, useCallback } from "react";
import {
  Search, Plus, ArrowLeft, Bot, Trash2, Edit2,
  X, Upload, FileText, CheckCircle, Clock, AlertCircle, Eye
} from "lucide-react";

/* ─── Types & Interfaces ─── */
interface Doc {
  id: number;
  filename: string;
  file_size: number;
  category: string;
  uploaded_at: string;
  // เพิ่ม field จำลองสถานะสำหรับ UI (เนื่องจากหลังบ้านใช้สถานะที่ตัวบอท)
  status?: "ready" | "processing" | "error"; 
}

export interface BotItem {
  id: number;
  bot_id: string; // ใช้ bot_id (string) สำหรับอ้างอิง API
  name: string;
  description: string;
  status: string;
  system_prompt?: string;
  created_at: string;
  documents?: Doc[];
}

const AVATAR_COLOURS = [
  "bg-amber-400",
  "bg-orange-400",
  "bg-sky-400",
  "bg-emerald-400",
  "bg-violet-400",
];

function avatarColour(index: number) {
  return AVATAR_COLOURS[index % AVATAR_COLOURS.length];
}

/* ─── Document Helpers ─── */
const DOC_CATEGORIES = ["ทั้งหมด", "HR Policy", "Onboarding", "Policy", "IT", "ทั่วไป"];

function formatBytes(bytes: number): string {
  if (!bytes) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function StatusBadge({ status }: { status?: string }) {
  if (status === "ready" || status === "active")
    return (
      <span className="flex items-center gap-1 text-[11px] text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
        <CheckCircle className="w-3 h-3" /> พร้อมใช้งาน
      </span>
    );
  if (status === "processing")
    return (
      <span className="flex items-center gap-1 text-[11px] text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
        <Clock className="w-3 h-3 animate-spin" /> กำลังประมวลผล
      </span>
    );
  return (
    <span className="flex items-center gap-1 text-[11px] text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
      <CheckCircle className="w-3 h-3" /> ปกติ
    </span>
  );
}

function FileIcon({ filename }: { filename: string }) {
  const ext = filename.split('.').pop()?.toUpperCase() || "FILE";
  const colors: Record<string, string> = {
    PDF:  "bg-red-100 text-red-600",
    DOCX: "bg-blue-100 text-blue-600",
    DOC:  "bg-blue-100 text-blue-600",
    XLSX: "bg-green-100 text-green-600",
    TXT:  "bg-gray-100 text-gray-600",
    CSV:  "bg-green-100 text-green-600",
  };
  const cls = colors[ext] ?? "bg-gray-100 text-gray-600";
  return (
    <div className={`w-11 h-11 rounded-xl flex flex-col items-center justify-center flex-shrink-0 ${cls}`}>
      <FileText className="w-5 h-5" />
      <span className="text-[8px] mt-0.5" style={{ fontWeight: 700 }}>{ext}</span>
    </div>
  );
}

/* ════════════════════════════════════════════════
   Create / Edit form (With Tabs)
════════════════════════════════════════════════ */
interface BotFormProps {
  existing?: BotItem;
  onBack: () => void;
  onSaveSuccess: () => void; // เรียกเมื่อบันทึก/อัปเดตสำเร็จเพื่อรีเฟรชหน้าหลัก
}

function BotForm({ existing, onBack, onSaveSuccess }: BotFormProps) {
  const [activeTab, setActiveTab] = useState<"general" | "knowledge">("general");

  // General States
  const [name, setName] = useState(existing?.name ?? "");
  const [desc, setDesc] = useState(existing?.description ?? "");
  const [systemPrompt, setSystemPrompt] = useState(existing?.system_prompt ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  
  // Knowledge States
  const [docs, setDocs] = useState<Doc[]>([]);
  const [docSearch, setDocSearch] = useState("");
  const [docCategory, setDocCategory] = useState("ทั้งหมด");
  const [dragging, setDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [botStatus, setBotStatus] = useState<string>(existing?.status || "active");

  // ดึง Token
  const token = localStorage.getItem("scopebot_token");

  // โหลดเอกสารของบอทตัวนี้จาก API
  const fetchDocs = useCallback(async () => {
    if (!existing?.bot_id) return;
    try {
      const res = await fetch(`/api/bots/${existing.bot_id}/documents`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setDocs(data);
      }
    } catch (error) {
      console.error("Failed to fetch documents", error);
    }
  }, [existing?.bot_id, token]);

  useEffect(() => {
    if (existing) fetchDocs();
  }, [existing, fetchDocs]);

  // 2. ระบบ Polling ตรวจสอบสถานะ
  useEffect(() => {
    if (!existing?.bot_id) return;
    let interval: ReturnType<typeof setInterval>;

    const checkBotStatus = async () => {
      try {
        const res = await fetch(`/api/bots/${existing.bot_id}`, {
          headers: { "Authorization": `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setBotStatus(data.status); // อัปเดตสถานะให้ UI

          // ถ้าเสร็จแล้วให้หยุดเช็ค และรีเฟรชหน้าเอกสาร 1 ครั้ง
          if (data.status !== "processing") {
            clearInterval(interval);
            fetchDocs();
          }
        }
      } catch (error) {
        console.error("Check status error:", error);
      }
    };

    // ถ้าสถานะเป็น processing ให้ยิงไปเช็คทุกๆ 3 วินาที
    if (botStatus === "processing") {
      interval = setInterval(checkBotStatus, 3000);
    }

    return () => clearInterval(interval);
  }, [existing?.bot_id, botStatus, token, fetchDocs]);

  // กรองเอกสาร
  const filteredDocs = docs.filter((d) => {
    const matchSearch = d.filename.toLowerCase().includes(docSearch.toLowerCase());
    const matchCat    = docCategory === "ทั้งหมด" || d.category === docCategory;
    return matchSearch && matchCat;
  });

  const validate = () => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = "กรุณากรอกชื่อบอท";
    setErrors(e);
    if (Object.keys(e).length > 0) setActiveTab("general");
    return Object.keys(e).length === 0;
  };

  // บันทึก หรือ อัปเดต บอท
  const handleSave = async () => {
    if (!validate()) return;
    setIsSaving(true);
    try {
      const url = existing ? `/api/bots/${existing.bot_id}` : `/api/bots/`;
      const method = existing ? "PATCH" : "POST";
      
      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ name: name.trim(), description: desc.trim(), system_prompt: systemPrompt.trim() })
      });

      if (res.ok) {
        onSaveSuccess(); // กลับไปหน้ารายการ
      } else {
        const errorData = await res.json();
        setErrors({ name: errorData.detail || "เกิดข้อผิดพลาดในการบันทึก" });
      }
    } catch (error) {
      console.error("Save bot error:", error);
    } finally {
      setIsSaving(false);
    }
  };

  // จัดการอัปโหลดไฟล์ และ Assign ให้บอท
  const addFiles = async (files: FileList | null) => {
    if (!files || files.length === 0 || !existing?.bot_id) return;
    setIsUploading(true);

    for (const file of Array.from(files)) {
      try {
        // 1. Upload ไฟล์ไปที่ส่วนกลางก่อน
        const formData = new FormData();
        formData.append("file", file);
        formData.append("category", "ทั่วไป"); // default

        const uploadRes = await fetch("/api/documents/upload", {
          method: "POST",
          headers: { "Authorization": `Bearer ${token}` },
          body: formData
        });
        
        if (!uploadRes.ok) {
          console.error("Upload failed for", file.name);
          continue;
        }
        
        const docData = await uploadRes.json();

        // 2. Assign ไฟล์เข้ากับ Bot ปัจจุบัน
        await fetch(`/api/documents/${docData.id}/assign/${existing.bot_id}`, {
          method: "POST",
          headers: { "Authorization": `Bearer ${token}` }
        });
        setBotStatus("processing");

      } catch (error) {
        console.error("File processing error", error);
      }
    }
    
    // โหลดรายชื่อเอกสารใหม่เมื่อเสร็จสิ้น
    await fetchDocs();
    setIsUploading(false);
  };

  const onDragOver  = (e: React.DragEvent) => { e.preventDefault(); setDragging(true);  };
  const onDragLeave = (e: React.DragEvent) => { e.preventDefault(); setDragging(false); };
  const onDrop      = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    addFiles(e.dataTransfer.files);
  };

  // ลบเอกสารออกจากบอท
  // ลบเอกสารออกจากบอท (และลบออกจากระบบถาวร)
  const handleDeleteDoc = async (doc_id: number) => {
    if (!existing?.bot_id) return;
    
    // แนะนำให้เพิ่ม Confirm เผื่อผู้ใช้กดพลาดครับ
    if (!window.confirm("คุณต้องการลบเอกสารนี้ออกจากระบบอย่างถาวรใช่หรือไม่?")) return;

    try {
      // แก้ไข URL จาก /unassign/... เป็นการลบที่ Document ID โดยตรง
      const res = await fetch(`/api/documents/${doc_id}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` }
      });
      
      if (res.ok) {
        fetchDocs(); // โหลดรายการเอกสารใหม่
      } else {
        console.error("Failed to delete document");
      }
    } catch (error) {
      console.error("Delete doc error:", error);
    }
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-white">
      {/* Back bar */}
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
          {isSaving ? "กำลังบันทึก..." : (existing ? "บันทึกการตั้งค่า" : "สร้างบอท")}
        </button>
      </div>

      <div className="flex-1 px-8 py-6 max-w-4xl w-full mx-auto">
        {/* Header Section */}
        <div className="flex items-center gap-5 mb-8">
          <div className="relative flex-shrink-0">
            <div className="w-20 h-20 rounded-3xl bg-amber-100 flex items-center justify-center shadow-sm">
              <Bot className="w-10 h-10 text-amber-500" />
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl text-gray-900 truncate" style={{ fontWeight: 700 }}>
              {name || "บอทใหม่ยังไม่มีชื่อ"}
            </h1>
            <div className="flex items-center gap-3 mt-1.5"></div>
              <p className="text-sm text-gray-500 mt-1">ID: {existing?.bot_id ?? "จะถูกสร้างอัตโนมัติ"}</p>
              {existing && (
                 <StatusBadge status={botStatus === "processing" ? "processing" : existing.status} />
              )}
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-6 border-b border-gray-200 mb-8">
          <button
            onClick={() => setActiveTab("general")}
            className={`pb-3 text-sm transition-colors relative ${
              activeTab === "general" ? "text-amber-600 font-semibold" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            ตั้งค่าทั่วไป
            {activeTab === "general" && <span className="absolute bottom-0 left-0 w-full h-0.5 bg-amber-400 rounded-t-full" />}
          </button>
          
          <button
            onClick={() => existing && setActiveTab("knowledge")}
            disabled={!existing}
            className={`pb-3 text-sm transition-colors relative flex items-center gap-2 ${
              activeTab === "knowledge" ? "text-amber-600 font-semibold" : "text-gray-500 hover:text-gray-700"
            } ${!existing ? "opacity-40 cursor-not-allowed" : ""}`}
            title={!existing ? "กรุณาสร้างบอทก่อนอัปโหลดเอกสาร" : ""}
          >
            ฐานความรู้ (เอกสาร)
            <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-md text-[10px]">{docs.length}</span>
            {activeTab === "knowledge" && <span className="absolute bottom-0 left-0 w-full h-0.5 bg-amber-400 rounded-t-full" />}
          </button>
        </div>

        {/* Tab 1: General Settings */}
        {activeTab === "general" && (
          <div className="space-y-6 max-w-2xl">
            <div>
              <label className="block text-sm text-gray-800 mb-2" style={{ fontWeight: 600 }}>ชื่อบอท (Bot Name)</label>
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
              {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
            </div>

            <div>
              <label className="block text-sm text-gray-800 mb-2" style={{ fontWeight: 600 }}>คำอธิบาย (Description)</label>
              <textarea
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                placeholder="อธิบายสั้นๆ ว่าบอทตัวนี้ทำหน้าที่อะไร..."
                rows={3}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 outline-none focus:ring-2 focus:ring-amber-400 resize-none bg-gray-50"
              />
            </div>

            <div className="pt-2">
              <label className="block text-sm text-gray-800 mb-2" style={{ fontWeight: 600 }}>
                System Prompt (พฤติกรรมบอท)
              </label>
              <p className="text-xs text-gray-500 mb-2">
                กำหนดบุคลิก กฎเกณฑ์ หรือวิธีการตอบของบอทตัวนี้ (ปล่อยว่างไว้หากต้องการใช้ค่าเริ่มต้น)
              </p>
              <textarea
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                placeholder="ตัวอย่าง: คุณคือผู้ช่วยฝ่ายบุคคลของบริษัท จงตอบคำถามด้วยความสุภาพและลงท้ายด้วย 'ครับ/ค่ะ' เสมอ หากไม่รู้ให้ตอบว่าไม่ทราบ ห้ามเดาคำตอบเองเด็ดขาด"
                rows={5}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 outline-none focus:ring-2 focus:ring-amber-400 bg-white font-mono"
              />
            </div>
            
            {!existing && (
               <div className="bg-blue-50 border border-blue-200 text-blue-700 text-sm px-4 py-3 rounded-xl mt-4">
                 💡 <b>ข้อแนะนำ:</b> กรุณากดปุ่ม <b>"สร้างบอท"</b> มุมขวาบน เพื่อบันทึกข้อมูลเบื้องต้นก่อน จากนั้นคุณถึงจะสามารถอัปโหลดเอกสารฐานความรู้ได้ครับ
               </div>
            )}
          </div>
        )}

        {/* Tab 2: Knowledge Base (Documents UI) */}
        {activeTab === "knowledge" && existing && (
          <div className="space-y-6">
            {botStatus === "processing" && (
              <div className="bg-amber-50 border border-amber-200 text-amber-700 px-4 py-3 rounded-xl flex items-center gap-3">
                <Clock className="w-5 h-5 animate-spin text-amber-500" />
                <div>
                  <p className="text-sm font-semibold">กำลังเรียนรู้เอกสาร (Processing...)</p>
                  <p className="text-xs opacity-80">โปรดรอสักครู่ ระบบกำลังแปลงไฟล์เพื่อนำไปสร้างฐานความรู้ หากเสร็จแล้วสถานะจะอัปเดตอัตโนมัติ</p>
                </div>
              </div>
            )}
            {/* Dropzone */}
            <div
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
              onClick={() => !isUploading && fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center transition-all ${
                isUploading ? "opacity-50 cursor-wait border-gray-300 bg-gray-50" : 
                dragging ? "border-amber-400 bg-amber-50 scale-[1.01] cursor-pointer" : "border-gray-300 hover:border-amber-400 hover:bg-amber-50/40 bg-gray-50 cursor-pointer"
              }`}
            >
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-3 transition-colors ${
                dragging ? "bg-amber-400" : "bg-white border border-gray-200"
              }`}>
                {isUploading ? <Clock className="w-5 h-5 animate-spin text-amber-500" /> : <Upload className={`w-5 h-5 transition-colors ${dragging ? "text-gray-900" : "text-gray-400"}`} />}
              </div>
              <p className="text-gray-700 mb-1" style={{ fontWeight: 600 }}>
                {isUploading ? "กำลังประมวลผลไฟล์... กรุณารอสักครู่" : dragging ? "วางไฟล์ที่นี่เลย!" : "ลากไฟล์มาวางที่นี่ หรือ คลิกเพื่อเลือกไฟล์"}
              </p>
              <p className="text-xs text-gray-400">รองรับ PDF, DOC, DOCX, XLSX, CSV, TXT (สูงสุด 10 MB / ไฟล์)</p>
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

            {/* Toolbar */}
            <div className="flex items-center gap-3 flex-wrap pt-4">
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
            </div>

            {/* Document List */}
            {filteredDocs.length === 0 ? (
              <div className="bg-white border border-gray-200 rounded-2xl p-10 text-center">
                <FileText className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                <p className="text-sm text-gray-400">ยังไม่มีเอกสารในบอทนี้</p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredDocs.map((doc) => (
                  <div key={doc.id} className="bg-white border border-gray-200 rounded-xl px-4 py-3.5 flex items-center gap-4 hover:border-amber-300 transition-all">
                    <FileIcon filename={doc.filename} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm text-gray-800 truncate" style={{ fontWeight: 500 }}>{doc.filename}</p>
                        <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">{doc.category || "ทั่วไป"}</span>
                      </div>
                      <div className="flex items-center gap-3 mt-1">
                        <p className="text-[11px] text-gray-400">{formatBytes(doc.file_size)} • {new Date(doc.uploaded_at).toLocaleDateString('th-TH')}</p>
                        <StatusBadge status={botStatus === "processing" ? "processing" : "ready"} />
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => handleDeleteDoc(doc.id)}
                        className="p-2 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                        title="นำเอกสารออก"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
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

/* ════════════════════════════════════════════════
   Main Bots Page
════════════════════════════════════════════════ */

interface BotsPageProps {
  onSelectBot?: (bot: BotItem) => void;
  forceEditBotId?: string | null;
  onClearForceEdit?: () => void;
}

export default function BotsPage({ onSelectBot, forceEditBotId, onClearForceEdit }: BotsPageProps = {}) {
  const [bots, setBots] = useState<BotItem[]>([]);
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"list" | "create" | "edit">("list");
  const [editingBot, setEditingBot] = useState<BotItem | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);

  // โหลดรายชื่อบอทจาก API
  const fetchBots = useCallback(async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem("scopebot_token");
      const res = await fetch("/api/bots/", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setBots(data);
      }
    } catch (error) {
      console.error("Fetch bots error", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBots();
  }, [fetchBots]);

  // จัดการบังคับเข้าหน้าแก้ไข (มาจาก ChatInterface)
  useEffect(() => {
    if (forceEditBotId && bots.length > 0) {
      const bot = bots.find(b => b.bot_id === forceEditBotId);
      if (bot) {
        setEditingBot(bot);
        setView("edit");
      }
      if (onClearForceEdit) onClearForceEdit();
    }
  }, [forceEditBotId, bots, onClearForceEdit]);

  const filtered = bots.filter(
    (b) =>
      b.name.toLowerCase().includes(search.toLowerCase()) ||
      (b.description && b.description.toLowerCase().includes(search.toLowerCase()))
  );

  const handleDelete = async (bot_id: string) => {
    if (!window.confirm("คุณแน่ใจหรือไม่ว่าต้องการลบบอทนี้? ข้อมูลและเอกสารจะถูกลบทั้งหมด")) return;
    try {
      const token = localStorage.getItem("scopebot_token");
      const res = await fetch(`/api/bots/${bot_id}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        fetchBots();
      }
    } catch (error) {
      console.error("Delete bot error", error);
    }
  };

  const handleEdit = (bot: BotItem) => {
    setEditingBot(bot);
    setView("edit");
  };

  if (view === "create" || view === "edit") {
    return (
      <BotForm
        existing={editingBot}
        onBack={() => {
          setView("list");
          setEditingBot(undefined);
        }}
        onSaveSuccess={() => {
          setView("list");
          setEditingBot(undefined);
          fetchBots(); // รีเฟรชข้อมูล
        }}
      />
    );
  }

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="px-8 pt-7 pb-4 flex-shrink-0">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl text-gray-900" style={{ fontWeight: 700 }}>
            My Workspaces (Bots)
          </h1>
          <button
            onClick={() => {
              setEditingBot(undefined);
              setView("create");
            }}
            className="flex items-center gap-1.5 bg-amber-400 hover:bg-amber-500 text-gray-900 text-sm px-4 py-2 rounded-lg transition-colors shadow-sm shadow-amber-200"
            style={{ fontWeight: 600 }}
          >
            <Plus className="w-4 h-4" />
            สร้างบอทใหม่
          </button>
        </div>

        <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2 max-w-xs bg-gray-50">
          <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ค้นหาบอท..."
            className="text-sm text-gray-600 bg-transparent outline-none flex-1 placeholder-gray-400"
          />
          {search && (
            <button onClick={() => setSearch("")}>
              <X className="w-3.5 h-3.5 text-gray-400 hover:text-gray-600" />
            </button>
          )}
        </div>
      </div>

      {/* Bot grid */}
      <div className="flex-1 overflow-y-auto px-8 pb-8">
        {isLoading ? (
          <div className="flex items-center justify-center h-64 text-gray-400">
            <Clock className="w-8 h-8 animate-spin text-amber-400" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-400">
            <Bot className="w-12 h-12 mb-3 opacity-30" />
            <p className="text-sm">
              {search ? "ไม่พบบอทที่ค้นหา" : "ยังไม่มีบอท — กดสร้างบอทใหม่เพื่อเริ่มต้น"}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map((bot, idx) => (
              <div
                key={bot.id}
                className="group relative border border-gray-200 rounded-2xl p-5 hover:border-amber-300 hover:shadow-md hover:shadow-amber-50 transition-all cursor-pointer bg-white flex flex-col h-full"
                onClick={() => onSelectBot ? onSelectBot(bot) : handleEdit(bot)}
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${avatarColour(idx)}`}>
                    <Bot className="w-6 h-6 text-white" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-base text-gray-900 truncate" style={{ fontWeight: 600 }}>
                      {bot.name}
                    </p>
                    <p className="text-[11px] text-gray-400 mt-0.5 flex items-center gap-1">
                      สถานะ: <span className={bot.status === 'active' ? 'text-green-500' : 'text-amber-500'}>{bot.status.toUpperCase()}</span>
                    </p>
                  </div>
                </div>

                <p className="text-sm text-gray-500 line-clamp-3 leading-relaxed mb-4 flex-1">
                  {bot.description || "ไม่มีคำอธิบาย"}
                </p>

                <div className="flex items-center justify-between mt-auto pt-3 border-t border-gray-100">
                  <span className="text-[10px] text-gray-400">
                    สร้างเมื่อ {new Date(bot.created_at).toLocaleDateString('th-TH')}
                  </span>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleEdit(bot); }}
                      className="p-1.5 rounded-lg hover:bg-amber-50 text-gray-400 hover:text-amber-600 transition-colors"
                      title="ตั้งค่า/เอกสาร"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(bot.bot_id); }}
                      className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                      title="ลบบอท"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {/* Create new card */}
            <button
              onClick={() => {
                setEditingBot(undefined);
                setView("create");
              }}
              className="border-2 border-dashed border-gray-200 rounded-2xl p-5 hover:border-amber-300 hover:bg-amber-50/30 transition-all flex flex-col items-center justify-center gap-2 text-gray-400 hover:text-amber-500 min-h-[180px]"
            >
              <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center mb-1">
                <Plus className="w-6 h-6" />
              </div>
              <span className="text-sm" style={{ fontWeight: 600 }}>สร้างบอทใหม่</span>
              <span className="text-xs text-gray-400 px-4 text-center">เพิ่ม Workspace อิสระสำหรับธุรกิจ</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}