import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { useAuth } from "../../contexts/AuthContext";
import { Eye, EyeOff, Mail, Lock, AlertCircle, Zap, ChevronRight } from "lucide-react";

const DEMO_ACCOUNTS = [
  { role: "admin",   label: "👑 Admin",   email: "admin@scopebot.com",   password: "admin123"   },
  { role: "support", label: "🎧 Support", email: "support@scopebot.com", password: "support123" },
  { role: "user",    label: "👤 User",    email: "user@example.com",    password: "user123"    },
];

export default function LoginPage() {
  const [email, setEmail]               = useState("");
  const [password, setPassword]         = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError]               = useState("");
  const [isLoading, setIsLoading]       = useState(false);
  const [showDemo, setShowDemo]         = useState(false);

  const { login } = useAuth();
  const navigate  = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);
    try {
      const ok = await login(email, password);
      if (ok) navigate("/chat");
      else setError("อีเมลหรือรหัสผ่านไม่ถูกต้อง");
    } catch {
      setError("เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง");
    } finally {
      setIsLoading(false);
    }
  };

  const fillDemo = (acc: typeof DEMO_ACCOUNTS[0]) => {
    setEmail(acc.email);
    setPassword(acc.password);
    setShowDemo(false);
    setError("");
  };

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background decoration */}
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{ backgroundImage: "radial-gradient(circle, #fbbf24 1px, transparent 1px)", backgroundSize: "32px 32px" }}
      />
      <div className="absolute top-1/4 left-1/3 w-96 h-96 bg-amber-400 rounded-full blur-3xl opacity-10 pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/3 w-64 h-64 bg-yellow-300 rounded-full blur-3xl opacity-5 pointer-events-none" />

      {/* Card */}
      <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl shadow-black/40 p-8">

        {/* Logo */}
        <div className="flex flex-col items-center mb-7">
          <div className="w-16 h-16 bg-amber-400 rounded-2xl flex items-center justify-center shadow-lg shadow-amber-300/40 mb-4">
            <Zap className="w-8 h-8 text-gray-900" />
          </div>
          <h1 className="text-gray-900 text-center" style={{ fontWeight: 700, fontSize: "1.35rem" }}>
            เข้าสู่ระบบ scopebot
          </h1>
          <p className="text-sm text-gray-400 text-center mt-1">ยินดีต้อนรับกลับมาครับ</p>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-red-700">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        {/* Demo accounts */}
        <div className="mb-5">
          <button
            type="button"
            onClick={() => setShowDemo(!showDemo)}
            className="w-full flex items-center justify-between text-xs text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-xl px-3.5 py-2.5 transition-colors"
          >
            <span className="flex items-center gap-1.5">
              <span>🔑</span>
              <span style={{ fontWeight: 600 }}>ข้อมูลทดสอบ (Demo)</span>
            </span>
            <ChevronRight className={`w-3.5 h-3.5 transition-transform ${showDemo ? "rotate-90" : ""}`} />
          </button>

          {showDemo && (
            <div className="mt-2 bg-amber-50 border border-amber-200 rounded-xl overflow-hidden">
              {DEMO_ACCOUNTS.map((acc) => (
                <button
                  key={acc.role}
                  type="button"
                  onClick={() => fillDemo(acc)}
                  className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-amber-100 transition-colors border-b border-amber-100 last:border-0 text-left"
                >
                  <div>
                    <p className="text-xs text-amber-900" style={{ fontWeight: 600 }}>{acc.label}</p>
                    <p className="text-[11px] text-amber-600">{acc.email}</p>
                  </div>
                  <span className="text-[10px] text-amber-500 bg-amber-100 px-2 py-0.5 rounded-full border border-amber-200">
                    กดเพื่อใช้
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email */}
          <div>
            <label className="block text-sm text-gray-700 mb-1.5" style={{ fontWeight: 500 }}>
              ชื่อผู้ใช้งาน / อีเมล
            </label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="กรอกอีเมลของคุณ..."
                required
                className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl bg-gray-50 text-gray-900 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent transition-all"
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm text-gray-700 mb-1.5" style={{ fontWeight: 500 }}>
              รหัสผ่าน
            </label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="กรอกรหัสผ่าน..."
                required
                className="w-full pl-10 pr-12 py-3 border border-gray-200 rounded-xl bg-gray-50 text-gray-900 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Forgot password */}
          <div className="flex justify-end">
            <Link
              to="/forgot-password"
              className="text-sm text-amber-600 hover:text-amber-700 transition-colors"
            >
              ลืมรหัสผ่าน?
            </Link>
          </div>

          {/* Login button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-amber-400 hover:bg-amber-500 text-gray-900 py-3 rounded-xl text-sm transition-colors disabled:opacity-60 shadow-sm shadow-amber-200"
            style={{ fontWeight: 700 }}
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-gray-900/30 border-t-gray-900 rounded-full animate-spin" />
                กำลังเข้าสู่ระบบ...
              </span>
            ) : "เข้าสู่ระบบ"}
          </button>
        </form>

        {/* Register link */}
        <p className="mt-5 text-center text-sm text-gray-500">
          ยังไม่มีบัญชีใช่หรือไม่?{" "}
          <Link to="/signup" className="text-amber-600 hover:text-amber-700 transition-colors" style={{ fontWeight: 600 }}>
            สมัครสมาชิก
          </Link>
        </p>

        {/* Divider */}
        <div className="flex items-center gap-3 mt-5">
          <div className="flex-1 h-px bg-gray-100" />
          <span className="text-xs text-gray-400">หรือ</span>
          <div className="flex-1 h-px bg-gray-100" />
        </div>

        {/* Guest access */}
        <Link
          to="/chat"
          className="mt-4 flex items-center justify-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 transition-colors"
        >
          ดำเนินต่อโดยไม่เข้าสู่ระบบ
          <ChevronRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
}