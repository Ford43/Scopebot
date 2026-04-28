import { useState } from "react";
import {
  Search, Plus, ArrowLeft, Bot, Trash2, Edit2,
  BookOpen, X, Upload,
} from "lucide-react";

/* ─── Types ─── */
interface BotItem {
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

const INITIAL_BOTS: BotItem[] = [
  {
    id: "b1",
    name: "Bot 1",
    description: "ตอบเป็นภาษาไทยเท่านั้น และอ้างข้อมูลจากเอกสารนี้เท่านั้นโดยไม่โกจากแหล่งอื่น",
    systemPrompt: "คุณคือผู้ช่วยอัจฉริยะที่ตอบเฉพาะภาษาไทยจากข้อมูลที่มีเท่านั้น",
    createdAt: "16 เม.ย. 2568",
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

/* ════════════════════════════════════════════════
   Create / Edit form
════════════════════════════════════════════════ */
interface BotFormProps {
  existing?: BotItem;
  onBack: () => void;
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

  const validate = () => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = "กรุณากรอกชื่อบอท";
    setErrors(e);
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
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-white">
      {/* Back bar */}
      <div className="flex items-center gap-2 px-8 py-4 border-b border-gray-100 flex-shrink-0">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
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
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════
   Main Bots Page
════════════════════════════════════════════════ */
export default function BotsPage() {
  const [bots, setBots] = useState<BotItem[]>(INITIAL_BOTS);
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"list" | "create" | "edit">("list");
  const [editingBot, setEditingBot] = useState<BotItem | undefined>(undefined);

  const filtered = bots.filter(
    (b) =>
      b.name.toLowerCase().includes(search.toLowerCase()) ||
      b.description.toLowerCase().includes(search.toLowerCase())
  );

  const handleSave = (bot: BotItem) => {
    setBots((prev) => {
      const idx = prev.findIndex((b) => b.id === bot.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = bot;
        return copy;
      }
      return [...prev, bot];
    });
    setView("list");
    setEditingBot(undefined);
  };

  const handleDelete = (id: string) => {
    setBots((prev) => prev.filter((b) => b.id !== id));
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
        </div>

        <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2 max-w-xs bg-gray-50">
          <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search Models"
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
                : "ยังไม่มีบอท — กด Create bot เพื่อเริ่มต้น"}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((bot, idx) => (
              <div
                key={bot.id}
                className="group relative border border-gray-200 rounded-2xl p-5 hover:border-amber-300 hover:shadow-md hover:shadow-amber-50 transition-all cursor-pointer bg-white"
                onClick={() => handleEdit(bot)}
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
                </div>
              </div>
            ))}

            {/* Create new card */}
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
          </div>
        )}
      </div>
    </div>
  );
}
