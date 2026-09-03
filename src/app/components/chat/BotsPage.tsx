import { useState, useEffect, useCallback } from "react";
import { Search, Plus, Bot, Edit2, X, Clock, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../../contexts/AuthContext";
import { useAdminScope } from "../../contexts/AdminScopeContext";
import { Tooltip, TooltipTrigger, TooltipContent } from "../ui/tooltip";
import type { BotDocument, BotItem } from "../../types/bot";
import { fetchBots } from "../../lib/bots";
import { deleteDocument, fetchLibraryDocuments } from "../../lib/documents";
import { botAvatarColour } from "../../constants/bots";
import { formatBytes } from "../../utils/format";
import { BotFileIcon } from "../bots/BotFileIcon";
import BotForm from "../bots/BotForm";

export type { BotItem } from "../../types/bot";

interface BotsPageProps {
  onSelectBot?: (bot: BotItem) => void;
  forceEditBotId?: string | null;
  forceEditReason?: string | null;
  onClearForceEdit?: () => void;
  initialSearch?: string;
}

export default function BotsPage({
  onSelectBot,
  forceEditBotId,
  forceEditReason,
  onClearForceEdit,
  initialSearch = "",
}: BotsPageProps = {}) {
  const [bots, setBots] = useState<BotItem[]>([]);
  const [libraryDocs, setLibraryDocs] = useState<BotDocument[]>([]);
  const [search, setSearch] = useState(initialSearch);
  const [view, setView] = useState<"list" | "create" | "edit">("list");
  const [editingBot, setEditingBot] = useState<BotItem | undefined>();
  const [editNotice, setEditNotice] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuth();
  const { scopeParam } = useAdminScope();

  const maxBots = user?.max_bots || 5;
  const ownBotCount = bots.filter(
    (b) => Number(b.owner_id) === Number(user?.id)
  ).length;
  const isLimitReached = ownBotCount >= maxBots;

  const loadBots = useCallback(async () => {
    setIsLoading(true);
    try {
      const [botData, docs] = await Promise.all([
        fetchBots(scopeParam),
        fetchLibraryDocuments().catch(() => [] as BotDocument[]),
      ]);
      setBots(botData);
      setLibraryDocs(docs);
    } catch (error) {
      console.error("Fetch bots error", error);
    } finally {
      setIsLoading(false);
    }
  }, [scopeParam]);

  useEffect(() => {
    loadBots();
  }, [loadBots]);

  useEffect(() => {
    if (initialSearch !== undefined) setSearch(initialSearch);
  }, [initialSearch]);

  useEffect(() => {
    if (forceEditBotId && bots.length > 0) {
      const bot = bots.find((b) => b.bot_id === forceEditBotId);
      if (bot) {
        setEditingBot(bot);
        setView("edit");
        if (forceEditReason) setEditNotice(forceEditReason);
      }
      onClearForceEdit?.();
    }
  }, [forceEditBotId, forceEditReason, bots, onClearForceEdit]);

  const filtered = bots.filter(
    (b) =>
      b.name.toLowerCase().includes(search.toLowerCase()) ||
      b.description?.toLowerCase().includes(search.toLowerCase())
  );

  const openCreate = () => {
    if (isLimitReached) return;
    setEditingBot(undefined);
    setView("create");
  };

  const handleEdit = (bot: BotItem) => {
    setEditNotice(null);
    setEditingBot(bot);
    setView("edit");
  };

  const backToList = () => {
    setView("list");
    setEditingBot(undefined);
    setEditNotice(null);
  };

  if (view === "create" || view === "edit") {
    return (
      <BotForm
        existing={editingBot}
        onBack={() => {
          backToList();
          loadBots();
        }}
        onSaveSuccess={(options) => {
          loadBots();
          if (options?.leave) backToList();
        }}
        onBotCreated={(bot) => {
          setEditingBot(bot);
          setView("edit");
        }}
        statusNotice={view === "edit" ? editNotice : null}
        onDismissNotice={() => setEditNotice(null)}
      />
    );
  }

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="px-8 pt-7 pb-4 flex-shrink-0">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl text-gray-900" style={{ fontWeight: 700 }}>
            จัดการบอท
          </h1>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-block">
                <button
                  onClick={openCreate}
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
              <TooltipContent
                side="bottom"
                className="bg-slate-800 text-white border-none px-3 py-2 text-xs"
              >
                <p>
                  ⚠️ คุณสร้างบอทครบขีดจำกัด ({maxBots} ตัว) แล้ว
                </p>
              </TooltipContent>
            )}
          </Tooltip>
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

      <div className="flex-1 overflow-y-auto px-8 pb-8">
        {isLoading ? (
          <div className="flex items-center justify-center h-64 text-gray-400">
            <Clock className="w-8 h-8 animate-spin text-amber-400" />
          </div>
        ) : filtered.length === 0 ? (
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
                key={bot.bot_id}
                className="group relative border border-gray-200 rounded-2xl p-5 hover:border-amber-300 hover:shadow-md hover:shadow-amber-50 transition-all cursor-pointer bg-white flex flex-col h-full"
                onClick={() =>
                  onSelectBot ? onSelectBot(bot) : handleEdit(bot)
                }
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3 min-w-0 pr-4">
                    <div
                      className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${botAvatarColour(idx)}`}
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
                      <p className="text-[11px] text-gray-400 mt-0.5">
                        สถานะ:{" "}
                        <span
                          className={
                            bot.status === "active"
                              ? "text-green-600"
                              : bot.status === "processing"
                                ? "text-amber-600"
                                : "text-gray-500"
                          }
                        >
                          {bot.status === "active"
                            ? "พร้อมใช้งาน"
                            : bot.status === "processing"
                              ? "กำลังประมวลผล"
                              : "ยังไม่พร้อม"}
                        </span>
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEdit(bot);
                    }}
                    className="flex-shrink-0 p-2 bg-amber-50 hover:bg-amber-100 text-amber-600 rounded-lg transition-colors border border-amber-200 shadow-sm"
                    title="ตั้งค่า/เอกสาร"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                </div>

                <p className="text-sm text-gray-500 line-clamp-3 leading-relaxed mb-4 flex-1">
                  {bot.description || "ไม่มีคำอธิบาย"}
                </p>

                <div className="mt-auto pt-3 border-t border-gray-100">
                  <span className="text-[10px] text-gray-400">
                    สร้างเมื่อ{" "}
                    {new Date(bot.created_at).toLocaleDateString("th-TH")}
                  </span>
                </div>
              </div>
            ))}

            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={openCreate}
                  disabled={isLimitReached}
                  className={`border-2 border-dashed rounded-2xl p-5 transition-all flex flex-col items-center justify-center gap-2 min-h-[180px] ${
                    isLimitReached
                      ? "border-slate-200 bg-slate-50 text-slate-300 cursor-not-allowed"
                      : "border-gray-200 hover:border-amber-300 hover:bg-amber-50/30 text-gray-400 hover:text-amber-500"
                  }`}
                >
                  <div
                    className={`w-12 h-12 rounded-xl flex items-center justify-center mb-1 ${isLimitReached ? "bg-slate-100" : "bg-gray-100"}`}
                  >
                    <Plus
                      className={`w-6 h-6 ${isLimitReached ? "text-slate-300" : ""}`}
                    />
                  </div>
                  <span className="text-sm" style={{ fontWeight: 600 }}>
                    สร้างบอทใหม่
                  </span>
                  <span className="text-xs px-4 text-center">
                    {isLimitReached
                      ? `เต็มโควต้า ${maxBots} บอทแล้ว`
                      : "เพิ่ม Workspace อิสระสำหรับธุรกิจ"}
                  </span>
                </button>
              </TooltipTrigger>
              {isLimitReached && (
                <TooltipContent
                  side="top"
                  className="bg-slate-800 text-white border-none px-3 py-2 text-xs"
                >
                  <p>
                    ⚠️ คุณสร้างบอทครบขีดจำกัด ({maxBots} ตัว) แล้ว
                  </p>
                </TooltipContent>
              )}
            </Tooltip>
          </div>
        )}

        {libraryDocs.length > 0 && (
          <div className="mt-10 pb-4">
            <div className="flex items-end justify-between gap-3 mb-3">
              <div>
                <h2 className="text-sm text-gray-900" style={{ fontWeight: 700 }}>
                  คลังเอกสาร
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  ไฟล์ที่อัปโหลดไว้ทั้งหมด — ถ้ายังไม่ผูกบอท จะไม่ถูกหั่นเข้าฐานความรู้
                </p>
              </div>
              <span className="text-xs text-gray-400">{libraryDocs.length} ไฟล์</span>
            </div>
            <div className="space-y-2">
              {libraryDocs.map((doc) => {
                const usedBy = doc.assigned_bots ?? [];
                return (
                  <div
                    key={doc.id}
                    className="bg-white border border-gray-200 rounded-xl px-4 py-3 flex items-center gap-3"
                  >
                    <BotFileIcon filename={doc.filename} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-gray-800 truncate" style={{ fontWeight: 500 }}>
                        {doc.filename}
                      </p>
                      <p className="text-[11px] text-gray-400 mt-0.5">
                        {formatBytes(doc.file_size)} · {doc.category || "ทั่วไป"}
                        {usedBy.length > 0
                          ? ` · ใช้กับบอท: ${usedBy.join(", ")}`
                          : " · ยังไม่ผูกบอท"}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={async (e) => {
                        e.stopPropagation();
                        const msg =
                          usedBy.length > 0
                            ? `ลบ "${doc.filename}" จากคลัง? บอทที่ใช้อยู่จะไม่มีไฟล์นี้`
                            : `ลบ "${doc.filename}" ออกจากคลัง?`;
                        if (!window.confirm(msg)) return;
                        try {
                          await deleteDocument(doc.id);
                          setLibraryDocs((prev) => prev.filter((d) => d.id !== doc.id));
                          try {
                            const botData = await fetchBots(scopeParam);
                            setBots(botData);
                          } catch {
                            /* status refresh is best-effort */
                          }
                          toast.success("ลบไฟล์จากคลังแล้ว");
                        } catch (error) {
                          toast.error(
                            error instanceof Error ? error.message : "ลบไฟล์ไม่สำเร็จ"
                          );
                        }
                      }}
                      className="p-2 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-500"
                      title="ลบออกจากคลัง"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
