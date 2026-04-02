import { useState } from "react";
import { Link } from "react-router";
import { Button } from "../ui/button";
import { Mail, ArrowLeft, CheckCircle, Zap } from "lucide-react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setIsLoading(false);
    setIsSubmitted(true);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-8 bg-gray-50">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
        {/* Brand */}
        <div className="mb-8 text-center">
          <div className="w-14 h-14 bg-amber-400 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-amber-200">
            <Zap className="w-7 h-7 text-gray-900" />
          </div>
          <span className="text-xl text-gray-900" style={{ fontWeight: 700 }}>scopebot</span>
        </div>

        {!isSubmitted ? (
          <>
            <h1 className="text-gray-900 mb-2 text-center">ลืมรหัสผ่าน?</h1>
            <p className="text-sm text-gray-500 mb-6 text-center leading-relaxed">
              ไม่ต้องกังวล! ป้อนอีเมลของคุณ<br />แล้วเราจะส่งลิงก์รีเซ็ตรหัสผ่านให้
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
            <h2 className="text-gray-900 mb-2" style={{ fontWeight: 700, fontSize: "1.25rem" }}>
              ตรวจสอบอีเมลของคุณ
            </h2>
            <p className="text-sm text-gray-500 mb-2 leading-relaxed">
              เราได้ส่งลิงก์สำหรับรีเซ็ตรหัสผ่านไปยัง
            </p>
            <p className="text-sm text-gray-800 mb-5" style={{ fontWeight: 600 }}>{email}</p>
            <p className="text-xs text-gray-400 mb-6">
              ไม่ได้รับอีเมล? ตรวจสอบในโฟลเดอร์สแปม หรือ{" "}
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