import { useState, useRef, useCallback } from "react";
import {
  FileText,
  Upload,
  Trash2,
  Download,
  Search,
  Eye,
  CheckCircle,
  Clock,
  AlertCircle,
  X,
} from "lucide-react";

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

const initialDocs: Doc[] = [
  { id: "1", name: "ระเบียบการลางาน.pdf",       size: "2.3 MB",  rawSize: 2411724,  uploadDate: "15 ก.พ. 2569", type: "PDF",  status: "ready",      category: "HR Policy" },
  { id: "2", name: "คู่มือพนักงานใหม่.pdf",      size: "5.1 MB",  rawSize: 5349888,  uploadDate: "10 ก.พ. 2569", type: "PDF",  status: "ready",      category: "Onboarding" },
  { id: "3", name: "นโยบายบริษัท.pdf",           size: "1.8 MB",  rawSize: 1887437,  uploadDate: "5 ก.พ. 2569",  type: "PDF",  status: "ready",      category: "Policy" },
  { id: "4", name: "ขั้นตอน IT Support.docx",    size: "0.9 MB",  rawSize: 943718,   uploadDate: "1 ก.พ. 2569",  type: "DOCX", status: "processing", category: "IT" },
];

const CATEGORIES = ["ทั้งหมด", "HR Policy", "Onboarding", "Policy", "IT"];

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function today(): string {
  return new Date().toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" }).replace(/\d{4}/, (y) => String(Number(y) + 543));
}

/* ── Status badge ── */
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

/* ── File type icon color ── */
function FileIcon({ type }: { type: string }) {
  const colors: Record<string, string> = {
    PDF:  "bg-red-100 text-red-600",
    DOCX: "bg-blue-100 text-blue-600",
    DOC:  "bg-blue-100 text-blue-600",
    XLSX: "bg-green-100 text-green-600",
    TXT:  "bg-gray-100 text-gray-600",
  };
  const cls = colors[type] ?? "bg-gray-100 text-gray-600";
  return (
    <div className={`w-11 h-11 rounded-xl flex flex-col items-center justify-center flex-shrink-0 ${cls}`}>
      <FileText className="w-5 h-5" />
      <span className="text-[8px] mt-0.5" style={{ fontWeight: 700 }}>{type}</span>
    </div>
  );
}

export default function Documents() {
  const [docs, setDocs]               = useState<Doc[]>(initialDocs);
  const [search, setSearch]           = useState("");
  const [category, setCategory]       = useState("ทั้งหมด");
  const [dragging, setDragging]       = useState(false);
  const [uploading, setUploading]     = useState<string[]>([]);
  const fileInputRef                  = useRef<HTMLInputElement>(null);

  /* Filter */
  const filtered = docs.filter((d) => {
    const matchSearch = d.name.toLowerCase().includes(search.toLowerCase());
    const matchCat    = category === "ทั้งหมด" || d.category === category;
    return matchSearch && matchCat;
  });

  /* Handle files */
  const addFiles = useCallback((files: FileList | null) => {
    if (!files || files.length === 0) return;
    const newFiles: Doc[] = [];
    const ids: string[] = [];

    Array.from(files).forEach((file) => {
      const id = Date.now().toString() + Math.random().toString(36).slice(2);
      const ext = file.name.split(".").pop()?.toUpperCase() ?? "FILE";
      const doc: Doc = {
        id,
        name: file.name,
        size: formatBytes(file.size),
        rawSize: file.size,
        uploadDate: today(),
        type: ext,
        status: "processing",
        category: "Uncategorized",
      };
      newFiles.push(doc);
      ids.push(id);
    });

    setDocs((prev) => [...newFiles, ...prev]);
    setUploading((prev) => [...prev, ...ids]);

    // simulate processing → ready
    ids.forEach((id) => {
      setTimeout(() => {
        setDocs((prev) => prev.map((d) => (d.id === id ? { ...d, status: "ready" } : d)));
        setUploading((prev) => prev.filter((u) => u !== id));
      }, 2500 + Math.random() * 1500);
    });
  }, []);

  /* Drag & drop handlers */
  const onDragOver  = (e: React.DragEvent) => { e.preventDefault(); setDragging(true);  };
  const onDragLeave = (e: React.DragEvent) => { e.preventDefault(); setDragging(false); };
  const onDrop      = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    addFiles(e.dataTransfer.files);
  };

  const handleDelete = (id: string) => setDocs((prev) => prev.filter((d) => d.id !== id));

  const ready      = docs.filter((d) => d.status === "ready").length;
  const processing = docs.filter((d) => d.status === "processing").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-gray-900">จัดการเอกสาร</h1>
          <p className="text-sm text-gray-500 mt-0.5">อัปโหลดเอกสารเพื่อฝึก AI ให้ตอบคำถามได้แม่นยำขึ้น</p>
        </div>
        <div className="flex gap-3">
          <div className="text-center bg-white border border-gray-200 rounded-xl px-4 py-2.5">
            <p className="text-lg text-gray-900" style={{ fontWeight: 700 }}>{ready}</p>
            <p className="text-[11px] text-gray-500">พร้อมใช้</p>
          </div>
          {processing > 0 && (
            <div className="text-center bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5">
              <p className="text-lg text-amber-600" style={{ fontWeight: 700 }}>{processing}</p>
              <p className="text-[11px] text-amber-500">กำลังประมวลผล</p>
            </div>
          )}
          <div className="text-center bg-white border border-gray-200 rounded-xl px-4 py-2.5">
            <p className="text-lg text-gray-900" style={{ fontWeight: 700 }}>{docs.length}</p>
            <p className="text-[11px] text-gray-500">ทั้งหมด</p>
          </div>
        </div>
      </div>

      {/* Upload area */}
      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-2xl p-10 flex flex-col items-center justify-center cursor-pointer transition-all ${
          dragging
            ? "border-amber-400 bg-amber-50 scale-[1.01]"
            : "border-gray-300 hover:border-amber-400 hover:bg-amber-50/40 bg-white"
        }`}
      >
        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-4 transition-colors ${
          dragging ? "bg-amber-400" : "bg-gray-100"
        }`}>
          <Upload className={`w-7 h-7 transition-colors ${dragging ? "text-gray-900" : "text-gray-400"}`} />
        </div>
        <p className="text-gray-700 mb-1" style={{ fontWeight: 600 }}>
          {dragging ? "วางไฟล์ที่นี่เลย!" : "ลากไฟล์มาวางที่นี่ หรือ คลิกเพื่อเลือกไฟล์"}
        </p>
        <p className="text-sm text-gray-400">รองรับ PDF, DOC, TXT (สูงสุด 10 MB / ไฟล์)</p>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
          className="mt-4 bg-amber-400 hover:bg-amber-500 text-gray-900 text-sm px-5 py-2 rounded-xl transition-colors"
          style={{ fontWeight: 600 }}
        >
          เลือกไฟล์
        </button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.doc,.docx,.xlsx,.txt"
          className="hidden"
          onChange={(e) => addFiles(e.target.files)}
        />
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ค้นหาเอกสาร..."
            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg bg-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Category filter */}
        <div className="flex gap-1.5 flex-wrap">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${
                category === cat
                  ? "bg-amber-400 text-gray-900"
                  : "bg-white border border-gray-200 text-gray-600 hover:border-amber-300"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Document list */}
      <div>
        <h2 className="text-gray-900 mb-3 text-sm" style={{ fontWeight: 600 }}>
          เอกสารที่อัปโหลด
          <span className="ml-2 text-gray-400" style={{ fontWeight: 400 }}>({filtered.length} รายการ)</span>
        </h2>

        {filtered.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center">
            <FileText className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-400">ไม่พบเอกสารที่ค้นหา</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((doc) => (
              <div
                key={doc.id}
                className={`bg-white border rounded-xl px-4 py-3.5 flex items-center gap-4 transition-all ${
                  doc.status === "processing" ? "border-amber-200 bg-amber-50/40" : "border-gray-200 hover:border-amber-300 hover:shadow-sm"
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

                {/* Actions */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    disabled={doc.status !== "ready"}
                    className="p-2 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    title="ดูตัวอย่าง"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  <button
                    disabled={doc.status !== "ready"}
                    className="p-2 rounded-lg text-gray-400 hover:bg-amber-50 hover:text-amber-600 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    title="ดาวน์โหลด"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(doc.id)}
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

      {/* Info strip */}
      <div className="bg-gray-900 rounded-xl px-5 py-4 flex items-center gap-4">
        <div className="w-8 h-8 bg-amber-400 rounded-lg flex items-center justify-center flex-shrink-0">
          <FileText className="w-4 h-4 text-gray-900" />
        </div>
        <div className="flex-1">
          <p className="text-sm text-white" style={{ fontWeight: 600 }}>AI ประมวลผลเอกสารอัตโนมัติ</p>
          <p className="text-xs text-gray-400 mt-0.5">หลังอัปโหลด ระบบจะสกัดข้อมูลและฝึก AI ให้ตอบคำถามจากเอกสารของคุณได้ทันที</p>
        </div>
        <span className="text-xs text-amber-400 flex-shrink-0">{ready} ไฟล์พร้อมแล้ว</span>
      </div>
    </div>
  );
}
