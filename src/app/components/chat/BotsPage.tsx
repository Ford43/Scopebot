<<<<<<< HEAD
import { useState, useEffect } from "react";
import {
  Search, Plus, ArrowLeft, Bot, Trash2, Edit2,
  BookOpen, X, Upload,
} from "lucide-react";

/* ─── Types ─── */
export interface BotItem {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  createdAt: string;
}

const KNOWLEDGE_LIST = [
  { id: "k1", label: "คู่มือพนักงาน 2024" },
  { id: "k2", label: "นโยบายบริษัท" },
  { id: "k3", label: "ขั้นตอน IT Support" },
  { id: "k4", label: "HR FAQ" },
];

// ทำให้ข้อมูลบอทคงอยู่แม้จะสลับแท็บไปมา
export let globalBots: BotItem[] = [
  {
    id: "b1",
    name: "Bot 1",
    description: "ตอบเป็นภาษาไทยเท่านั้น และอ้างข้อมูลจากเอกสารนี้เท่านั้นโดยไม่โกจากแหล่งอื่น",
    systemPrompt: "คุณคือผู้ช่วยอัจฉริยะที่ตอบเฉพาะภาษาไทยจากข้อมูลที่มีเท่านั้น",
    createdAt: "16 เม.ย. 2568",
  },
];
=======
import { useState, useEffect, useRef, useCallback } from "react";
import {
  Search, Plus, ArrowLeft, Bot, Trash2, Edit2,
  X, Upload, FileText, CheckCircle, Clock, AlertCircle, Eye
} from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { Tooltip, TooltipTrigger, TooltipContent } from "../ui/tooltip";

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
>>>>>>> master

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

<<<<<<< HEAD
/* ════════════════════════════════════════════════
   Create / Edit form
=======
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
>>>>>>> master
════════════════════════════════════════════════ */
interface BotFormProps {
  existing?: BotItem;
  onBack: () => void;
<<<<<<< HEAD
  onSave: (bot: BotItem) => void;
}

interface UploadedFile {
  id: string;
  name: string;
  size: string;
}

function BotForm({ existing, onBack, onSave }: BotFormProps) {
  const isEdit = !!existing;
  const [name, setName] = useState(existing?.name ?? "");
  const [desc, setDesc] = useState(existing?.description ?? "");
  const [prompt, setPrompt] = useState(existing?.systemPrompt ?? "");
  const [selectedKnowledge, setSelectedKnowledge] = useState<string[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
=======
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
>>>>>>> master

  const validate = () => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = "กรุณากรอกชื่อบอท";
    setErrors(e);
<<<<<<< HEAD
    return Object.keys(e).length === 0;
  };

  const handleSave = () => {
    if (!validate()) return;
    onSave({
      id: existing?.id ?? `b${Date.now()}`,
      name: name.trim(),
      description: desc.trim(),
      systemPrompt: prompt.trim(),
      createdAt:
        existing?.createdAt ??
        new Date().toLocaleDateString("th-TH", {
          day: "numeric",
          month: "short",
          year: "numeric",
        }),
    });
  };

  const toggleKnowledge = (id: string) => {
    setSelectedKnowledge((prev) =>
      prev.includes(id) ? prev.filter((k) => k !== id) : [...prev, id]
    );
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    const mapped: UploadedFile[] = files.map((f) => ({
      id: `${Date.now()}-${f.name}`,
      name: f.name,
      size:
        f.size < 1024 * 1024
          ? `${(f.size / 1024).toFixed(1)} KB`
          : `${(f.size / 1024 / 1024).toFixed(1)} MB`,
    }));
    setUploadedFiles((prev) => [...prev, ...mapped]);
    e.target.value = "";
  };

  const removeFile = (id: string) => {
    setUploadedFiles((prev) => prev.filter((f) => f.id !== id));
=======
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
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ name: name.trim(), description: desc.trim(), system_prompt: systemPrompt.trim() })
      });

      if (res.ok) {
        const savedBot = await res.json(); // Backend จะคืนค่า bot_id ของบอทตัวใหม่มาให้

        //  หากเป็นการสร้างบอทใหม่ และมีการอัปโหลดไฟล์ค้างไว้ใน State
        if (!existing && docs.length > 0) {
          for (const doc of docs) {
            // สั่ง Assign เอกสารเข้ากับบอทตัวใหม่ที่เพิ่งสร้างเสร็จ
            await fetch(`/api/documents/${doc.id}/assign/${savedBot.bot_id}`, {
              method: "POST",
              headers: { "Authorization": `Bearer ${token}` }
            });
          }
        }
        onSaveSuccess();
      }
    } catch (error) {
      console.error("Save bot error:", error);
    } finally {
      setIsSaving(false);
    }
  };

  // ฟังก์ชันสำหรับลบบอทในหน้าตั้งค่า
  const handleDeleteBot = async () => {
    if (!existing?.bot_id) return;
    if (!window.confirm("คุณแน่ใจหรือไม่ว่าต้องการลบบอทนี้? ข้อมูลและเอกสารจะถูกลบทั้งหมด")) return;
    
    try {
      const res = await fetch(`/api/bots/${existing.bot_id}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        onSaveSuccess(); // ลบเสร็จให้กลับไปหน้าหลักและรีเฟรช
      } else {
        console.error("Failed to delete bot");
      }
    } catch (error) {
      console.error("Delete bot error:", error);
    }
  };

  // จัดการอัปโหลดไฟล์ และ Assign ให้บอท
  const addFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return; 
    setIsUploading(true);

    for (const file of Array.from(files)) {
      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("category", "ทั่วไป");

        // 1. อัปโหลดเข้า Library กลางเสมอ
        const uploadRes = await fetch("/api/documents/upload", {
          method: "POST",
          headers: { "Authorization": `Bearer ${token}` },
          body: formData
        });

        if (!uploadRes.ok) continue;
        const docData = await uploadRes.json();

        if (existing?.bot_id) {
          // กรณี "แก้ไขบอทเดิม": ให้เชื่อมต่อเอกสารทันที
          await fetch(`/api/documents/${docData.id}/assign/${existing.bot_id}`, {
            method: "POST",
            headers: { "Authorization": `Bearer ${token}` }
          });
        } else {
          // กรณี "กำลังสร้างบอทใหม่": เก็บข้อมูลไฟล์ไว้ใน State docs ก่อน
          setDocs(prev => [...prev, docData]);
        }
      } catch (error) {
        console.error("File processing error", error);
      }
    }
    if (existing?.bot_id) await fetchDocs();
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
>>>>>>> master
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-white">
      {/* Back bar */}
<<<<<<< HEAD
      <div className="flex items-center gap-2 px-8 py-4 border-b border-gray-100 flex-shrink-0">
=======
      <div className="flex items-center justify-between px-8 py-4 border-b border-gray-100 flex-shrink-0 sticky top-0 bg-white z-20">
>>>>>>> master
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
<<<<<<< HEAD
          Back
        </button>
      </div>

      <div className="flex-1 px-8 py-6 max-w-2xl w-full mx-auto space-y-7">
        {/* Bot avatar & name */}
        <div className="flex items-center gap-5">
          <div className="relative flex-shrink-0">
            <div className="w-20 h-20 rounded-2xl bg-amber-100 flex items-center justify-center shadow-sm">
              <Bot className="w-10 h-10 text-amber-500" />
            </div>
            <button className="absolute -bottom-1.5 -right-1.5 w-6 h-6 bg-amber-400 rounded-full flex items-center justify-center shadow">
              <Upload className="w-3 h-3 text-gray-900" />
            </button>
          </div>
          <div className="flex-1 space-y-1.5">
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setErrors((p) => ({ ...p, name: "" }));
              }}
              placeholder="ชื่อบอท"
              className={`w-full text-lg text-gray-900 border-b-2 outline-none bg-transparent pb-1 placeholder-gray-300 transition-colors ${
                errors.name
                  ? "border-red-400"
                  : "border-gray-200 focus:border-amber-400"
              }`}
              style={{ fontWeight: 600 }}
            />
            {errors.name && (
              <p className="text-xs text-red-500">{errors.name}</p>
            )}
            <p className="text-xs text-gray-400">รหัสโมเดล</p>
            <button
              className="text-xs bg-amber-400 text-gray-900 px-3 py-1 rounded-full"
              style={{ fontWeight: 600 }}
            >
              เพิ่มโปรไฟล์บอท
            </button>
          </div>
        </div>

        {/* Description */}
        <div>
          <label
            className="block text-sm text-gray-700 mb-1.5"
            style={{ fontWeight: 500 }}
          >
            คำอธิบาย
          </label>
          <textarea
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            placeholder="เพิ่มคำอธิบายสั้น ๆ สำหรับโมเดลที่ทำ"
            rows={5}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 placeholder-gray-300 outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent resize-none"
          />
        </div>

        {/* Parameters */}
        <div>
          <p className="text-sm text-gray-700 mb-1" style={{ fontWeight: 500 }}>
            พารามิเตอร์ของบอท
          </p>
          <p className="text-xs text-gray-400 mb-2">ระบบพรอมต์</p>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="เพิ่มคำอธิบายสั้น ๆ สำหรับโมเดลที่ทำ"
            rows={5}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 placeholder-gray-300 outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent resize-none"
          />
        </div>

        {/* Knowledge */}
        <div>
          <p className="text-sm text-gray-700 mb-1" style={{ fontWeight: 500 }}>
            ความรู้
          </p>
          <p className="text-xs text-gray-400 mb-2">
            หากต้องการเชื่อมต่อฐานความรู้ที่นี่
            ให้เพิ่มข้อมูลลงในพื้นที่ทำงาน "ความรู้" ก่อน
          </p>
          <button
            className="text-xs bg-amber-400 hover:bg-amber-500 text-gray-900 px-4 py-1.5 rounded-full transition-colors"
            style={{ fontWeight: 600 }}
          >
            เลือกความรู้
          </button>

          {selectedKnowledge.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {selectedKnowledge.map((kid) => {
                const kn = KNOWLEDGE_LIST.find((k) => k.id === kid);
                return (
                  <span
                    key={kid}
                    className="flex items-center gap-1.5 text-xs bg-amber-50 border border-amber-200 text-amber-700 px-3 py-1 rounded-full"
                  >
                    <BookOpen className="w-3 h-3" />
                    {kn?.label}
                    <button onClick={() => toggleKnowledge(kid)}>
                      <X className="w-3 h-3 hover:text-red-500" />
                    </button>
                  </span>
                );
              })}
            </div>
          )}

          <div className="mt-3 border border-gray-200 rounded-xl divide-y divide-gray-100 overflow-hidden">
            {KNOWLEDGE_LIST.map((kn) => (
              <label
                key={kn.id}
                className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-amber-50 transition-colors"
              >
                <input
                  type="checkbox"
                  checked={selectedKnowledge.includes(kn.id)}
                  onChange={() => toggleKnowledge(kn.id)}
                  className="accent-amber-400 w-4 h-4 flex-shrink-0"
                />
                <BookOpen className="w-4 h-4 text-amber-400 flex-shrink-0" />
                <span className="text-sm text-gray-700">{kn.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Upload */}
        <div>
          <p className="text-sm text-gray-700 mb-1" style={{ fontWeight: 500 }}>
            อัพโหลด
          </p>
          <p className="text-xs text-gray-400 mb-3">
            รองรับไฟล์ PDF, DOCX, TXT, CSV ขนาดไม่เกิน 20 MB
          </p>

          <label className="flex flex-col items-center justify-center gap-2 w-full border-2 border-dashed border-gray-200 rounded-xl py-7 cursor-pointer hover:border-amber-400 hover:bg-amber-50/30 transition-all group">
            <div className="w-10 h-10 rounded-xl bg-gray-100 group-hover:bg-amber-100 flex items-center justify-center transition-colors">
              <Upload className="w-5 h-5 text-gray-400 group-hover:text-amber-500 transition-colors" />
            </div>
            <p className="text-sm text-gray-500 group-hover:text-amber-600 transition-colors">
              คลิกเพื่ออัพโหลดไฟล์
            </p>
            <p className="text-xs text-gray-400">หรือลากไฟล์มาวางที่นี่</p>
            <input
              type="file"
              className="hidden"
              multiple
              accept=".pdf,.docx,.txt,.csv"
              onChange={handleFileChange}
            />
          </label>

          {/* Uploaded file list */}
          {uploadedFiles.length > 0 && (
            <div className="mt-3 space-y-2">
              {uploadedFiles.map((f) => (
                <div
                  key={f.id}
                  className="flex items-center gap-3 px-4 py-2.5 border border-gray-200 rounded-xl bg-gray-50"
                >
                  <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
                    <Upload className="w-3.5 h-3.5 text-amber-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-700 truncate" style={{ fontWeight: 500 }}>
                      {f.name}
                    </p>
                    <p className="text-[10px] text-gray-400">{f.size}</p>
                  </div>
                  <button
                    onClick={() => removeFile(f.id)}
                    className="p-1 rounded-full hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors flex-shrink-0"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pb-8">
          <button
            onClick={onBack}
            className="px-5 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
          >
            ยกเลิก
          </button>
          <button
            onClick={handleSave}
            className="px-6 py-2 rounded-lg bg-amber-400 hover:bg-amber-500 text-gray-900 text-sm transition-colors"
            style={{ fontWeight: 600 }}
          >
            {isEdit ? "บันทึกการแก้ไข" : "สร้างบอท"}
          </button>
        </div>
=======
          กลับหน้าหลัก
        </button>

        {/* จัดกลุ่มปุ่มด้านขวา */}
        <div className="flex items-center gap-3">
        <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-6 py-2 rounded-xl bg-amber-400 hover:bg-amber-500 text-gray-900 text-sm transition-colors shadow-sm shadow-amber-200 disabled:opacity-50"
            style={{ fontWeight: 600 }}
          >
            {isSaving ? "กำลังบันทึก..." : (existing ? "บันทึกการตั้งค่า" : "สร้างบอท")}
          </button>
        </div>
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
            onClick={() => setActiveTab("knowledge")} // 🟢 ปลดล็อกให้กดได้ตลอด
            className={`pb-3 text-sm transition-colors relative flex items-center gap-2 ${
              activeTab === "knowledge" ? "text-amber-600 font-semibold" : "text-gray-500 hover:text-gray-700"
            }`}
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

        {/* Tab 2: Knowledge Base (Documents UI) */}
        {activeTab === "knowledge" && (
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
>>>>>>> master
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
<<<<<<< HEAD
  const [bots, setBots] = useState<BotItem[]>(globalBots);
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"list" | "create" | "edit">("list");
  const [editingBot, setEditingBot] = useState<BotItem | undefined>(undefined);

  // ตรวจสอบว่ามีการสั่งให้เข้าสู่โหมดการแก้ไขจากหน้าอื่นหรือไม่
  useEffect(() => {
    if (forceEditBotId) {
      const bot = bots.find(b => b.id === forceEditBotId);
=======
  const [bots, setBots] = useState<BotItem[]>([]);
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"list" | "create" | "edit">("list");
  const [editingBot, setEditingBot] = useState<BotItem | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  // ดึงข้อมูล user มาเช็ค max_bots
  const { user } = useAuth();
  // ตรวจสอบว่าสร้างบอทครบกำหนดหรือยัง
  const maxBots = user?.max_bots || 5; // ใช้ค่าจาก DB ถ้าไม่มีให้ default เป็น 5 [cite: 13, 19]
  const isLimitReached = bots.length >= maxBots;

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
>>>>>>> master
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
<<<<<<< HEAD
      b.description.toLowerCase().includes(search.toLowerCase())
  );

  const handleSave = (bot: BotItem) => {
    const idx = bots.findIndex((b) => b.id === bot.id);
    let newBots = [...bots];
    if (idx >= 0) {
      newBots[idx] = bot;
    } else {
      newBots.push(bot);
    }
    setBots(newBots);
    globalBots = newBots; // เซฟลงในตัวแปร Global ด้วย
    setView("list");
    setEditingBot(undefined);
  };

  const handleDelete = (id: string) => {
    const newBots = bots.filter((b) => b.id !== id);
    setBots(newBots);
    globalBots = newBots;
=======
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
>>>>>>> master
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
<<<<<<< HEAD
        onSave={handleSave}
=======
        onSaveSuccess={() => {
          setView("list");
          setEditingBot(undefined);
          fetchBots(); // รีเฟรชข้อมูล
        }}
>>>>>>> master
      />
    );
  }

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="px-8 pt-7 pb-4 flex-shrink-0">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl text-gray-900" style={{ fontWeight: 700 }}>
<<<<<<< HEAD
            Bots
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
            Create bot
          </button>
=======
            จัดการบอท
          </h1>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-block"> {/* ใช้ span ครอบเพื่อให้ Tooltip ทำงานแม้ปุ่มจะ disabled */}
                <button
                  onClick={() => {
                    if (!isLimitReached) {
                      setEditingBot(undefined);
                      setView("create");
                    }
                  }}
                  disabled={isLimitReached}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-lg transition-all shadow-sm ${
                    isLimitReached 
                      ? "bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-300" 
                      : "bg-amber-400 hover:bg-amber-500 text-gray-900 shadow-amber-200"
                  }`}
                  style={{ fontWeight: 600 }}
                >
                  <Plus className="w-4 h-4" />
                  สร้างบอทใหม่
                </button>
              </span>
            </TooltipTrigger>
            {isLimitReached && (
              <TooltipContent side="bottom" className="bg-slate-800 text-white border-none px-3 py-2 text-xs">
                <p>⚠️ คุณสร้างบอทครบขีดจำกัด ({maxBots} ตัว) แล้ว</p>
              </TooltipContent>
            )}
          </Tooltip>
>>>>>>> master
        </div>

        <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2 max-w-xs bg-gray-50">
          <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
<<<<<<< HEAD
            placeholder="Search Models"
=======
            placeholder="ค้นหาบอท..."
>>>>>>> master
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
<<<<<<< HEAD
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-400">
            <Bot className="w-12 h-12 mb-3 opacity-30" />
            <p className="text-sm">
              {search
                ? "ไม่พบบอทที่ค้นหา"
                : "ยังไม่มีบอท — กด Create bot เพื่อเริ่มต้น"}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((bot, idx) => (
              <div
                key={bot.id}
                className="group relative border border-gray-200 rounded-2xl p-5 hover:border-amber-300 hover:shadow-md hover:shadow-amber-50 transition-all cursor-pointer bg-white"
                onClick={() => onSelectBot ? onSelectBot(bot) : handleEdit(bot)}
              >
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${avatarColour(idx)}`}
                  >
                    <Bot className="w-5 h-5 text-white" />
                  </div>
                  <div className="min-w-0">
                    <p
                      className="text-sm text-gray-900 truncate"
                      style={{ fontWeight: 600 }}
                    >
                      {bot.name}
                    </p>
                  </div>
                </div>

                <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed mb-3">
                  {bot.description}
                </p>

                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-gray-400">
                    สร้างเมื่อ {bot.createdAt}
                  </span>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEdit(bot);
                      }}
                      className="p-1.5 rounded-lg hover:bg-amber-50 text-gray-400 hover:text-amber-600 transition-colors"
                      title="แก้ไข"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(bot.id);
                      }}
                      className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                      title="ลบ"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
=======
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
              <div className="group relative border border-gray-200 rounded-2xl p-5 hover:border-amber-300 hover:shadow-md hover:shadow-amber-50 transition-all cursor-pointer bg-white flex flex-col h-full"
                onClick={() => onSelectBot ? onSelectBot(bot) : handleEdit(bot)}
              >
                {/* จัด flex ให้ โลโก้-ชื่อ อยู่ซ้าย และ ปุ่ม Edit อยู่ขวา */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3 min-w-0 pr-4">
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

                  {/* ปุ่มตั้งค่ามุมขวาบน (เพิ่ม flex-shrink-0 ไม่ให้โดนบีบ) */}
                  <button
                    onClick={(e) => { e.stopPropagation(); handleEdit(bot); }}
                    className="flex-shrink-0 p-2 bg-amber-50 hover:bg-amber-100 text-amber-600 rounded-lg transition-colors border border-amber-200 shadow-sm"
                    title="ตั้งค่า/เอกสาร"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                </div>

                <p className="text-sm text-gray-500 line-clamp-3 leading-relaxed mb-4 flex-1">
                  {bot.description || "ไม่มีคำอธิบาย"}
                </p>

                {/* ส่วนท้าย: เหลือแค่วันที่สร้าง เอาปุ่มลบ/แก้ไขออก */}
                <div className="mt-auto pt-3 border-t border-gray-100">
                  <span className="text-[10px] text-gray-400">
                    สร้างเมื่อ {new Date(bot.created_at).toLocaleDateString('th-TH')}
                  </span>
>>>>>>> master
                </div>
              </div>
            ))}

            {/* Create new card */}
<<<<<<< HEAD
            <button
              onClick={() => {
                setEditingBot(undefined);
                setView("create");
              }}
              className="border-2 border-dashed border-gray-200 rounded-2xl p-5 hover:border-amber-300 hover:bg-amber-50/30 transition-all flex flex-col items-center justify-center gap-2 text-gray-400 hover:text-amber-500 min-h-[140px]"
            >
              <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center">
                <Plus className="w-5 h-5" />
              </div>
              <span className="text-xs">สร้างบอทใหม่</span>
            </button>
=======
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => {
                    if (!isLimitReached) {
                      setEditingBot(undefined);
                      setView("create");
                    }
                  }}
                  disabled={isLimitReached}
                  className={`border-2 border-dashed rounded-2xl p-5 transition-all flex flex-col items-center justify-center gap-2 min-h-[180px] ${
                    isLimitReached 
                      ? "border-slate-200 bg-slate-50 text-slate-300 cursor-not-allowed" 
                      : "border-gray-200 hover:border-amber-300 hover:bg-amber-50/30 text-gray-400 hover:text-amber-500"
                  }`}
                >
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-1 ${isLimitReached ? "bg-slate-100" : "bg-gray-100"}`}>
                    <Plus className={`w-6 h-6 ${isLimitReached ? "text-slate-300" : ""}`} />
                  </div>
                  <span className="text-sm" style={{ fontWeight: 600 }}>สร้างบอทใหม่</span>
                  <span className="text-xs px-4 text-center">
                    {isLimitReached ? `เต็มโควต้า ${maxBots} บอทแล้ว` : "เพิ่ม Workspace อิสระสำหรับธุรกิจ"}
                  </span>
                </button>
              </TooltipTrigger>
              {isLimitReached && (
                <TooltipContent side="top" className="bg-slate-800 text-white border-none px-3 py-2 text-xs">
                  <p>⚠️ คุณสร้างบอทครบขีดจำกัด ({maxBots} ตัว) แล้ว</p>
                </TooltipContent>
              )}
            </Tooltip>
>>>>>>> master
          </div>
        )}
      </div>
    </div>
  );
}