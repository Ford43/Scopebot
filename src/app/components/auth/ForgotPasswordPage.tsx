import { useState } from "react";
import { Link } from "react-router";
import { Button } from "../ui/button";
import { Mail, ArrowLeft, CheckCircle, Zap, Copy } from "lucide-react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [devResetUrl, setDevResetUrl] = useState<string | null>(null);
  const [emailSent, setEmailSent] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    setDevResetUrl(null);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          typeof data.detail === "string" ? data.detail : "ไม่สามารถส่งคำขอได้"
        );
      }
      setEmailSent(Boolean(data.email_sent));
      if (typeof data.dev_reset_url === "string") {
        setDevResetUrl(data.dev_reset_url);
      }
      setIsSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
    } finally {
      setIsLoading(false);
    }
  };

  const copyDevLink = async () => {
    if (!devResetUrl) return;
    await navigator.clipboard.writeText(devResetUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-8 bg-gray-50">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
        <div className="mb-8 text-center">
          <div className="w-14 h-14 bg-amber-400 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-amber-200">
            <Zap className="w-7 h-7 text-gray-900" />
          </div>
          <span className="text-xl text-gray-900" style={{ fontWeight: 700 }}>
            scopebot
          </span>
        </div>

        {!isSubmitted ? (
          <>
            <h1 className="text-gray-900 mb-2 text-center">ลืมรหัสผ่าน?</h1>
            <p className="text-sm text-gray-500 mb-6 text-center leading-relaxed">
              ป้อนอีเมลของคุณ แล้วระบบจะส่งลิงก์รีเซ็ตรหัสผ่านให้
              <br />
              (หรือแจ้งผู้ดูแลหากยังไม่ได้ตั้งค่า SMTP)
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm text-gray-700 mb-1.5">
                  อีเมล
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    required
                    className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl bg-gray-50 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
                  />
                </div>
              </div>

              {error && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
                  {error}
                </p>
              )}

              <Button
                type="submit"
                disabled={isLoading}
                className="w-full bg-amber-400 hover:bg-amber-500 text-gray-900 py-3 rounded-xl text-sm"
                style={{ fontWeight: 600 }}
              >
                {isLoading ? "กำลังส่ง..." : "ส่งลิงก์รีเซ็ตรหัสผ่าน"}
              </Button>
            </form>
          </>
        ) : (
          <div className="text-center">
            <div className="w-16 h-16 bg-amber-50 border-2 border-amber-200 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-amber-500" />
            </div>
            <h2
              className="text-gray-900 mb-2"
              style={{ fontWeight: 700, fontSize: "1.25rem" }}
            >
              {emailSent ? "ตรวจสอบอีเมลของคุณ" : "รับคำขอแล้ว"}
            </h2>
            <p className="text-sm text-gray-500 mb-2 leading-relaxed">
              {emailSent
                ? "หากอีเมลนี้มีในระบบ เราได้ส่งลิงก์รีเซ็ตรหัสผ่านไปยัง"
                : "หากอีเมลนี้มีในระบบ คำขอถูกรับแล้ว — ผู้ดูแลจะได้รับแจ้งเตือนหากยังไม่ได้ตั้ง SMTP"}
            </p>
            <p className="text-sm text-gray-800 mb-5" style={{ fontWeight: 600 }}>
              {email}
            </p>

            {devResetUrl && (
              <div className="mb-5 text-left bg-amber-50 border border-amber-200 rounded-xl p-3">
                <p className="text-xs text-amber-800 mb-2" style={{ fontWeight: 600 }}>
                  โหมด DEBUG — ลิงก์รีเซ็ต (ใช้สำหรับ pilot / ทดสอบ)
                </p>
                <p className="text-xs text-gray-600 break-all mb-2">{devResetUrl}</p>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    onClick={copyDevLink}
                    className="bg-white border border-amber-300 text-gray-800 hover:bg-amber-100 text-xs h-8"
                  >
                    <Copy className="w-3.5 h-3.5 mr-1" />
                    {copied ? "คัดลอกแล้ว" : "คัดลอกลิงก์"}
                  </Button>
                  <Link
                    to={devResetUrl.replace(/^https?:\/\/[^/]+/, "")}
                    className="inline-flex items-center text-xs bg-amber-400 hover:bg-amber-500 text-gray-900 px-3 rounded-lg"
                    style={{ fontWeight: 600 }}
                  >
                    เปิดหน้าตั้งรหัสใหม่
                  </Link>
                </div>
              </div>
            )}

            <p className="text-xs text-gray-400 mb-6">
              ไม่ได้รับอีเมล? ตรวจสอบสแปม หรือ{" "}
              <button
                onClick={() => setIsSubmitted(false)}
                className="text-amber-600 hover:text-amber-700"
                style={{ fontWeight: 600 }}
              >
                ลองส่งอีกครั้ง
              </button>
            </p>
          </div>
        )}

        <div className="mt-6 text-center border-t border-gray-100 pt-5">
          <Link
            to="/login"
            className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            กลับไปหน้าเข้าสู่ระบบ
          </Link>
        </div>
      </div>
    </div>
  );
}
