import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { Button } from "../ui/button";
import { ArrowLeft, CheckCircle, Lock, Zap } from "lucide-react";

export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = useMemo(() => params.get("token")?.trim() || "", [params]);
  const navigate = useNavigate();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!token) {
      setError("ลิงก์ไม่ถูกต้อง — กรุณาขอรีเซ็ตใหม่จากหน้าลืมรหัสผ่าน");
      return;
    }
    if (password.length < 6) {
      setError("รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร");
      return;
    }
    if (password !== confirm) {
      setError("รหัสผ่านยืนยันไม่ตรงกัน");
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, new_password: password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          typeof data.detail === "string" ? data.detail : "รีเซ็ตรหัสผ่านไม่สำเร็จ"
        );
      }
      setDone(true);
      setTimeout(() => navigate("/login"), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
    } finally {
      setIsLoading(false);
    }
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

        {done ? (
          <div className="text-center">
            <div className="w-16 h-16 bg-amber-50 border-2 border-amber-200 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-amber-500" />
            </div>
            <h2 className="text-gray-900 mb-2" style={{ fontWeight: 700 }}>
              ตั้งรหัสผ่านใหม่สำเร็จ
            </h2>
            <p className="text-sm text-gray-500">กำลังพาไปหน้าเข้าสู่ระบบ...</p>
          </div>
        ) : (
          <>
            <h1 className="text-gray-900 mb-2 text-center">ตั้งรหัสผ่านใหม่</h1>
            <p className="text-sm text-gray-500 mb-6 text-center">
              กรอกรหัสผ่านใหม่สำหรับบัญชีของคุณ
            </p>

            {!token && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2 mb-4">
                ไม่พบ token ในลิงก์ —{" "}
                <Link to="/forgot-password" className="underline">
                  ขอรีเซ็ตใหม่
                </Link>
              </p>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-700 mb-1.5" htmlFor="password">
                  รหัสผ่านใหม่
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-700 mb-1.5" htmlFor="confirm">
                  ยืนยันรหัสผ่าน
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    id="confirm"
                    type="password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    required
                    minLength={6}
                    className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
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
                disabled={isLoading || !token}
                className="w-full bg-amber-400 hover:bg-amber-500 text-gray-900 py-3 rounded-xl text-sm"
                style={{ fontWeight: 600 }}
              >
                {isLoading ? "กำลังบันทึก..." : "บันทึกรหัสผ่านใหม่"}
              </Button>
            </form>
          </>
        )}

        <div className="mt-6 text-center border-t border-gray-100 pt-5">
          <Link
            to="/login"
            className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700"
          >
            <ArrowLeft className="w-4 h-4" />
            กลับไปหน้าเข้าสู่ระบบ
          </Link>
        </div>
      </div>
    </div>
  );
}
