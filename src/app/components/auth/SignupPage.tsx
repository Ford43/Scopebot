import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { useAuth } from "../../contexts/AuthContext";
<<<<<<< HEAD
import { Eye, EyeOff, Mail, Lock, User, AlertCircle, Zap, ChevronRight } from "lucide-react";
=======
import { Eye, EyeOff, Mail, Lock, User, AlertCircle, Zap, ChevronRight, CheckCircle } from "lucide-react";
>>>>>>> master

export default function SignupPage() {
  const [name, setName]                     = useState("");
  const [email, setEmail]                   = useState("");
  const [password, setPassword]             = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword]     = useState(false);
  const [error, setError]                   = useState("");
  const [isLoading, setIsLoading]           = useState(false);
  const [acceptTerms, setAcceptTerms]       = useState(false);
<<<<<<< HEAD
=======
  const [isSuccess, setIsSuccess]           = useState(false);
>>>>>>> master

  const { signup } = useAuth();
  const navigate   = useNavigate();

  const pwStrength = (pwd: string) => {
    if (!pwd) return { level: 0, label: "", color: "" };
    if (pwd.length < 6) return { level: 1, label: "อ่อนแอ", color: "bg-red-400" };
    if (pwd.length < 8) return { level: 2, label: "ปานกลาง", color: "bg-amber-400" };
    if (/[A-Z]/.test(pwd) && /[0-9]/.test(pwd)) return { level: 3, label: "แข็งแรง", color: "bg-green-400" };
    return { level: 2, label: "ปานกลาง", color: "bg-amber-400" };
  };
  const strength = pwStrength(password);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!acceptTerms)                        { setError("กรุณายอมรับข้อกำหนดและเงื่อนไข"); return; }
    if (password !== confirmPassword)         { setError("รหัสผ่านไม่ตรงกัน"); return; }
    if (password.length < 6)                 { setError("รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร"); return; }
    setIsLoading(true);
    try {
      const ok = await signup(email, password, name);
<<<<<<< HEAD
      if (ok) navigate("/chat");
      else     setError("อีเมลนี้มีผู้ใช้งานแล้ว");
=======
      if (ok) {
        setIsSuccess(true); // 🟢 ถ้าสมัครสำเร็จ ให้แสดงหน้าสำเร็จ
      } else {
        setError("อีเมลนี้มีผู้ใช้งานแล้ว หรือเกิดข้อผิดพลาด");
      }    setError("อีเมลนี้มีผู้ใช้งานแล้ว");
>>>>>>> master
    } catch {
      setError("เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง");
    } finally {
      setIsLoading(false);
    }
  };

  const inputBase =
    "w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl bg-gray-50 text-gray-900 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent transition-all";

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background decoration */}
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{ backgroundImage: "radial-gradient(circle, #fbbf24 1px, transparent 1px)", backgroundSize: "32px 32px" }}
      />
      <div className="absolute top-1/3 left-1/4 w-80 h-80 bg-amber-400 rounded-full blur-3xl opacity-10 pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-56 h-56 bg-yellow-300 rounded-full blur-3xl opacity-5 pointer-events-none" />

<<<<<<< HEAD
      {/* Card */}
      <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl shadow-black/40 p-8 my-8">
=======
      {isSuccess ? (
        <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl p-8 text-center my-8 z-10">
          <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-5">
            <CheckCircle className="w-8 h-8 text-green-500" />
          </div>
          <h2 className="text-xl text-gray-900 mb-2" style={{ fontWeight: 700 }}>สมัครสมาชิกสำเร็จ!</h2>
          <p className="text-sm text-gray-500 mb-8 leading-relaxed">
            บัญชีของคุณถูกสร้างเรียบร้อยแล้ว<br/>แต่ยังอยู่ในสถานะ <b>"รอการอนุมัติ"</b><br/>กรุณารอให้เจ้าหน้าที่ตรวจสอบและเปิดใช้งานบัญชีของคุณ
          </p>
          <Link
            to="/login"
            className="block w-full bg-amber-400 hover:bg-amber-500 text-gray-900 py-3 rounded-xl transition-colors shadow-sm"
            style={{ fontWeight: 700 }}
          >
            กลับไปหน้าเข้าสู่ระบบ
          </Link>
        </div>
      ) : (
        /* 🔴 ฟอร์มสมัครสมาชิกเดิมที่ถูกครอบไว้ในเงื่อนไข else */
        <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl shadow-black/40 p-8 my-8 z-10">
>>>>>>> master

        {/* Logo */}
        <div className="flex flex-col items-center mb-6">
          <div className="w-14 h-14 bg-amber-400 rounded-2xl flex items-center justify-center shadow-lg shadow-amber-300/40 mb-3">
            <Zap className="w-7 h-7 text-gray-900" />
          </div>
          <h1 className="text-gray-900 text-center" style={{ fontWeight: 700, fontSize: "1.25rem" }}>
            สมัครสมาชิก scopebot
          </h1>
          <p className="text-sm text-gray-400 text-center mt-1">เริ่มใช้งานฟรีวันนี้ ไม่มีค่าใช้จ่าย</p>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-red-700">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <div>
            <label className="block text-sm text-gray-700 mb-1.5" style={{ fontWeight: 500 }}>ชื่อ-นามสกุล</label>
            <div className="relative">
              <User className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text" value={name} onChange={(e) => setName(e.target.value)}
                placeholder="สมชาย ใจดี" required className={inputBase}
              />
            </div>
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm text-gray-700 mb-1.5" style={{ fontWeight: 500 }}>อีเมล</label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com" required className={inputBase}
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm text-gray-700 mb-1.5" style={{ fontWeight: 500 }}>รหัสผ่าน</label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type={showPassword ? "text" : "password"}
                value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder="อย่างน้อย 6 ตัวอักษร" required
                className="w-full pl-10 pr-12 py-3 border border-gray-200 rounded-xl bg-gray-50 text-gray-900 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent transition-all"
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {password && (
              <div className="mt-2">
                <div className="flex gap-1 mb-1">
                  {[1, 2, 3].map((lvl) => (
                    <div key={lvl} className={`h-1 flex-1 rounded-full transition-all ${lvl <= strength.level ? strength.color : "bg-gray-200"}`} />
                  ))}
                </div>
                <p className="text-xs text-gray-500">ความแข็งแรง: {strength.label}</p>
              </div>
            )}
          </div>

          {/* Confirm Password */}
          <div>
            <label className="block text-sm text-gray-700 mb-1.5" style={{ fontWeight: 500 }}>ยืนยันรหัสผ่าน</label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="password" value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="ยืนยันรหัสผ่านอีกครั้ง" required className={inputBase}
              />
            </div>
            {confirmPassword && password !== confirmPassword && (
              <p className="mt-1 text-xs text-red-500">รหัสผ่านไม่ตรงกัน</p>
            )}
          </div>

          {/* Terms */}
          <div className="flex items-start gap-2.5">
            <input
              id="terms" type="checkbox" checked={acceptTerms}
              onChange={(e) => setAcceptTerms(e.target.checked)}
              className="w-4 h-4 mt-0.5 rounded border-gray-300 accent-amber-400 flex-shrink-0"
            />
            <label htmlFor="terms" className="text-sm text-gray-600 cursor-pointer leading-relaxed">
              ฉันยอมรับ{" "}
              <a href="#" className="text-amber-600 hover:text-amber-700">ข้อกำหนดการใช้งาน</a>
              {" "}และ{" "}
              <a href="#" className="text-amber-600 hover:text-amber-700">นโยบายความเป็นส่วนตัว</a>
            </label>
          </div>

          <button
            type="submit" disabled={isLoading}
            className="w-full bg-amber-400 hover:bg-amber-500 text-gray-900 py-3 rounded-xl text-sm transition-colors disabled:opacity-60 shadow-sm shadow-amber-200"
            style={{ fontWeight: 700 }}
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-gray-900/30 border-t-gray-900 rounded-full animate-spin" />
                กำลังสมัครสมาชิก...
              </span>
            ) : "สมัครสมาชิก"}
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-gray-500">
          มีบัญชีอยู่แล้ว?{" "}
          <Link to="/login" className="text-amber-600 hover:text-amber-700 transition-colors" style={{ fontWeight: 600 }}>
            เข้าสู่ระบบ
          </Link>
        </p>

        <div className="flex items-center gap-3 mt-4">
          <div className="flex-1 h-px bg-gray-100" />
          <span className="text-xs text-gray-400">หรือ</span>
          <div className="flex-1 h-px bg-gray-100" />
        </div>

        <Link to="/chat" className="mt-4 flex items-center justify-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 transition-colors">
          ดำเนินต่อโดยไม่เข้าสู่ระบบ
          <ChevronRight className="w-3.5 h-3.5" />
        </Link>
      </div>
<<<<<<< HEAD
=======
      )}
>>>>>>> master
    </div>
  );
}