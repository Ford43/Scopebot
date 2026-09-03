import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ExternalLink,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { toast } from "sonner";
import type { BotItem } from "../../types/bot";
import { fetchBots, toggleBotLine, updateBot } from "../../lib/bots";
import { useAdminScope } from "../../contexts/AdminScopeContext";

const LineIcon = () => (
  <svg
    viewBox="0 0 40 40"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className="w-full h-full"
  >
    <rect width="40" height="40" rx="10" fill="#06C755" />
    <path
      d="M33 18.8c0-6.1-6.1-11-13.7-11S5.6 12.7 5.6 18.8c0 5.4 4.8 10 11.3 10.9.4.1 1 .3 1.2.7.2.3.1.9.1.9l-.2 1.2c-.1.4-.3 1.5 1.3.8 1.6-.7 8.5-5 11.6-8.6A9.7 9.7 0 0 0 33 18.8z"
      fill="white"
    />
    <path
      d="M27.4 22.3h-3.7a.3.3 0 0 1-.3-.3v-5.8c0-.2.1-.3.3-.3h3.7c.2 0 .3.1.3.3v.9c0 .2-.1.3-.3.3h-2.5v.9h2.5c.2 0 .3.1.3.3v.9c0 .2-.1.3-.3.3h-2.5v.9h2.5c.2 0 .3.1.3.3v.9c0 .2-.1.3-.3.3zM15.4 22.3a.3.3 0 0 0 .3-.3v-.9a.3.3 0 0 0-.3-.3h-2.5V16c0-.2-.1-.3-.3-.3h-.9c-.2 0-.3.1-.3.3v6c0 .2.1.3.3.3h3.7zM17.6 15.7h-.9c-.2 0-.3.1-.3.3v6c0 .2.1.3.3.3h.9c.2 0 .3-.1.3-.3V16c0-.2-.1-.3-.3-.3zM22.4 15.7h-.9c-.2 0-.3.1-.3.3v3.6l-2.7-3.7a.3.3 0 0 0-.3-.2h-.9c-.2 0-.3.1-.3.3v6c0 .2.1.3.3.3h.9c.2 0 .3-.1.3-.3V18l2.7 3.7c0 .1.2.2.3.2h.9c.2 0 .3-.1.3-.3V16c0-.2-.1-.3-.3-.3z"
      fill="#06C755"
    />
  </svg>
);

function Toggle({
  enabled,
  onToggle,
  disabled,
}: {
  enabled: boolean;
  onToggle: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onToggle}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none disabled:opacity-50 ${
        enabled ? "bg-amber-400" : "bg-gray-300"
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-md transition-transform ${
          enabled ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(true);
    toast.success("คัดลอกแล้ว");
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      type="button"
      onClick={handleCopy}
      className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
      title="คัดลอก"
    >
      {copied ? (
        <Check className="w-3.5 h-3.5 text-green-500" />
      ) : (
        <Copy className="w-3.5 h-3.5" />
      )}
    </button>
  );
}

function CodeBlock({ code }: { code: string }) {
  return (
    <div className="bg-gray-900 rounded-lg px-4 py-3 flex items-start justify-between gap-2">
      <code className="text-xs text-green-400 font-mono break-all flex-1">
        {code}
      </code>
      <CopyButton text={code} />
    </div>
  );
}

function LineConfigPanel({
  bot,
  onSaved,
}: {
  bot: BotItem;
  onSaved: (bot: BotItem) => void;
}) {
  const [channelToken, setChannelToken] = useState("");
  const [channelSecret, setChannelSecret] = useState("");
  const [saving, setSaving] = useState(false);

  const webhookUrl = useMemo(() => {
    const origin =
      typeof window !== "undefined" ? window.location.origin : "https://YOUR_DOMAIN";
    return `${origin}/api/line/webhook/${bot.bot_id}`;
  }, [bot.bot_id]);

  const handleSave = async () => {
    if (!channelToken.trim() || !channelSecret.trim()) {
      toast.error("กรุณากรอก Channel Access Token และ Channel Secret");
      return;
    }
    setSaving(true);
    try {
      const updated = await updateBot(bot.bot_id, {
        line_channel_token: channelToken.trim(),
        line_channel_secret: channelSecret.trim(),
      });
      onSaved(updated);
      setChannelToken("");
      setChannelSecret("");
      toast.success("บันทึก LINE credentials เรียบร้อย");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "บันทึกไม่สำเร็จ"
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-4 space-y-4 border-t border-gray-100 pt-4">
      <div>
        <p className="text-xs text-gray-500 mb-1.5">
          Webhook URL (ตั้งใน LINE Developers Console)
        </p>
        <CodeBlock code={webhookUrl} />
        <p className="text-[11px] text-gray-400 mt-1.5">
          หาก deploy แล้ว ให้ใช้โดเมนสาธารณะแทน localhost
        </p>
      </div>

      <div className="space-y-2">
        {[
          {
            step: "1",
            title: "สร้าง LINE Official Account",
            desc: "ไปที่ LINE Developers Console และสร้าง Messaging API Channel",
          },
          {
            step: "2",
            title: "รับ Credentials",
            desc: "คัดลอก Channel Access Token และ Channel Secret",
          },
          {
            step: "3",
            title: "วาง Webhook URL ด้านบน",
            desc: "Messaging API → Webhook settings → ใส่ URL แล้ว Verify",
          },
        ].map((s) => (
          <div
            key={s.step}
            className="flex gap-3 bg-gray-50 rounded-lg px-3 py-2.5"
          >
            <div
              className="w-5 h-5 rounded-full bg-green-100 text-green-700 text-[10px] flex items-center justify-center flex-shrink-0 mt-0.5"
              style={{ fontWeight: 700 }}
            >
              {s.step}
            </div>
            <div>
              <p className="text-xs text-gray-700" style={{ fontWeight: 600 }}>
                {s.title}
              </p>
              <p className="text-[11px] text-gray-500 mt-0.5">{s.desc}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-3">
        <div>
          <label className="block text-xs text-gray-600 mb-1">
            Channel Access Token
          </label>
          <input
            type="password"
            value={channelToken}
            onChange={(e) => setChannelToken(e.target.value)}
            placeholder="วาง Channel Access Token ที่นี่..."
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs bg-gray-50 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-600 mb-1">
            Channel Secret
          </label>
          <input
            type="password"
            value={channelSecret}
            onChange={(e) => setChannelSecret(e.target.value)}
            placeholder="วาง Channel Secret ที่นี่..."
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs bg-gray-50 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
          />
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="w-full py-2 rounded-lg text-xs bg-amber-400 hover:bg-amber-500 text-gray-900 disabled:opacity-50"
          style={{ fontWeight: 600 }}
        >
          {saving ? "กำลังบันทึก..." : "บันทึก Credentials"}
        </button>
      </div>
    </div>
  );
}

export default function Integration() {
  const [bots, setBots] = useState<BotItem[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const { scopeParam } = useAdminScope();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchBots(scopeParam);
      setBots(data);
      setSelectedId((prev) => {
        if (prev && data.some((b) => b.bot_id === prev)) return prev;
        return data[0]?.bot_id || "";
      });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "โหลดรายการบอทไม่สำเร็จ"
      );
    } finally {
      setLoading(false);
    }
  }, [scopeParam]);

  useEffect(() => {
    load();
  }, [load]);

  const bot = bots.find((b) => b.bot_id === selectedId) ?? null;
  const lineOn = !!bot?.is_line_connected;

  const patchBot = (updated: BotItem) => {
    setBots((prev) =>
      prev.map((b) => (b.bot_id === updated.bot_id ? { ...b, ...updated } : b))
    );
  };

  const handleToggleLine = async () => {
    if (!bot) return;
    setToggling(true);
    try {
      const next = await toggleBotLine(bot.bot_id);
      patchBot({ ...bot, is_line_connected: next });
      toast.success(next ? "เปิดการเชื่อมต่อ LINE แล้ว" : "ปิดการเชื่อมต่อ LINE แล้ว");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "สลับ LINE ไม่สำเร็จ"
      );
    } finally {
      setToggling(false);
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-gray-900">การเชื่อมต่อ</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          เชื่อมต่อบอทกับ LINE Official Account เพื่อรับข้อความจากลูกค้า
        </p>
      </div>

      <div className="mb-5 max-w-md">
        <label className="block text-xs text-gray-600 mb-1.5">เลือกบอท</label>
        <select
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          disabled={loading || bots.length === 0}
          className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
        >
          {bots.length === 0 ? (
            <option value="">ยังไม่มีบอท — สร้างบอทก่อน</option>
          ) : (
            bots.map((b) => (
              <option key={b.bot_id} value={b.bot_id}>
                {b.name} ({b.bot_id})
              </option>
            ))
          )}
        </select>
      </div>

      {!bot ? (
        <div className="bg-white border border-gray-200 rounded-xl p-10 text-center text-sm text-gray-400">
          {loading ? "กำลังโหลด..." : "สร้างบอทก่อน แล้วค่อยตั้งค่าการเชื่อมต่อ"}
        </div>
      ) : (
        <div className="max-w-2xl">
          <div
            className={`bg-white border rounded-xl shadow-sm overflow-hidden ${
              lineOn ? "border-amber-300" : "border-gray-200"
            }`}
          >
            <div className="p-5">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl overflow-hidden flex-shrink-0">
                    <LineIcon />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span
                        className="text-sm text-gray-900"
                        style={{ fontWeight: 600 }}
                      >
                        LINE Official Account
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-100 text-green-700">
                        Messaging
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      ตอบคำถามผ่าน LINE OA ของบอทนี้
                    </p>
                  </div>
                </div>
                <Toggle
                  enabled={lineOn}
                  disabled={toggling}
                  onToggle={handleToggleLine}
                />
              </div>

              {lineOn ? (
                <div className="mt-3 flex items-center gap-1.5 text-xs text-green-600 bg-green-50 rounded-lg px-3 py-1.5">
                  <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                  เปิดใช้งานแล้ว — อย่าลืมบันทึก Token/Secret
                </div>
              ) : (
                <div className="mt-3 text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-1.5">
                  ยังไม่ได้เปิด — webhook จะไม่รับข้อความ
                </div>
              )}

              <div className="flex items-center gap-2 mt-4 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setExpanded((v) => !v)}
                  className="flex items-center gap-1.5 text-xs text-gray-600 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50"
                >
                  <ExternalLink className="w-3 h-3" />
                  ตั้งค่า & เอกสาร
                  {expanded ? (
                    <ChevronUp className="w-3 h-3" />
                  ) : (
                    <ChevronDown className="w-3 h-3" />
                  )}
                </button>
              </div>
            </div>
            {expanded && (
              <div className="px-5 pb-5">
                <LineConfigPanel bot={bot} onSaved={patchBot} />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
