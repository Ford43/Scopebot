import { useState, useEffect, useCallback } from "react";
import { 
  ExternalLink, Globe, Copy, Check, ChevronDown, ChevronUp, 
  RefreshCw, Loader2, Eye, EyeOff, CheckCircle2, AlertCircle 
} from "lucide-react";

// ใช้ relative path ผ่าน vite proxy (server.proxy['/api'] ใน vite.config.ts)
// เดียวกับที่ BotsPage.tsx และไฟล์อื่นๆ ในโปรเจกต์ใช้ จะได้ทำงานถูกทั้ง dev และ production
const API_BASE_URL = "";
// ต้องตรงกับ route จริงใน api/routers/line_webhook.py: prefix "/api/line" + "/webhook/{bot_id}"
// ตั้งค่า VITE_PUBLIC_API_URL ใน .env ตอน deploy จริง (เช่น https://api.scopebot.com)
// เพราะ LINE ต้องยิง webhook มาที่โดเมนสาธารณะ ไม่ใช่ localhost ตอน dev
const PUBLIC_API_ORIGIN = import.meta.env.VITE_PUBLIC_API_URL || window.location.origin;
const WEBHOOK_BASE_URL = `${PUBLIC_API_ORIGIN}/api/line/webhook`;

// Helper สำหรับดึง Headers พร้อม Token
const getAuthHeaders = () => {
  const token = localStorage.getItem("scopebot_token");
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
};

/* ── Components ย่อย (CopyButton, CodeBlock, Toggle, LineIcon) ── */
// (ใช้เหมือนเดิมจากเวอร์ชันก่อนหน้า เพื่อไม่ให้โค้ดยาวเกินไป)
const LineIcon = () => (
  <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
    <rect width="40" height="40" rx="10" fill="#06C755" />
    <path d="M33 18.8c0-6.1-6.1-11-13.7-11S5.6 12.7 5.6 18.8c0 5.4 4.8 10 11.3 10.9.4.1 1 .3 1.2.7.2.3.1.9.1.9l-.2 1.2c-.1.4-.3 1.5 1.3.8 1.6-.7 8.5-5 11.6-8.6A9.7 9.7 0 0 0 33 18.8z" fill="white" />
  </svg>
);

function Toggle({ enabled, onToggle, disabled = false }: { enabled: boolean; onToggle: () => void; disabled?: boolean }) {
  return (
    <button onClick={onToggle} disabled={disabled} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${enabled ? "bg-amber-400" : "bg-gray-300"}`}>
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-md transition-transform ${enabled ? "translate-x-6" : "translate-x-1"}`} />
    </button>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={handleCopy} className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
      {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

function CodeBlock({ code }: { code: string }) {
  return (
    <div className="bg-gray-900 rounded-lg px-4 py-3 flex items-start justify-between gap-2 group">
      <code className="text-xs text-green-400 font-mono break-all flex-1 whitespace-pre-wrap">{code}</code>
      <CopyButton text={code} />
    </div>
  );
}

/* ── 1 & 2 & 3: Line Config Panel (ยิง API บันทึก + รองรับ botId + Webhook URL) ── */
function LineConfigPanel({ 
  botId, 
  initialToken = "", 
  initialSecret = "",
  onSaveSuccess 
}: { 
  botId: string; 
  initialToken?: string; 
  initialSecret?: string;
  onSaveSuccess?: () => void;
}) {
  const [channelToken, setChannelToken] = useState(initialToken);
  const [channelSecret, setChannelSecret] = useState(initialSecret);
  const [showToken, setShowToken] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    if (!channelToken || !channelSecret) return alert("กรุณากรอกข้อมูลให้ครบถ้วน");
    setIsSaving(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/bots/${botId}/line-credentials`, {
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          line_channel_token: channelToken,
          line_channel_secret: channelSecret,
        }),
      });

      if (!res.ok) throw new Error("Save failed");

      setSaved(true);
      if (onSaveSuccess) onSaveSuccess();
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error(err);
      alert("บันทึกไม่สำเร็จ");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="mt-4 space-y-4 border-t border-gray-100 pt-4">
      <div>
        <p className="text-xs text-gray-500 mb-1.5">Webhook URL</p>
        <CodeBlock code={`${WEBHOOK_BASE_URL}/${botId}`} />
      </div>

      <div className="space-y-3">
        <div>
          <label className="block text-xs text-gray-600 mb-1">Channel Access Token</label>
          <div className="relative">
            <input
              type={showToken ? "text" : "password"}
              value={channelToken}
              onChange={(e) => setChannelToken(e.target.value)}
              className="w-full pl-3 pr-9 py-2 border border-gray-200 rounded-lg text-xs"
            />
            <button type="button" onClick={() => setShowToken(!showToken)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400">
              {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <div>
          <label className="block text-xs text-gray-600 mb-1">Channel Secret</label>
          <div className="relative">
            <input
              type={showSecret ? "text" : "password"}
              value={channelSecret}
              onChange={(e) => setChannelSecret(e.target.value)}
              className="w-full pl-3 pr-9 py-2 border border-gray-200 rounded-lg text-xs"
            />
            <button type="button" onClick={() => setShowSecret(!showSecret)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400">
              {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <button onClick={handleSave} disabled={isSaving} className={`w-full py-2 rounded-lg text-xs font-semibold flex justify-center gap-2 ${saved ? "bg-green-100 text-green-700" : "bg-amber-400 hover:bg-amber-500"}`}>
          {isSaving ? "กำลังบันทึก..." : saved ? "✓ บันทึกแล้ว" : "บันทึกการตั้งค่า"}
        </button>
      </div>
    </div>
  );
}

/* ── 6: ปุ่มทดสอบการเชื่อมต่อ (Test Connection) ── */
function IntegrationCard({ card, onToggle, botId, onRefresh }: any) {
  const [expanded, setExpanded] = useState(false);
  const [isTesting, setIsTesting] = useState(false);

  const handleTestConnection = async () => {
    setIsTesting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/bots/${botId}/test-line`, {
        method: "POST",
        headers: getAuthHeaders(),
      });
      const data = await res.json();

      if (res.ok && data.status === "connected") {
        alert("เชื่อมต่อ LINE สำเร็จ!");
      } else {
        alert(`การเชื่อมต่อล้มเหลว: ${data.message || "โปรดตรวจสอบ Token/Secret"}`);
      }
    } catch (err) {
      alert("ไม่สามารถติดต่อเซิร์ฟเวอร์เพื่อทดสอบได้");
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className={`bg-white border rounded-xl p-5 ${card.enabled ? "border-amber-300" : "border-gray-200"}`}>
      <div className="flex items-start justify-between">
        <div className="flex gap-3">
          <div className="w-10 h-10">{card.icon}</div>
          <div>
            <p className="font-semibold text-sm">{card.name}</p>
            <p className="text-[11px] text-gray-400">{card.description}</p>
          </div>
        </div>
        <Toggle enabled={card.enabled} onToggle={() => onToggle(card.id, !card.enabled)} />
      </div>

      <div className="flex gap-2 mt-4 pt-3 border-t">
        <button onClick={() => setExpanded(!expanded)} className="text-xs border px-3 py-1.5 rounded-lg flex items-center gap-1">
          ตั้งค่า {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>
        {card.enabled && card.id === "line" && (
          <button onClick={handleTestConnection} disabled={isTesting} className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-3 py-1.5 rounded-lg ml-auto">
            {isTesting ? "กำลังทดสอบ..." : "ทดสอบการเชื่อมต่อ"}
          </button>
        )}
      </div>

      {expanded && card.id === "line" && (
        <LineConfigPanel 
          botId={botId} 
          initialToken={card.channelToken} 
          initialSecret={card.channelSecret} 
          onSaveSuccess={onRefresh} 
        />
      )}
    </div>
  );
}

interface BotOption {
  bot_id: string;
  name: string;
  status: string;
}

/* ── 0: Dropdown เลือกบอทที่จะเชื่อม ── */
function BotSelector({
  bots,
  selectedBotId,
  onSelect,
}: {
  bots: BotOption[];
  selectedBotId: string;
  onSelect: (botId: string) => void;
}) {
  return (
    <div className="mb-6 max-w-sm">
      <label className="block text-xs text-gray-600 mb-1.5">เลือกบอทที่ต้องการเชื่อมต่อ</label>
      <select
        value={selectedBotId}
        onChange={(e) => onSelect(e.target.value)}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
      >
        {bots.map((b) => (
          <option key={b.bot_id} value={b.bot_id}>
            {b.name} {b.status === "inactive" ? "(ยังไม่มีฐานความรู้)" : ""}
          </option>
        ))}
      </select>
    </div>
  );
}

/* ── 5: โหลดค่าที่เคยบันทึก + 4: Toggle ยิง API ── */
export default function Integration({ botId }: { botId?: string }) {
  const [isLoadingBots, setIsLoadingBots] = useState(true);
  const [isLoadingConfig, setIsLoadingConfig] = useState(false);
  const [bots, setBots] = useState<BotOption[]>([]);
  const [selectedBotId, setSelectedBotId] = useState<string>(botId || "");
  const [lineData, setLineData] = useState({
    enabled: false,
    token: "",
    secret: ""
  });

  // 0. โหลดรายชื่อบอททั้งหมดของผู้ใช้ เพื่อให้เลือกได้ (ใช้เมื่อไม่ได้ระบุ botId มาจาก parent)
  useEffect(() => {
    const fetchBots = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/bots/`, { headers: getAuthHeaders() });
        if (res.ok) {
          const data: BotOption[] = await res.json();
          setBots(data);
          // ถ้า parent ส่ง botId มาให้ใช้ตัวนั้นก่อน ไม่งั้นเลือกบอทแรกในรายการ
          if (!botId && data.length > 0) {
            setSelectedBotId(data[0].bot_id);
          }
        }
      } catch (err) {
        console.error("Failed to fetch bot list", err);
      } finally {
        setIsLoadingBots(false);
      }
    };
    fetchBots();
  }, [botId]);

  // เมื่อ parent เปลี่ยน botId (เช่น สลับบอทตอนแชท) ให้ sync ค่าที่เลือกไว้
  useEffect(() => {
    if (botId) setSelectedBotId(botId);
  }, [botId]);

  // 5. โหลดข้อมูล LINE ของบอทที่เลือกอยู่
  const fetchLineConfig = useCallback(async () => {
    if (!selectedBotId) return;
    setIsLoadingConfig(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/bots/${selectedBotId}/line-credentials`, {
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setLineData({
          enabled: data.is_connected || false, // ตรงกับ key ที่ api/routers/bot_settings.py คืนมาจริง
          token: data.channel_token || "",
          secret: data.channel_secret || ""
        });
      }
    } catch (err) {
      console.error("Failed to fetch initial config", err);
    } finally {
      setIsLoadingConfig(false);
    }
  }, [selectedBotId]);

  useEffect(() => {
    fetchLineConfig();
  }, [fetchLineConfig]);

  // 4. Toggle Switch เชื่อม Backend
  const handleToggle = async (channelId: string, newState: boolean) => {
    if (channelId !== "line") return;

    // อัปเดต UI ชั่วคราวให้ผู้ใช้เห็นทันที
    setLineData(prev => ({ ...prev, enabled: newState }));

    try {
      const res = await fetch(`${API_BASE_URL}/api/bots/${selectedBotId}/integration-status`, {
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify({ line_enabled: newState }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Toggle failed");
      }
    } catch (err: any) {
      alert(err.message || "ไม่สามารถเปลี่ยนสถานะได้ (ตรวจสอบว่ากรอก Token/Secret ครบหรือยัง)");
      // Revert UI กลับหาก API Error
      setLineData(prev => ({ ...prev, enabled: !newState }));
    }
  };

  if (isLoadingBots) {
    return <div className="p-10 text-center"><Loader2 className="animate-spin inline" /> กำลังโหลด...</div>;
  }

  if (bots.length === 0) {
    return (
      <div className="p-10 text-center text-sm text-gray-500">
        ยังไม่มีบอทในระบบ กรุณาสร้างบอทก่อนเพื่อเชื่อมต่อ LINE
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-xl font-bold mb-6">การเชื่อมต่อ</h1>

      <BotSelector bots={bots} selectedBotId={selectedBotId} onSelect={setSelectedBotId} />

      {isLoadingConfig ? (
        <div className="p-10 text-center"><Loader2 className="animate-spin inline" /> กำลังโหลดค่าตั้งค่า...</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <IntegrationCard
            key={selectedBotId /* remount การ์ดเมื่อสลับบอท กัน state ค้าง */}
            card={{
              id: "line",
              name: "LINE Official Account",
              description: "เชื่อมต่อเพื่อตอบคำถามผ่านแอป LINE",
              icon: <LineIcon />,
              enabled: lineData.enabled,
              channelToken: lineData.token,
              channelSecret: lineData.secret
            }}
            onToggle={handleToggle}
            botId={selectedBotId}
            onRefresh={fetchLineConfig}
          />
          {/* สามารถเพิ่ม Widget Card ตรงนี้ได้ในอนาคต */}
        </div>
      )}
    </div>
  );
}