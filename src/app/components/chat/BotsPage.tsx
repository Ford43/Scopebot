import { useState, useEffect, useRef, useCallback } from "react";
import {
  Search, Plus, ArrowLeft, Bot, Trash2, Edit2,
  X, Upload, FileText, CheckCircle, Clock, AlertCircle, Download, Eye
} from "lucide-react";

/* ─── Types & Interfaces ─── */
interface Doc {
  id: string;
  name: string;
  size: string;
  rawSize: number;
  uploadDate: string;
  type: string;
  status: "ready" | "processing" | "error";
  category: string;
}

export interface BotItem {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  createdAt: string;
  documents: Doc[];
}

// ทำให้ข้อมูลบอทคงอยู่แม้จะสลับแท็บไปมา
export let globalBots: BotItem[] = [
  {
    id: "b1",
    name: "Bot 1",
    description: "ตอบเป็นภาษาไทยเท่านั้น และอ้างข้อมูลจากเอกสารนี้เท่านั้นโดยไม่โกจากแหล่งอื่น",
    systemPrompt: "คุณคือผู้ช่วยอัจฉริยะที่ตอบเฉพาะภาษาไทยจากข้อมูลที่มีเท่านั้น",
    createdAt: "16 เม.ย. 2568",
    documents: [
      { id: "d1", name: "คู่มือพนักงาน.pdf", size: "2.3 MB", rawSize: 2411724, uploadDate: "16 เม.ย. 2568", type: "PDF", status: "ready", category: "HR Policy" }
    ],
  },
];

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
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function today(): string {
  return new Date().toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" }).replace(/\d{4}/, (y) => String(Number(y) + 543));
}

function StatusBadge({ status }: { status: Doc["status"] }) {
  if (status === "ready")
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
    <span className="flex items-center gap-1 text-[11px] text-red-500 bg-red-50 px-2 py-0.5 rounded-full">
      <AlertCircle className="w-3 h-3" /> ข้อผิดพลาด
    </span>
  );
}

function FileIcon({ type }: { type: string }) {
  const colors: Record<string, string> = {
    PDF:  "bg-red-100 text-red-600",
    DOCX: "bg-blue-100 text-blue-600",
    DOC:  "bg-blue-100 text-blue-600",
    XLSX: "bg-green-100 text-green-600",
    TXT:  "bg-gray-100 text-gray-600",
    CSV:  "bg-green-100 text-green-600",
  };
  const cls = colors[type] ?? "bg-gray-100 text-gray-600";
  return (
    <div className={`w-11 h-11 rounded-xl flex flex-col items-center justify-center flex-shrink-0 ${cls}`}>
      <FileText className="w-5 h-5" />
      <span className="text-[8px] mt-0.5" style={{ fontWeight: 700 }}>{type}</span>
    </div>
  );
}

/* ════════════════════════════════════════════════
   Create / Edit form (With Tabs)
════════════════════════════════════════════════ */
interface BotFormProps {
  existing?: BotItem;
  onBack: () => void;
  onSave: (bot: BotItem) => void;
}

function BotForm({ existing, onBack, onSave }: BotFormProps) {
  const isEdit = !!existing;
  
  // Tabs state
  const [activeTab, setActiveTab] = useState<"general" | "knowledge">("general");

  // General States
  const [name, setName] = useState(existing?.name ?? "");
  const [desc, setDesc] = useState(existing?.description ?? "");
  const [prompt, setPrompt] = useState(existing?.systemPrompt ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  // Knowledge States
  const [docs, setDocs] = useState<Doc[]>(existing?.documents ?? []);
  const [docSearch, setDocSearch] = useState("");
  const [docCategory, setDocCategory] = useState("ทั้งหมด");
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Filter docs
  const filteredDocs = docs.filter((d) => {
    const matchSearch = d.name.toLowerCase().includes(docSearch.toLowerCase());
    const matchCat    = docCategory === "ทั้งหมด" || d.category === docCategory;
    return matchSearch && matchCat;
  });

  const validate = () => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = "กรุณากรอกชื่อบอท";
    setErrors(e);
    if (Object.keys(e).length > 0) setActiveTab("general"); // กลับมาแท็บแรกถ้ามี error
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
      documents: docs,
    });
  };

  const addFiles = useCallback((files: FileList | null) => {
    if (!files || files.length === 0) return;
    const newFiles: Doc[] = [];
    const ids: string[] = [];

    Array.from(files).forEach((file) => {
      const id = Date.now().toString() + Math.random().toString(36).slice(2);
      const ext = file.name.split(".").pop()?.toUpperCase() ?? "FILE";
      newFiles.push({
        id,
        name: file.name,
        size: formatBytes(file.size),
        rawSize: file.size,
        uploadDate: today(),
        type: ext,
        status: "processing",
        category: "ทั่วไป"
      });
      ids.push(id);
    });

    setDocs((prev) => [...newFiles, ...prev]);

    // Simulate processing
    ids.forEach((id) => {
      setTimeout(() => {
        setDocs((prev) => prev.map((d) => (d.id === id ? { ...d, status: "ready" } : d)));
      }, 2500 + Math.random() * 1500);
    });
  }, []);

  const onDragOver  = (e: React.DragEvent) => { e.preventDefault(); setDragging(true);  };
  const onDragLeave = (e: React.DragEvent) => { e.preventDefault(); setDragging(false); };
  const onDrop      = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    addFiles(e.dataTransfer.files);
  };

  const handleDeleteDoc = (id: string) => setDocs((prev) => prev.filter((d) => d.id !== id));

  // Stats for Knowledge Tab
  const readyDocsCount = docs.filter((d) => d.status === "ready").length;
  const processingDocsCount = docs.filter((d) => d.status === "processing").length;

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
          className="px-6 py-2 rounded-xl bg-amber-400 hover:bg-amber-500 text-gray-900 text-sm transition-colors shadow-sm shadow-amber-200"
          style={{ fontWeight: 600 }}
        >
          {isEdit ? "บันทึกการตั้งค่า" : "สร้างบอท"}
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
            <p className="text-sm text-gray-500 mt-1">ID: {existing?.id ?? "จะถูกสร้างอัตโนมัติ"}</p>
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
            onClick={() => setActiveTab("knowledge")}
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
              <label className="block text-sm text-gray-800 mb-2" style={{ fontWeight: 600 }}>
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
                className={`w-full border rounded-xl px-4 py-3 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-amber-400 transition-colors ${
                  errors.name ? "border-red-400" : "border-gray-200"
                }`}
              />
              {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
            </div>

            <div>
              <label className="block text-sm text-gray-800 mb-2" style={{ fontWeight: 600 }}>
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

            <div>
              <label className="block text-sm text-gray-800 mb-2" style={{ fontWeight: 600 }}>
                ระบบพรอมต์ (System Prompt)
              </label>
              <p className="text-xs text-gray-400 mb-3">คำสั่งเบื้องหลังเพื่อกำหนดพฤติกรรม โทนเสียง และขอบเขตการตอบของบอท</p>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="ตัวอย่าง: คุณคือผู้ช่วยอัจฉริยะที่ตอบคำถามด้วยความสุภาพและอ้างอิงข้อมูลจากเอกสารเท่านั้น..."
                rows={6}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 outline-none focus:ring-2 focus:ring-amber-400 resize-none bg-gray-50 font-mono"
              />
            </div>
          </div>
        )}

        {/* Tab 2: Knowledge Base (Documents UI) */}
        {activeTab === "knowledge" && (
          <div className="space-y-6">
            {/* Stats */}
            <div className="flex gap-3 mb-2">
              <div className="text-center bg-white border border-gray-200 rounded-xl px-4 py-2">
                <p className="text-lg text-gray-900" style={{ fontWeight: 700 }}>{readyDocsCount}</p>
                <p className="text-[11px] text-gray-500">พร้อมใช้</p>
              </div>
              {processingDocsCount > 0 && (
                <div className="text-center bg-amber-50 border border-amber-200 rounded-xl px-4 py-2">
                  <p className="text-lg text-amber-600" style={{ fontWeight: 700 }}>{processingDocsCount}</p>
                  <p className="text-[11px] text-amber-500">กำลังประมวลผล</p>
                </div>
              )}
              <div className="text-center bg-gray-50 border border-gray-200 rounded-xl px-4 py-2">
                <p className="text-lg text-gray-900" style={{ fontWeight: 700 }}>{docs.length}</p>
                <p className="text-[11px] text-gray-500">ทั้งหมด</p>
              </div>
            </div>

            {/* Dropzone */}
            <div
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center cursor-pointer transition-all ${
                dragging
                  ? "border-amber-400 bg-amber-50 scale-[1.01]"
                  : "border-gray-300 hover:border-amber-400 hover:bg-amber-50/40 bg-gray-50"
              }`}
            >
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-3 transition-colors ${
                dragging ? "bg-amber-400" : "bg-white border border-gray-200"
              }`}>
                <Upload className={`w-5 h-5 transition-colors ${dragging ? "text-gray-900" : "text-gray-400"}`} />
              </div>
              <p className="text-gray-700 mb-1" style={{ fontWeight: 600 }}>
                {dragging ? "วางไฟล์ที่นี่เลย!" : "ลากไฟล์มาวางที่นี่ หรือ คลิกเพื่อเลือกไฟล์"}
              </p>
              <p className="text-xs text-gray-400">รองรับ PDF, DOC, DOCX, XLSX, CSV, TXT (สูงสุด 10 MB / ไฟล์)</p>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.doc,.docx,.xlsx,.csv,.txt"
                className="hidden"
                onChange={(e) => addFiles(e.target.files)}
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
                {docSearch && (
                  <button onClick={() => setDocSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <div className="flex gap-1.5 flex-wrap">
                {DOC_CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setDocCategory(cat)}
                    className={`text-xs px-3 py-2 rounded-lg transition-colors ${
                      docCategory === cat
                        ? "bg-amber-400 text-gray-900"
                        : "bg-white border border-gray-200 text-gray-600 hover:border-amber-300"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Document List */}
            {filteredDocs.length === 0 ? (
              <div className="bg-white border border-gray-200 rounded-2xl p-10 text-center">
                <FileText className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                <p className="text-sm text-gray-400">ไม่พบเอกสาร</p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredDocs.map((doc) => (
                  <div
                    key={doc.id}
                    className={`bg-white border rounded-xl px-4 py-3.5 flex items-center gap-4 transition-all ${
                      doc.status === "processing" ? "border-amber-200 bg-amber-50/40" : "border-gray-200 hover:border-amber-300"
                    }`}
                  >
                    <FileIcon type={doc.type} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm text-gray-800 truncate" style={{ fontWeight: 500 }}>{doc.name}</p>
                        <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">
                          {doc.category}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1">
                        <p className="text-[11px] text-gray-400">{doc.size} • อัปโหลด {doc.uploadDate}</p>
                        <StatusBadge status={doc.status} />
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        disabled={doc.status !== "ready"}
                        className="p-2 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                        title="ดูตัวอย่าง"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteDoc(doc.id)}
                        className="p-2 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                        title="ลบ"
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
  const [bots, setBots] = useState<BotItem[]>(globalBots);
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"list" | "create" | "edit">("list");
  const [editingBot, setEditingBot] = useState<BotItem | undefined>(undefined);

  useEffect(() => {
    if (forceEditBotId) {
      const bot = bots.find(b => b.id === forceEditBotId);
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
    globalBots = newBots; 
    setView("list");
    setEditingBot(undefined);
  };

  const handleDelete = (id: string) => {
    const newBots = bots.filter((b) => b.id !== id);
    setBots(newBots);
    globalBots = newBots;
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
        onSave={handleSave}
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
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-400">
            <Bot className="w-12 h-12 mb-3 opacity-30" />
            <p className="text-sm">
              {search
                ? "ไม่พบบอทที่ค้นหา"
                : "ยังไม่มีบอท — กดสร้างบอทใหม่เพื่อเริ่มต้น"}
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
                  <div
                    className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${avatarColour(idx)}`}
                  >
                    <Bot className="w-6 h-6 text-white" />
                  </div>
                  <div className="min-w-0">
                    <p
                      className="text-base text-gray-900 truncate"
                      style={{ fontWeight: 600 }}
                    >
                      {bot.name}
                    </p>
                    <p className="text-[11px] text-gray-400 mt-0.5 flex items-center gap-1">
                      <FileText className="w-3 h-3" /> {bot.documents.length} เอกสาร
                    </p>
                  </div>
                </div>

                <p className="text-sm text-gray-500 line-clamp-3 leading-relaxed mb-4 flex-1">
                  {bot.description}
                </p>

                <div className="flex items-center justify-between mt-auto pt-3 border-t border-gray-100">
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
                      title="ตั้งค่า/เอกสาร"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(bot.id);
                      }}
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