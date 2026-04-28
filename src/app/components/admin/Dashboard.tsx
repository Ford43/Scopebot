import { useState, useRef, useCallback } from "react";
import { MessageSquare, Clock, FileText, Upload, X, CheckCircle, AlertCircle, Loader } from "lucide-react";
import { Card } from "../ui/card";

const stats = [
  { id: "1", label: "แชททั้งหมด", value: "128", icon: MessageSquare },
  { id: "2", label: "รอเจ้าหน้าที่ตอบ", value: "3", icon: Clock, alert: true },
  { id: "3", label: "ไฟล์เอกสาร", value: "15", icon: FileText },
];

type FileStatus = "pending" | "uploading" | "success" | "error";

interface UploadFile {
  id: string;
  file: File;
  status: FileStatus;
  progress: number;
  error?: string;
}

const ALLOWED_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "text/csv",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];

const ALLOWED_EXT = [".pdf", ".doc", ".docx", ".txt", ".csv", ".xls", ".xlsx"];

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileIcon(name: string) {
  const ext = name.split(".").pop()?.toLowerCase();
  if (ext === "pdf") return "📄";
  if (["doc", "docx"].includes(ext ?? "")) return "📝";
  if (["xls", "xlsx", "csv"].includes(ext ?? "")) return "📊";
  return "📁";
}

export default function Dashboard() {
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = (incoming: FileList | null) => {
    if (!incoming) return;
    const newFiles: UploadFile[] = [];
    Array.from(incoming).forEach((file) => {
      const allowed =
        ALLOWED_TYPES.includes(file.type) ||
        ALLOWED_EXT.some((ext) => file.name.toLowerCase().endsWith(ext));
      newFiles.push({
        id: `${Date.now()}-${Math.random()}`,
        file,
        status: allowed ? "pending" : "error",
        progress: 0,
        error: allowed ? undefined : "ประเภทไฟล์ไม่รองรับ",
      });
    });
    setFiles((prev) => [...prev, ...newFiles]);
  };

  const simulateUpload = (id: string) => {
    setFiles((prev) =>
      prev.map((f) => (f.id === id ? { ...f, status: "uploading", progress: 0 } : f))
    );
    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.floor(Math.random() * 20) + 10;
      if (progress >= 100) {
        clearInterval(interval);
        setFiles((prev) =>
          prev.map((f) => (f.id === id ? { ...f, status: "success", progress: 100 } : f))
        );
      } else {
        setFiles((prev) =>
          prev.map((f) => (f.id === id ? { ...f, progress } : f))
        );
      }
    }, 300);
  };

  const handleUploadAll = () => {
    files
      .filter((f) => f.status === "pending")
      .forEach((f) => simulateUpload(f.id));
  };

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    addFiles(e.dataTransfer.files);
  }, []);

  const onDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const onDragLeave = () => setIsDragging(false);

  const pendingCount = files.filter((f) => f.status === "pending").length;
  const successCount = files.filter((f) => f.status === "success").length;

  return (
    <div>
      <h1 className="mb-6">ภาพรวมระบบ (Overview)</h1>

      {/* Statistics cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card
              key={stat.id}
              className="p-6 border-2 border-amber-200 hover:border-amber-400 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm mb-2">{stat.label}</p>
                  <div className="flex items-center gap-2">
                    <p className="text-3xl font-bold">{stat.value}</p>
                    {stat.alert && <span className="text-red-500 text-xl">🔴</span>}
                  </div>
                </div>
                <div className="w-12 h-12 bg-amber-400 rounded-lg flex items-center justify-center">
                  <Icon className="w-6 h-6 text-gray-900" />
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Upload area */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2>อัปโหลดฐานข้อมูลเอกสาร (Knowledge Base)</h2>
          {pendingCount > 0 && (
            <button
              onClick={handleUploadAll}
              className="flex items-center gap-2 px-4 py-2 bg-amber-400 hover:bg-amber-500 text-gray-900 rounded-lg text-sm transition-colors"
              style={{ fontWeight: 600 }}
            >
              <Upload className="w-4 h-4" />
              อัปโหลดทั้งหมด ({pendingCount})
            </button>
          )}
        </div>

        {/* Drop zone */}
        <Card
          className={`border-2 border-dashed transition-colors cursor-pointer ${
            isDragging
              ? "border-amber-500 bg-amber-50"
              : "border-gray-300 hover:border-amber-400 bg-white"
          }`}
          onClick={() => inputRef.current?.click()}
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
        >
          <div className="flex flex-col items-center justify-center text-center py-12 px-6">
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4 transition-colors ${isDragging ? "bg-amber-400" : "bg-gray-100"}`}>
              <Upload className={`w-8 h-8 ${isDragging ? "text-gray-900" : "text-gray-400"}`} />
            </div>
            <p className="text-gray-700 mb-1">
              ลากไฟล์มาวางที่นี่ หรือ <span className="text-amber-600 underline" style={{ fontWeight: 600 }}>คลิกเพื่อเลือกไฟล์</span>
            </p>
            <p className="text-xs text-gray-400 mt-1">
              รองรับ: PDF, DOC, DOCX, TXT, CSV, XLS, XLSX (สูงสุด 20 MB ต่อไฟล์)
            </p>
          </div>
        </Card>

        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ALLOWED_EXT.join(",")}
          className="hidden"
          onChange={(e) => addFiles(e.target.files)}
        />

        {/* File list */}
        {files.length > 0 && (
          <div className="mt-4 space-y-2">
            {successCount > 0 && (
              <div className="flex items-center gap-2 text-green-600 text-xs mb-2">
                <CheckCircle className="w-3.5 h-3.5" />
                อัปโหลดสำเร็จ {successCount} ไฟล์
              </div>
            )}
            {files.map((f) => (
              <div
                key={f.id}
                className="flex items-center gap-3 bg-white border border-gray-200 rounded-xl px-4 py-3 shadow-sm"
              >
                <span className="text-2xl flex-shrink-0">{fileIcon(f.file.name)}</span>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm text-gray-800 truncate">{f.file.name}</p>
                    <span className="text-xs text-gray-400 ml-2 flex-shrink-0">{formatSize(f.file.size)}</span>
                  </div>

                  {f.status === "uploading" && (
                    <div className="w-full bg-gray-100 rounded-full h-1.5">
                      <div
                        className="bg-amber-400 h-1.5 rounded-full transition-all duration-300"
                        style={{ width: `${f.progress}%` }}
                      />
                    </div>
                  )}
                  {f.status === "error" && (
                    <p className="text-xs text-red-500 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" /> {f.error}
                    </p>
                  )}
                  {f.status === "success" && (
                    <p className="text-xs text-green-500 flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" /> อัปโหลดสำเร็จ
                    </p>
                  )}
                  {f.status === "pending" && (
                    <p className="text-xs text-gray-400">รอการอัปโหลด</p>
                  )}
                </div>

                {/* Status icon / action */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  {f.status === "uploading" && (
                    <Loader className="w-4 h-4 text-amber-500 animate-spin" />
                  )}
                  {f.status === "success" && (
                    <CheckCircle className="w-4 h-4 text-green-500" />
                  )}
                  {f.status === "error" && (
                    <AlertCircle className="w-4 h-4 text-red-400" />
                  )}
                  {f.status === "pending" && (
                    <button
                      onClick={(e) => { e.stopPropagation(); simulateUpload(f.id); }}
                      className="text-xs bg-amber-400 hover:bg-amber-500 text-gray-900 px-2.5 py-1 rounded-lg transition-colors"
                      style={{ fontWeight: 600 }}
                    >
                      อัปโหลด
                    </button>
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); removeFile(f.id); }}
                    className="p-1 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-400 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
