import { useState } from "react";
import { ExternalLink, Globe, Copy, Check, ChevronDown, ChevronUp, RefreshCw } from "lucide-react";

/* ── LINE Icon SVG ── */
const LineIcon = () => (
  <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
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

/* ── Toggle Switch (amber theme) ── */
function Toggle({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
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

/* ── Copy button ── */
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={handleCopy}
      className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
      title="คัดลอก"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

/* ── Code block ── */
function CodeBlock({ code }: { code: string }) {
  return (
    <div className="bg-gray-900 rounded-lg px-4 py-3 flex items-start justify-between gap-2 group">
      <code className="text-xs text-green-400 font-mono break-all flex-1">{code}</code>
      <CopyButton text={code} />
    </div>
  );
}

/* ── LINE Config Panel ── */
function LineConfigPanel() {
  const [channelToken, setChannelToken] = useState("");
  const [channelSecret, setChannelSecret] = useState("");
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="mt-4 space-y-4 border-t border-gray-100 pt-4">
      {/* Webhook URL */}
      <div>
        <p className="text-xs text-gray-500 mb-1.5">Webhook URL (ใช้ตั้งค่าใน LINE Developers Console)</p>
        <CodeBlock code="https://api.scopebot.com/webhook/line" />
      </div>

      {/* Step guide */}
      <div className="space-y-2">
        {[
          { step: "1", title: "สร้าง LINE Official Account", desc: "ไปที่ LINE Developers Console และสร้าง Messaging API Channel ใหม่" },
          { step: "2", title: "รับ Credentials", desc: "คัดลอก Channel Access Token และ Channel Secret จาก Console" },
          { step: "3", title: "วาง Webhook URL ด้านบน", desc: "ไปที่ Messaging API → Webhook settings → ใส่ URL แล้วกด Verify" },
        ].map((s) => (
          <div key={s.step} className="flex gap-3 bg-gray-50 rounded-lg px-3 py-2.5">
            <div className="w-5 h-5 rounded-full bg-green-100 text-green-700 text-[10px] flex items-center justify-center flex-shrink-0 mt-0.5" style={{ fontWeight: 700 }}>
              {s.step}
            </div>
            <div>
              <p className="text-xs text-gray-700" style={{ fontWeight: 600 }}>{s.title}</p>
              <p className="text-[11px] text-gray-500 mt-0.5">{s.desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Token inputs */}
      <div className="space-y-3">
        <div>
          <label className="block text-xs text-gray-600 mb-1">Channel Access Token</label>
          <input
            type="password"
            value={channelToken}
            onChange={(e) => setChannelToken(e.target.value)}
            placeholder="วาง Channel Access Token ที่นี่..."
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs bg-gray-50 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-600 mb-1">Channel Secret</label>
          <input
            type="password"
            value={channelSecret}
            onChange={(e) => setChannelSecret(e.target.value)}
            placeholder="วาง Channel Secret ที่นี่..."
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs bg-gray-50 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
          />
        </div>
        <button
          onClick={handleSave}
          className={`w-full py-2 rounded-lg text-xs transition-colors ${
            saved
              ? "bg-green-100 text-green-700 border border-green-200"
              : "bg-amber-400 hover:bg-amber-500 text-gray-900"
          }`}
          style={{ fontWeight: 600 }}
        >
          {saved ? "✓ บันทึกแล้ว" : "บันทึกการตั้งค่า"}
        </button>
      </div>
    </div>
  );
}

/* ── Website Config Panel ── */
function WebConfigPanel() {
  const widgetScript = `<script src="https://cdn.scopebot.com/widget.js"\n  data-id="YOUR_BOT_ID"\n  data-theme="amber"\n  data-lang="th">\n</script>`;

  const [primaryColor, setPrimaryColor] = useState("#f59e0b");
  const [welcomeMsg, setWelcomeMsg]     = useState("สวัสดี! มีอะไรให้ช่วยไหม?");
  const [position, setPosition]         = useState<"right" | "left">("right");
  const [saved, setSaved]               = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="mt-4 space-y-4 border-t border-gray-100 pt-4">
      {/* Script snippet */}
      <div>
        <p className="text-xs text-gray-500 mb-1.5">เพิ่ม Script นี้ก่อนปิด &lt;/body&gt;</p>
        <CodeBlock code={widgetScript} />
      </div>

      {/* Widget config */}
      <div className="space-y-3">
        <p className="text-xs text-gray-700" style={{ fontWeight: 600 }}>ปรับแต่ง Widget</p>

        <div className="flex items-center gap-3">
          <div className="flex-1">
            <label className="block text-[11px] text-gray-500 mb-1">ข้อความต้อนรับ</label>
            <input
              type="text"
              value={welcomeMsg}
              onChange={(e) => setWelcomeMsg(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs bg-gray-50 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-[11px] text-gray-500 mb-1">สีหลัก</label>
            <input
              type="color"
              value={primaryColor}
              onChange={(e) => setPrimaryColor(e.target.value)}
              className="h-9 w-12 rounded-lg border border-gray-200 cursor-pointer"
            />
          </div>
        </div>

        <div>
          <label className="block text-[11px] text-gray-500 mb-1">ตำแหน่ง Widget</label>
          <div className="flex gap-2">
            {(["right", "left"] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPosition(p)}
                className={`flex-1 py-1.5 rounded-lg text-xs border transition-colors ${
                  position === p
                    ? "bg-amber-400 text-gray-900 border-amber-400"
                    : "bg-white text-gray-600 border-gray-200 hover:border-amber-300"
                }`}
              >
                {p === "right" ? "ขวา" : "ซ้าย"}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={handleSave}
          className={`w-full py-2 rounded-lg text-xs transition-colors ${
            saved
              ? "bg-green-100 text-green-700 border border-green-200"
              : "bg-amber-400 hover:bg-amber-500 text-gray-900"
          }`}
          style={{ fontWeight: 600 }}
        >
          {saved ? "✓ บันทึกแล้ว" : "บันทึกการตั้งค่า"}
        </button>
      </div>

      {/* Preview badge */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 flex items-center justify-between">
        <div>
          <p className="text-xs text-amber-800" style={{ fontWeight: 600 }}>Widget Preview</p>
          <p className="text-[11px] text-amber-600 mt-0.5">Chatbot จะปรากฏที่มุม{position === "right" ? "ขวา" : "ซ้าย"}ล่างของเว็บไซต์</p>
        </div>
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center shadow-md flex-shrink-0"
          style={{ backgroundColor: primaryColor }}
        >
          <Globe className="w-4 h-4 text-white" />
        </div>
      </div>
    </div>
  );
}

/* ── Integration Card ── */
interface CardData {
  id: "line" | "website";
  name: string;
  tag: string;
  tagColor: string;
  description: string;
  icon: React.ReactNode;
  enabled: boolean;
}

function IntegrationCard({ card, onToggle }: { card: CardData; onToggle: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={`bg-white border rounded-xl shadow-sm overflow-hidden transition-all ${
      card.enabled ? "border-amber-300" : "border-gray-200"
    }`}>
      {/* Card header */}
      <div className="p-5">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl overflow-hidden flex-shrink-0">
              {card.icon}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-900" style={{ fontWeight: 600 }}>{card.name}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${card.tagColor}`}>
                  {card.tag}
                </span>
              </div>
              <p className="text-[11px] text-gray-400 mt-0.5">{card.description}</p>
            </div>
          </div>
          <Toggle enabled={card.enabled} onToggle={() => onToggle(card.id)} />
        </div>

        {/* Status badge */}
        {card.enabled && (
          <div className="mt-3 flex items-center gap-1.5 text-xs text-green-600 bg-green-50 rounded-lg px-3 py-1.5">
            <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
            เชื่อมต่อแล้ว — พร้อมใช้งาน
          </div>
        )}

        {/* Footer actions */}
        <div className="flex items-center gap-2 mt-4 pt-3 border-t border-gray-100">
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1.5 text-xs text-gray-600 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <ExternalLink className="w-3 h-3" />
            ตั้งค่า & เอกสาร
            {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>

          {card.enabled && (
            <button className="flex items-center gap-1.5 text-xs text-amber-600 border border-amber-200 px-3 py-1.5 rounded-lg hover:bg-amber-50 transition-colors ml-auto">
              <RefreshCw className="w-3 h-3" />
              ทดสอบการเชื่อมต่อ
            </button>
          )}
        </div>
      </div>

      {/* Expandable config */}
      {expanded && (
        <div className="px-5 pb-5">
          {card.id === "line" ? <LineConfigPanel /> : <WebConfigPanel />}
        </div>
      )}
    </div>
  );
}

/* ── Main Component ── */
export default function Integration() {
  const [cards, setCards] = useState<CardData[]>([
    {
      id: "line",
      name: "LINE Official Account",
      tag: "Messaging",
      tagColor: "bg-green-100 text-green-700",
      description: "เชื่อมต่อ scopebot กับ LINE OA เพื่อตอบคำถามพนักงานผ่านแอป LINE",
      icon: <LineIcon />,
      enabled: false,
    },
    {
      id: "website",
      name: "Website Widget",
      tag: "Web",
      tagColor: "bg-amber-100 text-amber-700",
      description: "ฝัง chatbot widget บนเว็บไซต์ขององค์กรด้วย script เพียงบรรทัดเดียว",
      icon: (
        <div className="w-full h-full flex items-center justify-center bg-amber-500 rounded-xl">
          <Globe className="w-5 h-5 text-white" />
        </div>
      ),
      enabled: false,
    },
  ]);

  const toggleCard = (id: string) =>
    setCards((prev) => prev.map((c) => (c.id === id ? { ...c, enabled: !c.enabled } : c)));

  const connected = cards.filter((c) => c.enabled).length;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
<<<<<<< HEAD
          <h1 className="text-gray-900">Integration</h1>
=======
          <h1 className="text-gray-900">การเชื่อมต่อ</h1>
>>>>>>> master
          <p className="text-sm text-gray-500 mt-0.5">เชื่อมต่อ scopebot กับช่องทางการสื่อสารต่างๆ</p>
        </div>
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2">
          <span className="w-2 h-2 bg-amber-400 rounded-full" />
          <span className="text-sm text-amber-700">
            <span style={{ fontWeight: 600 }}>{connected}</span> / {cards.length} เชื่อมต่อแล้ว
          </span>
        </div>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {cards.map((card) => (
          <IntegrationCard key={card.id} card={card} onToggle={toggleCard} />
        ))}
      </div>

      {/* Info banner */}
      <div className="mt-6 bg-gray-900 rounded-xl px-5 py-4 flex items-start gap-4">
        <div className="w-8 h-8 bg-amber-400 rounded-lg flex items-center justify-center flex-shrink-0">
          <ExternalLink className="w-4 h-4 text-gray-900" />
        </div>
        <div>
          <p className="text-sm text-white" style={{ fontWeight: 600 }}>ต้องการช่องทางอื่น?</p>
          <p className="text-xs text-gray-400 mt-0.5">
            รองรับ Microsoft Teams, Slack, Facebook Messenger เร็วๆ นี้ ติดต่อทีมเราเพื่อขอ Early Access
          </p>
        </div>
        <button className="ml-auto flex-shrink-0 bg-amber-400 hover:bg-amber-500 text-gray-900 text-xs px-4 py-2 rounded-lg transition-colors" style={{ fontWeight: 600 }}>
          ติดต่อเรา
        </button>
      </div>
    </div>
  );
}