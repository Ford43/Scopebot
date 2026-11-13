import { clearAuthToken, getAuthToken } from "./api";

export function retryAfterSeconds(response: Response): number {
  const value = Number(response.headers.get("Retry-After"));
  return Number.isFinite(value) && value > 0 ? Math.ceil(value) : 0;
}

export async function logoutSession(): Promise<boolean> {
  const token = getAuthToken();
  if (!token) return true;
  const response = await fetch("/api/auth/logout", {
    method: "POST", headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok && response.status !== 401) {
    throw new Error("ยังยืนยันการออกจากระบบไม่ได้ กรุณาลองอีกครั้ง");
  }
  // 401 means this token is already unusable (expired or invalid).
  // Never erase a newer login if it changed while the request was in flight.
  if (getAuthToken() !== token) return false;
  clearAuthToken();
  return true;
}
