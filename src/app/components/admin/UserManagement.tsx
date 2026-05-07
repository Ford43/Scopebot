import { useState, useEffect } from "react";
import { Search, ChevronDown, Hourglass, Eye, Trash2, CheckCircle } from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent } from "../ui/tooltip";
import { 
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, 
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, 
  AlertDialogTitle, AlertDialogTrigger 
} from "../ui/alert-dialog";

// 1. ฟังก์ชันช่วยเหลือสำหรับแปลงสถานะสี
function getStatusClass(status: string) {
  switch (status) {
    case "Active": return "bg-emerald-100 text-emerald-700";
    case "Inactive": return "bg-slate-100 text-slate-600";
    case "Banned": return "bg-rose-100 text-rose-700";
    case "Pending": return "bg-sky-100 text-sky-700";
    default: return "bg-gray-100 text-gray-600";
  }
}

// แปลงข้อมูลจาก DB ให้เป็นสถานะที่อ่านง่าย
function determineStatus(user: any) {
  if (!user.is_approved) return "Pending";
  if (!user.is_active) return "Banned";
  return "Active";
}

// 2. React Component หลัก
export default function UserManagement() {
  const [users, setUsers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // States สำหรับ UI
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("All Roles");
  const [statusFilter, setStatusFilter] = useState("All Status");
  const [showRoleDropdown, setShowRoleDropdown] = useState(false);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<Set<string | number>>(new Set());
  const [userToDelete, setUserToDelete] = useState<string | number | null>(null);

  //State สำหรับเปิด/ปิด Popup Pending
  const [showPendingModal, setShowPendingModal] = useState(false);

  const token = localStorage.getItem("scopebot_token");

  // 🟢 2.1 ดึงข้อมูลผู้ใช้ทั้งหมดจาก API
  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/users", {
        headers: { "Authorization": `Bearer ${token}` }
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
  }, [token]);

  // ฟังก์ชันอนุมัติผู้ใช้งาน (Approve)
  const handleApproveUser = async (userId: string | number) => {
    try {
      const res = await fetch(`/api/auth/users/${userId}/approve`, {
        method: "PATCH",
        headers: { 
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ is_approved: true, is_active: true })
      });
      if (res.ok) {
        fetchUsers(); // โหลดข้อมูลใหม่ทันที
      } else {
        alert("เกิดข้อผิดพลาดในการอนุมัติ");
      }
    } catch (error) {
      console.error("Approve error", error);
    }
  };

  // ฟังก์ชันปฏิเสธ/ลบ ผู้ใช้งาน (Reject)
  const handleRejectUser = async (userId: string | number) => {
    if (!window.confirm("คุณแน่ใจหรือไม่ว่าต้องการปฏิเสธและลบคำขอของผู้ใช้งานคนนี้?")) return;
    try {
      // ตรงนี้สมมติว่าเป็น endpoint ลบ user ของคุณ (ปรับใช้ตาม Backend ที่มีจริง)
      const res = await fetch(`/api/auth/users/${userId}`, { 
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        fetchUsers();
      } else {
        alert("เกิดข้อผิดพลาดในการปฏิเสธคำขอ");
      }
    } catch (error) {
      console.error("Reject error", error);
    }
  };

  // กรองผู้ใช้งานตาม Search และ Dropdown
  const filteredUsers = users.filter((u) => {
    const status = determineStatus(u);
    const matchSearch = u.username?.toLowerCase().includes(searchQuery.toLowerCase()) || 
                        u.email?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchRole   = roleFilter === "All Roles" || u.role.toLowerCase() === roleFilter.toLowerCase();
    const matchStatus = statusFilter === "All Status" || status === statusFilter;
    return matchSearch && matchRole && matchStatus;
  });

  //แยกรายชื่อที่เป็น Pending ออกมาโดยเฉพาะ (เพื่อไปแสดงใน Popup)
  const pendingUsersList = users.filter((u) => determineStatus(u) === "Pending");
  // รายชื่อสำหรับตารางหลัก (ซ่อนคนที่เป็น Pending ออกไปเลย)
  const mainTableUsers = filteredUsers.filter((u) => determineStatus(u) !== "Pending");

  // คำนวณสถิติ
  const stats = {
    total: users.length,
    active: users.filter(u => determineStatus(u) === "Active").length,
    pending: users.filter(u => determineStatus(u) === "Pending").length,
    banned: users.filter(u => determineStatus(u) === "Banned").length,
  };

  return (
    <div className="p-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">User Management</h1>
          <p className="mt-2 text-sm text-slate-500 max-w-2xl">
            จัดการบัญชีผู้ใช้งานทั้งหมด อนุมัติการเข้าถึง และตรวจสอบสถานะระบบ
          </p>
        </div>
      </div>

      {/* สถิติ */}
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
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Banned</p>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{stats.banned}</p>
        </div>
      </div>

      <div className="mt-6 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        {/* แถบเครื่องมือค้นหา */}
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
            {/* Status Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowStatusDropdown(!showStatusDropdown)}
                className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 shadow-sm hover:bg-slate-100 transition-colors"
              >
                {statusFilter}
                <ChevronDown className="w-4 h-4" />
              </button>
              {showStatusDropdown && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowStatusDropdown(false)} />
                  <div className="absolute top-full mt-1 w-40 rounded-lg border border-slate-200 bg-white shadow-lg z-20">
                    {["All Status", "Active", "Pending", "Banned"].map((status) => (
                      <button
                        key={status}
                        onClick={() => { setStatusFilter(status); setShowStatusDropdown(false); }}
                        className="w-full px-4 py-2 text-left text-sm text-slate-600 hover:bg-slate-50 first:rounded-t-lg last:rounded-b-lg"
                      >
                        {status}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
            {/* ปุ่มเปิด Popup Pending (อยู่ข้างๆ All Status) */}
            <button
              onClick={() => setShowPendingModal(true)}
              className="flex items-center gap-2 rounded-full bg-amber-400 px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm hover:bg-amber-500 transition-colors"
            >
              <Hourglass className="w-4 h-4" />
              Pending
              {/* แสดงตัวเลข Notification ว่ามีกี่คน */}
              {pendingUsersList.length > 0 && (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-900 text-[10px] text-white">
                  {pendingUsersList.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* ตารางรายชื่อ */}
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-left text-sm">
            <thead>
              <tr className="bg-slate-100 text-slate-500">
                <th className="px-4 py-3">Username / Email</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Joined Date</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={5} className="text-center py-10 text-slate-400">กำลังโหลดข้อมูล...</td></tr>
              ) : mainTableUsers.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-10 text-slate-400">ไม่พบผู้ใช้งาน</td></tr>
              ) : (
                mainTableUsers.map((user) => {
                  const status = determineStatus(user);
                  return (
                    <tr key={user.id} className="border-t border-slate-200 hover:bg-slate-50">
                      <td className="px-4 py-4">
                        <p className="font-medium text-slate-900">{user.username}</p>
                        <p className="text-xs text-slate-500">{user.email}</p>
                      </td>
                      <td className="px-4 py-4 text-slate-600 capitalize">{user.role}</td>
                      <td className="px-4 py-4">
                        <span className={`inline-flex rounded-full px-3 py-1 text-[11px] font-semibold ${getStatusClass(status)}`}>
                          {status}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-slate-600">
                        {new Date(user.created_at).toLocaleDateString('th-TH')}
                      </td>
                      <td className="px-4 py-4 flex items-center justify-end gap-2 text-slate-500">
                        
                        {/* 🟢 ปุ่มอนุมัติ (จะแสดงเฉพาะคนที่มีสถานะ Pending) */}
                        {status === "Pending" && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button 
                                onClick={() => setStatusFilter("Pending")}
                                className="inline-flex items-center gap-2 rounded-full bg-amber-400 px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm hover:bg-amber-500 transition-colors"
                              >
                                Pending
                                <Hourglass className="w-4 h-4" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="top">คลิกเพื่อดูกรองเฉพาะคนที่รออนุมัติ</TooltipContent>
                          </Tooltip>
                        )}

                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button className="rounded-full p-2 hover:bg-red-50 hover:text-red-600 transition-colors">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="top">ลบผู้ใช้</TooltipContent>
                        </Tooltip>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
      {/* Popup (Modal) รายการผู้ใช้งานที่รออนุมัติ (Pending) */}
      {showPendingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl">
            {/* ส่วนหัว Popup */}
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-900">รอการอนุมัติ (Pending)</h2>
                <p className="text-sm text-slate-500 mt-1">ผู้ใช้งานที่สมัครสมาชิกเข้ามาใหม่ และรอสิทธิ์การเข้าใช้งานระบบ</p>
              </div>
              <button 
                onClick={() => setShowPendingModal(false)} 
                className="text-slate-400 hover:text-slate-600 rounded-full p-2 hover:bg-slate-100 transition-colors"
              >
                ✕ {/* ไอคอนปิด */}
              </button>
            </div>
            
            {/* ส่วนรายการ Pending */}
            <div className="max-h-[50vh] overflow-y-auto">
              {pendingUsersList.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                  <CheckCircle className="w-12 h-12 mb-3 text-emerald-400" />
                  <p>ไม่มีคำขอที่รอการอนุมัติในขณะนี้</p>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {pendingUsersList.map((user) => (
                    <div key={user.id} className="flex flex-col sm:flex-row sm:items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <div className="mb-3 sm:mb-0">
                        <p className="font-semibold text-slate-900">{user.username}</p>
                        <p className="text-sm text-slate-500">{user.email}</p>
                        <p className="text-xs text-slate-400 mt-1">
                          สมัครเมื่อ: {new Date(user.created_at).toLocaleDateString('th-TH')}
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
    </div>
  );
}