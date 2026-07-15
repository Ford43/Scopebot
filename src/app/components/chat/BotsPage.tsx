import { useState, useEffect, useCallback } from "react";
import { Search, Plus, Bot, Edit2, X, Clock } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { Tooltip, TooltipTrigger, TooltipContent } from "../ui/tooltip";
import type { BotItem } from "../../types/bot";
import { fetchBots } from "../../lib/bots";
import { botAvatarColour } from "../../constants/bots";
import BotForm from "../bots/BotForm";

export type { BotItem } from "../../types/bot";

interface BotsPageProps {
  onSelectBot?: (bot: BotItem) => void;
  forceEditBotId?: string | null;
  onClearForceEdit?: () => void;
}

export default function BotsPage({
  onSelectBot,
  forceEditBotId,
  onClearForceEdit,
}: BotsPageProps = {}) {
  const [bots, setBots] = useState<BotItem[]>([]);
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"list" | "create" | "edit">("list");
  const [editingBot, setEditingBot] = useState<BotItem | undefined>();
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuth();

  const maxBots = user?.max_bots || 5;
  const isLimitReached = bots.length >= maxBots;

  const loadBots = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await fetchBots();
      setBots(data);
    } catch (error) {
      console.error("Fetch bots error", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBots();
  }, [loadBots]);

  useEffect(() => {
    if (forceEditBotId && bots.length > 0) {
      const bot = bots.find((b) => b.bot_id === forceEditBotId);
      if (bot) {
        setEditingBot(bot);
        setView("edit");
      }
      onClearForceEdit?.();
    }
  }, [forceEditBotId, bots, onClearForceEdit]);

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
    setEditingBot(bot);
    setView("edit");
  };

  const backToList = () => {
    setView("list");
    setEditingBot(undefined);
  };

  if (view === "create" || view === "edit") {
    return (
      <BotForm
        existing={editingBot}
        onBack={backToList}
        onSaveSuccess={() => {
          backToList();
          loadBots();
        }}
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
                              ? "text-green-500"
                              : "text-amber-500"
                          }
                        >
                          {bot.status.toUpperCase()}
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
      </div>
    </div>
  );
}
