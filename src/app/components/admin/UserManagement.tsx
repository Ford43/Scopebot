import { useState, useEffect } from "react";
import {
  Search,
  ChevronDown,
  Hourglass,
  Trash2,
  CheckCircle,
  Ban,
  ShieldCheck,
  RotateCcw,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../../contexts/AuthContext";
import { authHeaders } from "../../lib/api";

function getStatusClass(status: string) {
  switch (status) {
    case "Active":
      return "bg-emerald-100 text-emerald-700";
    case "Banned":
      return "bg-rose-100 text-rose-700";
    case "Pending":
      return "bg-sky-100 text-sky-700";
    default:
      return "bg-gray-100 text-gray-600";
  }
}

function determineStatus(user: any) {
  if (!user.is_approved) return "Pending";
  if (!user.is_active) return "Banned";
  return "Active";
}

function statusLabel(status: string) {
  switch (status) {
    case "Active":
      return "ใช้งานปกติ";
    case "Banned":
      return "ถูกระงับ";
    case "Pending":
      return "รออนุมัติ";
    default:
      return status;
  }
}

export default function UserManagement({ initialQuery = "" }: { initialQuery?: string }) {
  const [users, setUsers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [statusFilter, setStatusFilter] = useState("All Status");
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [showBannedModal, setShowBannedModal] = useState(false);
  const [showPendingModal, setShowPendingModal] = useState(false);
  const [editModalUser, setEditModalUser] = useState<any>(null);
  const [editFormData, setEditFormData] = useState({
    role: "",
    max_bots: 0,
    is_active: true,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | number | null>(null);

  const { user: currentUser } = useAuth();
  const isAdmin = currentUser?.role === "admin";
  const isSupport = currentUser?.role === "support";
  const canChangeRole = isAdmin;
  const canPermanentDelete = isAdmin;

  const canEditUser = (target: { role?: string } | null) => {
    if (!target) return false;
    if (isAdmin) return true;
    if (isSupport && target.role !== "admin") return true;
    return false;
  };

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/users", {
        headers: authHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      }
    } catch (error) {
      console.error("Failed to fetch users", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    setSearchQuery(initialQuery);
  }, [initialQuery]);

  const handleApproveUser = async (userId: string | number) => {
    try {
      const res = await fetch(`/api/auth/users/${userId}/approve`, {
        method: "PATCH",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ is_approved: true, is_active: true }),
      });
      if (res.ok) {
        fetchUsers();
        toast.success("อนุมัติผู้ใช้เรียบร้อย");
      } else {
        toast.error("เกิดข้อผิดพลาดในการอนุมัติ");
      }
    } catch (error) {
      console.error("Approve error", error);
      toast.error("เกิดข้อผิดพลาดในการอนุมัติ");
    }
  };

  const deleteUserById = async (
    userId: string | number,
    successMessage: string
  ): Promise<boolean> => {
    setDeletingId(userId);
    try {
      const res = await fetch(`/api/auth/users/${userId}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        toast.success(successMessage);
        fetchUsers();
        return true;
      }
      const detail =
        typeof data?.detail === "string" ? data.detail : "ลบผู้ใช้ไม่สำเร็จ";
      toast.error(detail);
      return false;
    } catch (error) {
      console.error("Delete user error", error);
      toast.error("ลบผู้ใช้ไม่สำเร็จ");
      return false;
    } finally {
      setDeletingId(null);
    }
  };

  const handleRejectUser = async (userId: string | number) => {
    if (!window.confirm("คุณแน่ใจหรือไม่ว่าต้องการปฏิเสธและลบคำขอของผู้ใช้งานคนนี้?")) return;
    await deleteUserById(userId, "ปฏิเสธคำขอเรียบร้อย");
  };

  const restoreUser = async (userId: string | number) => {
    try {
      const res = await fetch(`/api/auth/users/${userId}/approve`, {
        method: "PATCH",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ is_approved: true, is_active: true }),
      });
      if (res.ok) {
        toast.success("ปลดระงับบัญชีเรียบร้อย");
        fetchUsers();
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(typeof data?.detail === "string" ? data.detail : "ปลดระงับไม่สำเร็จ");
      }
    } catch (error) {
      console.error("Restore error", error);
      toast.error("ปลดระงับไม่สำเร็จ");
    }
  };

  const filteredUsers = users.filter((u) => {
    const status = determineStatus(u);
    const matchSearch =
      u.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchStatus = statusFilter === "All Status" || status === statusFilter;
    return matchSearch && matchStatus;
  });

  const pendingUsersList = users.filter((u) => determineStatus(u) === "Pending");
  const bannedUsersList = users.filter((u) => determineStatus(u) === "Banned");
  const mainTableUsers = filteredUsers.filter(
    (u) => determineStatus(u) !== "Pending" && determineStatus(u) !== "Banned"
  );

  const stats = {
    total: users.length,
    active: users.filter((u) => determineStatus(u) === "Active").length,
    pending: pendingUsersList.length,
    banned: bannedUsersList.length,
  };

  const isEditingSelf = editModalUser?.id === currentUser?.id;
  const roleUsesBots = editFormData.role !== "support";

  return (
    <div className="p-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">จัดการผู้ใช้งาน</h1>
          <p className="mt-2 text-sm text-slate-500 max-w-2xl">
            {isSupport
              ? "งานหลักคือคิวสมัครสมาชิก — อนุมัติ ปฏิเสธ ระงับ และปลดระงับ เปลี่ยนบทบาทเป็น Admin และลบถาวรเป็นสิทธิ์ผู้ดูแลระบบ"
              : "จัดการบัญชีผู้ใช้งานทั้งหมด อนุมัติการเข้าถึง และดูจำนวนบอทของแต่ละร้าน — ไม่ต้องเข้าไปในบอทของร้านอื่น"}
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Total users</p>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{stats.total}</p>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Active</p>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{stats.active}</p>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Pending</p>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{stats.pending}</p>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Suspended</p>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{stats.banned}</p>
        </div>
      </div>

      <div className="mt-6 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-slate-200 bg-slate-50 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 shadow-sm">
              <Search className="w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ค้นหาชื่อหรืออีเมล"
                className="w-full border-0 bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
              />
            </div>

            <div className="relative">
              <button
                onClick={() => setShowStatusDropdown(!showStatusDropdown)}
                className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 shadow-sm hover:bg-slate-100 transition-colors"
              >
                {statusFilter === "All Status"
                  ? "ทุกสถานะ"
                  : statusLabel(statusFilter)}
                <ChevronDown className="w-4 h-4" />
              </button>
              {showStatusDropdown && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowStatusDropdown(false)} />
                  <div className="absolute top-full mt-1 w-44 rounded-lg border border-slate-200 bg-white shadow-lg z-20">
                    {[
                      { value: "All Status", label: "ทุกสถานะ" },
                      { value: "Active", label: "ใช้งานปกติ" },
                      { value: "Pending", label: "รออนุมัติ" },
                      { value: "Banned", label: "ถูกระงับ" },
                    ].map((item) => (
                      <button
                        key={item.value}
                        onClick={() => {
                          setStatusFilter(item.value);
                          setShowStatusDropdown(false);
                        }}
                        className="w-full px-4 py-2 text-left text-sm text-slate-600 hover:bg-slate-50 first:rounded-t-lg last:rounded-b-lg"
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            <button
              onClick={() => setShowPendingModal(true)}
              className="group relative flex items-center gap-2 overflow-hidden rounded-full bg-gradient-to-r from-amber-400 to-amber-500 px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm shadow-amber-200/60 transition-all hover:from-amber-500 hover:to-amber-600 hover:shadow-md"
            >
              <Hourglass className="w-4 h-4" />
              รออนุมัติ
              {pendingUsersList.length > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-slate-900 px-1.5 text-[10px] text-white">
                  {pendingUsersList.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setShowBannedModal(true)}
              className="group relative flex items-center gap-2 overflow-hidden rounded-full border border-rose-200 bg-white px-4 py-2 text-sm font-semibold text-rose-600 shadow-sm transition-all hover:border-rose-300 hover:bg-rose-50 hover:shadow-md"
            >
              <Ban className="w-4 h-4" />
              บัญชีที่ระงับ
              {bannedUsersList.length > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1.5 text-[10px] text-white">
                  {bannedUsersList.length}
                </span>
              )}
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-left text-sm">
            <thead>
              <tr className="bg-slate-100 text-slate-500">
                <th className="px-4 py-3">Username / Email</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">บอท</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Joined Date</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="text-center py-10 text-slate-400">
                    กำลังโหลดข้อมูล...
                  </td>
                </tr>
              ) : mainTableUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-10 text-slate-400">
                    ไม่พบผู้ใช้งาน
                  </td>
                </tr>
              ) : (
                mainTableUsers.map((user) => {
                  const status = determineStatus(user);
                  return (
                    <tr
                      key={user.id}
                      onClick={() => {
                        setEditModalUser(user);
                        setEditFormData({
                          role: user.role,
                          max_bots: user.max_bots || 5,
                          is_active: user.is_active,
                        });
                      }}
                      className="border-t border-slate-200 hover:bg-slate-50 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-4">
                        <p className="font-medium text-slate-900">{user.username}</p>
                        <p className="text-xs text-slate-500">{user.email}</p>
                      </td>
                      <td className="px-4 py-4 text-slate-600 capitalize">{user.role}</td>
                      <td className="px-4 py-4 text-slate-700 font-medium">
                        {user.role === "support"
                          ? "—"
                          : `${user.bot_count ?? 0}/${user.max_bots || 5}`}
                      </td>
                      <td className="px-4 py-4">
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-[11px] font-semibold ${getStatusClass(status)}`}
                        >
                          {statusLabel(status)}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-slate-600">
                        {new Date(user.created_at).toLocaleDateString("th-TH")}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal แก้ไขผู้ใช้ — ระงับได้ แต่ลบถาวรไม่ได้ */}
      {editModalUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b pb-4">
              <h2 className="text-xl font-bold text-slate-900">
                {canEditUser(editModalUser) ? "แก้ไขข้อมูลผู้ใช้งาน" : "รายละเอียดผู้ใช้งาน"}
              </h2>
              <button
                onClick={() => setEditModalUser(null)}
                className="rounded-full p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-6 space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold uppercase text-slate-400">
                    Username
                  </label>
                  <p className="text-sm font-medium text-slate-700">
                    {editModalUser.username}
                  </p>
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase text-slate-400">
                    Email
                  </label>
                  <p className="text-sm font-medium text-slate-700 truncate">
                    {editModalUser.email}
                  </p>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold uppercase text-slate-400">
                  บทบาท (Role)
                </label>
                <select
                  disabled={!canChangeRole}
                  value={editFormData.role}
                  onChange={(e) =>
                    setEditFormData({ ...editFormData, role: e.target.value })
                  }
                  className="mt-1 w-full rounded-lg border border-slate-200 p-2.5 text-sm outline-none focus:ring-2 focus:ring-amber-400 disabled:bg-slate-50 disabled:text-slate-500"
                >
                  <option value="user">User</option>
                  <option value="support">Support</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold uppercase text-slate-400">
                  จำนวนบอทสูงสุด (Max Bots)
                </label>
                <input
                  type="number"
                  disabled={!canEditUser(editModalUser) || !roleUsesBots}
                  value={roleUsesBots ? editFormData.max_bots : 0}
                  onChange={(e) =>
                    setEditFormData({
                      ...editFormData,
                      max_bots: parseInt(e.target.value) || 0,
                    })
                  }
                  className="mt-1 w-full rounded-lg border border-slate-200 p-2.5 text-sm outline-none focus:ring-2 focus:ring-amber-400 disabled:bg-slate-100 disabled:text-slate-400"
                />
                {!roleUsesBots && (
                  <p className="mt-1.5 text-[11px] text-slate-400">
                    บัญชี Support ไม่ได้สร้างบอท จึงไม่ต้องกำหนดโควต้า
                  </p>
                )}
              </div>

              {/* ปุ่มระงับแบบ segmented control */}
              <div>
                <label className="text-xs font-semibold uppercase text-slate-400">
                  สถานะบัญชี
                </label>
                <div
                  className={`mt-2 grid grid-cols-2 gap-1 rounded-2xl border p-1 ${
                    editFormData.is_active
                      ? "border-emerald-200 bg-emerald-50/50"
                      : "border-rose-200 bg-rose-50/50"
                  }`}
                >
                  <button
                    type="button"
                    disabled={!canEditUser(editModalUser) || isEditingSelf}
                    onClick={() =>
                      setEditFormData({ ...editFormData, is_active: true })
                    }
                    className={`flex items-center justify-center gap-2 rounded-xl px-3 py-3 text-sm font-semibold transition-all ${
                      editFormData.is_active
                        ? "bg-white text-emerald-700 shadow-sm ring-1 ring-emerald-200"
                        : "text-slate-500 hover:text-slate-700"
                    } disabled:cursor-not-allowed disabled:opacity-50`}
                  >
                    <ShieldCheck className="w-4 h-4" />
                    ใช้งานปกติ
                  </button>
                  <button
                    type="button"
                    disabled={!canEditUser(editModalUser) || isEditingSelf}
                    onClick={() =>
                      setEditFormData({ ...editFormData, is_active: false })
                    }
                    className={`flex items-center justify-center gap-2 rounded-xl px-3 py-3 text-sm font-semibold transition-all ${
                      !editFormData.is_active
                        ? "bg-white text-rose-600 shadow-sm ring-1 ring-rose-200"
                        : "text-slate-500 hover:text-slate-700"
                    } disabled:cursor-not-allowed disabled:opacity-50`}
                  >
                    <Ban className="w-4 h-4" />
                    ระงับบัญชี
                  </button>
                </div>
                <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
                  {isEditingSelf
                    ? "ไม่สามารถระงับบัญชีของตัวเองได้"
                    : editFormData.is_active
                      ? canPermanentDelete
                        ? "บัญชีใช้งานได้ตามปกติ หากต้องการลบถาวร ให้ระงับบัญชีก่อน แล้วไปที่รายการบัญชีที่ระงับ"
                        : "บัญชีใช้งานได้ตามปกติ สามารถระงับได้ถ้าผู้ใช้ผิดเงื่อนไข"
                      : canPermanentDelete
                        ? "บัญชีถูกระงับ — ผู้ใช้จะเข้าสู่ระบบไม่ได้ ลบถาวรได้จากรายการบัญชีที่ระงับเท่านั้น"
                        : "บัญชีถูกระงับ — ผู้ใช้จะเข้าสู่ระบบไม่ได้"}
                </p>
              </div>

              {isAdmin && (
                <button
                  onClick={() => toast.message("ระบบกำลังส่งอีเมลรีเซ็ตรหัสผ่าน...")}
                  className="w-full rounded-lg border border-slate-200 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  รีเซ็ตรหัสผ่านพนักงาน
                </button>
              )}
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setEditModalUser(null)}
                className="flex-1 rounded-xl bg-slate-100 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-200 transition-colors"
              >
                {canEditUser(editModalUser) ? "ยกเลิก" : "ปิดหน้าต่าง"}
              </button>
              {canEditUser(editModalUser) && (
                <button
                  disabled={isSaving}
                  className="flex-1 rounded-xl bg-amber-400 py-3 text-sm font-semibold text-slate-900 hover:bg-amber-500 transition-colors disabled:opacity-60"
                  onClick={async () => {
                    setIsSaving(true);
                    try {
                      const payload: Record<string, unknown> = {
                        is_approved: true,
                        is_active: editFormData.is_active,
                      };
                      if (roleUsesBots) {
                        payload.max_bots = editFormData.max_bots;
                      }
                      if (canChangeRole) {
                        payload.role = editFormData.role;
                      }
                      const res = await fetch(
                        `/api/auth/users/${editModalUser.id}/approve`,
                        {
                          method: "PATCH",
                          headers: {
                            ...authHeaders(),
                            "Content-Type": "application/json",
                          },
                          body: JSON.stringify(payload),
                        }
                      );

                      if (res.ok) {
                        const wasSuspended =
                          editModalUser.is_active && !editFormData.is_active;
                        fetchUsers();
                        setEditModalUser(null);
                        toast.success(
                          wasSuspended
                            ? canPermanentDelete
                              ? "ระงับบัญชีเรียบร้อย — ลบถาวรได้จากรายการบัญชีที่ระงับ"
                              : "ระงับบัญชีเรียบร้อย"
                            : "บันทึกข้อมูลผู้ใช้เรียบร้อย"
                        );
                      } else {
                        const data = await res.json().catch(() => ({}));
                        toast.error(
                          typeof data?.detail === "string"
                            ? data.detail
                            : "เกิดข้อผิดพลาดในการบันทึกข้อมูล"
                        );
                      }
                    } catch (error) {
                      console.error("Save error", error);
                      toast.error("เกิดข้อผิดพลาดในการบันทึกข้อมูล");
                    } finally {
                      setIsSaving(false);
                    }
                  }}
                >
                  {isSaving ? "กำลังบันทึก..." : "บันทึกการเปลี่ยนแปลง"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Pending modal */}
      {showPendingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-900">รอการอนุมัติ</h2>
                <p className="text-sm text-slate-500 mt-1">
                  ผู้ใช้งานที่สมัครสมาชิกเข้ามาใหม่ และรอสิทธิ์การเข้าใช้งานระบบ
                </p>
              </div>
              <button
                onClick={() => setShowPendingModal(false)}
                className="rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="max-h-[50vh] overflow-y-auto">
              {pendingUsersList.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                  <CheckCircle className="w-12 h-12 mb-3 text-emerald-400" />
                  <p>ไม่มีคำขอที่รอการอนุมัติในขณะนี้</p>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {pendingUsersList.map((user) => (
                    <div
                      key={user.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-4"
                    >
                      <div className="mb-3 sm:mb-0">
                        <p className="font-semibold text-slate-900">{user.username}</p>
                        <p className="text-sm text-slate-500">{user.email}</p>
                        <p className="text-xs text-slate-400 mt-1">
                          สมัครเมื่อ:{" "}
                          {new Date(user.created_at).toLocaleDateString("th-TH")}
                        </p>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <button
                          onClick={() => handleRejectUser(user.id)}
                          className="rounded-lg border border-rose-200 bg-white px-4 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50 hover:border-rose-300 transition-colors"
                        >
                          ปฏิเสธ
                        </button>
                        <button
                          onClick={() => handleApproveUser(user.id)}
                          className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-600 transition-colors"
                        >
                          อนุมัติ
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Suspended modal — ที่เดียวที่ลบถาวรได้ */}
      {showBannedModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-xl">
            <div className="border-b border-rose-100 bg-gradient-to-r from-rose-50 to-white px-6 py-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-100 text-rose-600">
                    <Ban className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">บัญชีที่ถูกระงับ</h2>
                    <p className="mt-1 text-sm text-slate-500">
                      ปลดระงับเพื่อให้ใช้งานต่อ หรือลบบัญชีออกจากระบบอย่างถาวร
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowBannedModal(false)}
                  className="rounded-full p-2 text-slate-400 transition-colors hover:bg-white hover:text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="max-h-[50vh] space-y-3 overflow-y-auto p-6">
              {bannedUsersList.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                  <ShieldCheck className="mb-3 h-12 w-12 text-emerald-400" />
                  <p>ไม่มีบัญชีที่ถูกระงับในขณะนี้</p>
                </div>
              ) : (
                bannedUsersList.map((user) => (
                  <div
                    key={user.id}
                    className="flex flex-col gap-3 rounded-2xl border border-rose-100 bg-rose-50/40 p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-slate-900">{user.username}</p>
                        <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-semibold text-rose-600">
                          ถูกระงับ
                        </span>
                      </div>
                      <p className="truncate text-sm text-slate-500">{user.email}</p>
                      <p className="mt-1 text-xs capitalize text-slate-400">
                        {user.role} · สมัคร{" "}
                        {new Date(user.created_at).toLocaleDateString("th-TH")}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      {canEditUser(user) && (
                        <button
                          onClick={() => restoreUser(user.id)}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-semibold text-slate-700 shadow-sm transition-all hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          ปลดระงับ
                        </button>
                      )}
                      {canPermanentDelete && (
                        <button
                          disabled={deletingId === user.id}
                          onClick={async () => {
                            if (
                              !window.confirm(
                                `ลบผู้ใช้ "${user.username}" อย่างถาวร? บอทและเอกสารของคนนี้จะถูกลบด้วย และกู้คืนไม่ได้`
                              )
                            )
                              return;
                            await deleteUserById(user.id, "ลบผู้ใช้เรียบร้อย");
                          }}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-rose-500 px-3.5 py-2.5 text-xs font-semibold text-white shadow-sm shadow-rose-200 transition-all hover:bg-rose-600 disabled:opacity-60"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          {deletingId === user.id ? "กำลังลบ..." : "ลบถาวร"}
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
