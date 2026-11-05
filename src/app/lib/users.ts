import { apiFetch } from "./api";

export async function resetUserPassword(
  userId: string | number,
  password: string,
  confirmation: string,
): Promise<void> {
  if (password.length < 6) {
    throw new Error("รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร");
  }
  if (password !== confirmation) {
    throw new Error("รหัสผ่านใหม่และรหัสผ่านยืนยันไม่ตรงกัน");
  }

  await apiFetch(`/api/auth/users/${userId}/reset-password`, {
    method: "PATCH",
    body: JSON.stringify({ new_password: password }),
  });
}
