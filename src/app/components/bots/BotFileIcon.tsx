import { FileText } from "lucide-react";

const EXT_COLOURS: Record<string, string> = {
  PDF: "bg-red-100 text-red-600",
  DOCX: "bg-blue-100 text-blue-600",
  DOC: "bg-blue-100 text-blue-600",
  XLSX: "bg-green-100 text-green-600",
  TXT: "bg-gray-100 text-gray-600",
  CSV: "bg-green-100 text-green-600",
};

export function BotFileIcon({ filename }: { filename: string }) {
  const ext = filename.split(".").pop()?.toUpperCase() || "FILE";
  const cls = EXT_COLOURS[ext] ?? "bg-gray-100 text-gray-600";

  return (
    <div
      className={`w-11 h-11 rounded-xl flex flex-col items-center justify-center flex-shrink-0 ${cls}`}
    >
      <FileText className="w-5 h-5" />
      <span className="text-[8px] mt-0.5" style={{ fontWeight: 700 }}>
        {ext}
      </span>
    </div>
  );
}
