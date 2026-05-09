<<<<<<< HEAD
import { useState } from "react";
import { Search, ChevronDown, Hourglass, Eye, Trash2 } from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent } from "../ui/tooltip";
=======
import { useState, useEffect } from "react";
import { Search, ChevronDown, Hourglass, Eye, Trash2, CheckCircle } from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent } from "../ui/tooltip";
import { useAuth } from "../../contexts/AuthContext";
>>>>>>> master
import { 
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, 
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, 
  AlertDialogTitle, AlertDialogTrigger 
} from "../ui/alert-dialog";

<<<<<<< HEAD
// 1. ข้อมูลจำลองและฟังก์ชันช่วยเหลือ (อยู่นอก Component)
const userManagementUsers = [
  { id: "1", name: "John Smith", email: "john.smith@gmail.com", username: "jonny77", status: "Active", role: "Admin", joined: "March 12, 2023", lastActive: "1 minute ago" },
  { id: "2", name: "Olivia Bennett", email: "ollyben@gmail.com", username: "olly659", status: "Inactive", role: "User", joined: "June 27, 2022", lastActive: "1 month ago" },
  { id: "3", name: "Daniel Warren", email: "dwarren3@gmail.com", username: "dwarren3", status: "Banned", role: "User", joined: "January 8, 2024", lastActive: "4 days ago" },
  { id: "4", name: "Chloe Hayes", email: "chloehhye@gmail.com", username: "chloehh", status: "Pending", role: "Guest", joined: "October 5, 2021", lastActive: "10 days ago" },
  { id: "5", name: "Marcus Reed", email: "reeds777@gmail.com", username: "reeds7", status: "Suspended", role: "User", joined: "February 19, 2023", lastActive: "3 months ago" },
  { id: "6", name: "Isabelle Clark", email: "belleclark@gmail.com", username: "bellecl", status: "Active", role: "Moderator", joined: "August 30, 2022", lastActive: "1 week ago" },
];

=======
// 1. ฟังก์ชันช่วยเหลือสำหรับแปลงสถานะสี
>>>>>>> master
function getStatusClass(status: string) {
  switch (status) {
    case "Active": return "bg-emerald-100 text-emerald-700";
    case "Inactive": return "bg-slate-100 text-slate-600";
    case "Banned": return "bg-rose-100 text-rose-700";
    case "Pending": return "bg-sky-100 text-sky-700";
<<<<<<< HEAD
    case "Suspended": return "bg-amber-100 text-amber-700";
=======
>>>>>>> master
    default: return "bg-gray-100 text-gray-600";
  }
}

<<<<<<< HEAD
// 2. React Component หลัก
export default function UserManagement() {
  // 2.1 State Variables (ต้องอยู่ข้างใน Component)
  const [roleFilter, setRoleFilter] = useState("All Roles");
  const [statusFilter, setStatusFilter] = useState("All Status");
  const [dateFilter, setDateFilter] = useState("All Dates");
  const [showRoleDropdown, setShowRoleDropdown] = useState(false);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [showDateDropdown, setShowDateDropdown] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [userToDelete, setUserToDelete] = useState<string | null>(null);

  // 2.2 Handlers (ต้องอยู่ข้างใน Component เพราะมีการเรียกใช้ State ด้านบน)
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedUsers(new Set(userManagementUsers.map(u => u.id)));
    } else {
      setSelectedUsers(new Set());
    }
  };

  const handleSelectUser = (userId: string, checked: boolean) => {
    const newSelected = new Set(selectedUsers);
    if (checked) {
      newSelected.add(userId);
    } else {
      newSelected.delete(userId);
    }
    setSelectedUsers(newSelected);
  };

  const handleDeleteUser = (userId: string) => {
    console.log(`Deleting user ${userId}`);
    setUserToDelete(null);
  };

  const handleBulkDelete = () => {
    console.log(`Deleting users:`, Array.from(selectedUsers));
    setSelectedUsers(new Set());
  };

  // 2.3 UI / JSX 
=======
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

  const { user: currentUser } = useAuth(); // ดึงข้อมูล User ที่กำลัง Login อยู่
  const isAdmin = currentUser?.role === "admin";
  const isSupport = currentUser?.role === "support";

  // เพิ่ม State สำหรับ Modal Banned
  const [showBannedModal, setShowBannedModal] = useState(false);

  // State สำหรับ Modal แก้ไขข้อมูล
  const [editModalUser, setEditModalUser] = useState<any>(null);
  const [editFormData, setEditFormData] = useState({
    role: "",
    max_bots: 0,
    is_active: true
  });

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

  // 1. กรองผู้ใช้งานตาม Search และ Dropdown (ตัวแปรนี้ต้องอยู่บนสุดของกลุ่ม)
  const filteredUsers = users.filter((u) => {
    const status = determineStatus(u);
    const matchSearch = u.username?.toLowerCase().includes(searchQuery.toLowerCase()) || 
                        u.email?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchRole   = roleFilter === "All Roles" || u.role.toLowerCase() === roleFilter.toLowerCase();
    const matchStatus = statusFilter === "All Status" || status === statusFilter;
    return matchSearch && matchRole && matchStatus;
  });

  // 2. แยกรายชื่อตามสถานะ (ให้วาง 3 บรรทัดนี้ "ต่อท้าย" filteredUsers เท่านั้น)
  const pendingUsersList = users.filter((u) => determineStatus(u) === "Pending");
  const bannedUsersList  = users.filter((u) => determineStatus(u) === "Banned");
  const mainTableUsers = filteredUsers.filter(
    (u) => determineStatus(u) !== "Pending" && determineStatus(u) !== "Banned"
  );

  // คำนวณสถิติ
  const stats = {
    total: users.length,
    active: users.filter(u => determineStatus(u) === "Active").length,
    pending: users.filter(u => determineStatus(u) === "Pending").length,
    banned: users.filter(u => determineStatus(u) === "Banned").length,
  };

>>>>>>> master
  return (
    <div className="p-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
<<<<<<< HEAD
          <h1 className="text-2xl font-semibold text-slate-900">User Management</h1>
          <p className="mt-2 text-sm text-slate-500 max-w-2xl">
            Manage all users in one place. Control access, assign roles, and monitor activity across your platform.
=======
          <h1 className="text-2xl font-semibold text-slate-900">จัดการผู้ใช้งาน</h1>
          <p className="mt-2 text-sm text-slate-500 max-w-2xl">
            จัดการบัญชีผู้ใช้งานทั้งหมด อนุมัติการเข้าถึง และตรวจสอบสถานะระบบ
>>>>>>> master
          </p>
        </div>
      </div>

<<<<<<< HEAD
      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Total users</p>
          <p className="mt-3 text-3xl font-semibold text-slate-900">1,420</p>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Active</p>
          <p className="mt-3 text-3xl font-semibold text-slate-900">842</p>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Pending</p>
          <p className="mt-3 text-3xl font-semibold text-slate-900">112</p>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Banned</p>
          <p className="mt-3 text-3xl font-semibold text-slate-900">26</p>
=======
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
>>>>>>> master
        </div>
      </div>

      <div className="mt-6 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
<<<<<<< HEAD
=======
        {/* แถบเครื่องมือค้นหา */}
>>>>>>> master
        <div className="flex flex-col gap-4 border-b border-slate-200 bg-slate-50 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 shadow-sm">
              <Search className="w-4 h-4 text-slate-400" />
              <input
                type="text"
<<<<<<< HEAD
                placeholder="search name"
                className="w-full border-0 bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
              />
            </div>

            {/* Role Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowRoleDropdown(!showRoleDropdown)}
                className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 shadow-sm hover:bg-slate-100 transition-colors"
              >
                {roleFilter}
                <ChevronDown className="w-4 h-4" />
              </button>
              {showRoleDropdown && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowRoleDropdown(false)} />
                  <div className="absolute top-full mt-1 w-40 rounded-lg border border-slate-200 bg-white shadow-lg z-20">
                    {["All Roles", "Admin", "User", "Moderator", "Guest"].map((role) => (
                      <button
                        key={role}
                        onClick={() => { setRoleFilter(role); setShowRoleDropdown(false); }}
                        className="w-full px-4 py-2 text-left text-sm text-slate-600 hover:bg-slate-50 first:rounded-t-lg last:rounded-b-lg"
                      >
                        {role}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

=======
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ค้นหาชื่อหรืออีเมล"
                className="w-full border-0 bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
              />
            </div>
>>>>>>> master
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
<<<<<<< HEAD
                    {["All Status", "Active", "Inactive", "Pending", "Banned", "Suspended"].map((status) => (
=======
                    {["All Status", "Active", "Pending", "Banned"].map((status) => (
>>>>>>> master
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
<<<<<<< HEAD

            {/* Date Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowDateDropdown(!showDateDropdown)}
                className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 shadow-sm hover:bg-slate-100 transition-colors"
              >
                {dateFilter}
                <ChevronDown className="w-4 h-4" />
              </button>
              {showDateDropdown && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowDateDropdown(false)} />
                  <div className="absolute top-full mt-1 w-40 rounded-lg border border-slate-200 bg-white shadow-lg z-20">
                    {["All Dates", "Last 7 days", "Last 30 days", "Last 3 months", "Last year"].map((date) => (
                      <button
                        key={date}
                        onClick={() => { setDateFilter(date); setShowDateDropdown(false); }}
                        className="w-full px-4 py-2 text-left text-sm text-slate-600 hover:bg-slate-50 first:rounded-t-lg last:rounded-b-lg"
                      >
                        {date}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            {selectedUsers.size > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-600">{selectedUsers.size} selected</span>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <button className="rounded-full border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-600 shadow-sm hover:bg-red-100 transition-colors">
                      Delete Selected
                    </button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Users</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to delete {selectedUsers.size} selected user(s)? This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleBulkDelete} className="bg-red-600 hover:bg-red-700">
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            )}
            <button className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 shadow-sm hover:bg-slate-100 transition-colors">
              Export
            </button>
            <Tooltip>
              <TooltipTrigger asChild>
                <button className="inline-flex items-center gap-2 rounded-full bg-amber-400 px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm hover:bg-amber-500 transition-colors">
                  Pending
                  <Hourglass className="w-4 h-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">Pending items</TooltipContent>
            </Tooltip>
          </div>
        </div>

=======
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

            {/*  ปุ่มกลุ่ม Banned */}
            <button
              onClick={() => setShowBannedModal(true)}
              className="flex items-center gap-2 rounded-full bg-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-300 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Banned
              {bannedUsersList.length > 0 && (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-rose-500 text-[10px] text-white">
                  {bannedUsersList.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* ตารางรายชื่อ */}
>>>>>>> master
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-left text-sm">
            <thead>
              <tr className="bg-slate-100 text-slate-500">
<<<<<<< HEAD
                <th className="w-12 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selectedUsers.size === userManagementUsers.length && userManagementUsers.length > 0}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    className="h-4 w-4 text-amber-500"
                  />
                </th>
                <th className="px-4 py-3">Full Name</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Username</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Joined Date</th>
                <th className="px-4 py-3">Last Active</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {userManagementUsers.map((user) => (
                <tr key={user.id} className="border-t border-slate-200 hover:bg-slate-50">
                  <td className="px-4 py-4">
                    <input
                      type="checkbox"
                      checked={selectedUsers.has(user.id)}
                      onChange={(e) => handleSelectUser(user.id, e.target.checked)}
                      className="h-4 w-4 text-amber-500"
                    />
                  </td>
                  <td className="px-4 py-4 font-medium text-slate-900">{user.name}</td>
                  <td className="px-4 py-4 text-slate-600">{user.email}</td>
                  <td className="px-4 py-4 text-slate-600">{user.username}</td>
                  <td className="px-4 py-4">
                    <span className={`inline-flex rounded-full px-3 py-1 text-[11px] font-semibold ${getStatusClass(user.status)}`}>
                      {user.status}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-slate-600">{user.role}</td>
                  <td className="px-4 py-4 text-slate-600">{user.joined}</td>
                  <td className="px-4 py-4 text-slate-600">{user.lastActive}</td>
                  <td className="px-4 py-4 flex items-center gap-2 text-slate-500">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button className="rounded-full p-2 hover:bg-slate-100 transition-colors">
                          <Eye className="w-4 h-4" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="top">View user</TooltipContent>
                    </Tooltip>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <button
                          className="rounded-full p-2 hover:bg-red-50 hover:text-red-600 transition-colors"
                          onClick={() => setUserToDelete(user.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete User</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete "{user.name}"? This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDeleteUser(user.id)}
                            className="bg-red-600 hover:bg-red-700"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-3 border-t border-slate-200 bg-slate-50 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-500">Rows per page: <span className="font-semibold text-slate-900">10</span> of 140</p>
          <div className="flex items-center gap-2">
            <button className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 shadow-sm hover:bg-slate-100 transition-colors">&laquo;</button>
            <button className="rounded-full bg-slate-900 px-3 py-2 text-sm font-semibold text-white">1</button>
            <button className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 shadow-sm hover:bg-slate-100 transition-colors">2</button>
            <button className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 shadow-sm hover:bg-slate-100 transition-colors">3</button>
            <button className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 shadow-sm hover:bg-slate-100 transition-colors">...</button>
            <button className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 shadow-sm hover:bg-slate-100 transition-colors">10</button>
            <button className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 shadow-sm hover:bg-slate-100 transition-colors">&raquo;</button>
          </div>
        </div>
      </div>
=======
                <th className="px-4 py-3">Username / Email</th>
                <th className="px-4 py-3">Role</th>
                {/* เพิ่มหัวตาราง Max Bots */}
                <th className="px-4 py-3">Max Bots</th> 
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Joined Date</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={5} className="text-center py-10 text-slate-400">กำลังโหลดข้อมูล...</td></tr>
              ) : mainTableUsers.length === 0 ? ( // 🟢 เปลี่ยนจาก filteredUsers เป็น mainTableUsers
                <tr><td colSpan={5} className="text-center py-10 text-slate-400">ไม่พบผู้ใช้งาน</td></tr>
              ) : (
                mainTableUsers.map((user) => { // 🟢 เปลี่ยนจาก filteredUsers เป็น mainTableUsers
                  const status = determineStatus(user);
                  return (
                    <tr 
                      key={user.id} 
                      onClick={() => {
                        setEditModalUser(user);
                        setEditFormData({
                          role: user.role,
                          max_bots: user.max_bots || 5,
                          is_active: user.is_active
                        });
                      }}
                      className="border-t border-slate-200 hover:bg-slate-50 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-4">
                        <p className="font-medium text-slate-900">{user.username}</p>
                        <p className="text-xs text-slate-500">{user.email}</p>
                      </td>
                      <td className="px-4 py-4 text-slate-600 capitalize">{user.role}</td>
                      <td className="px-4 py-4 text-slate-700 font-medium">{user.max_bots || 5}</td>
                      <td className="px-4 py-4">
                        <span className={`inline-flex rounded-full px-3 py-1 text-[11px] font-semibold ${getStatusClass(status)}`}>
                          {status}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-slate-600">
                        {new Date(user.created_at).toLocaleDateString('th-TH')}
                      </td>
                      {/* 🟢 ลบ td ของ Actions ออกไปแล้ว */}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal แก้ไข/ดูข้อมูลผู้ใช้งาน (โค้ดเต็ม) */}
      {editModalUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b pb-4">
              <h2 className="text-xl font-bold text-slate-900">
                {isAdmin ? "แก้ไขข้อมูลผู้ใช้งาน" : "รายละเอียดผู้ใช้งาน"}
              </h2>
              <button onClick={() => setEditModalUser(null)} className="text-slate-400 hover:text-slate-600 transition-colors">✕</button>
            </div>

            <div className="mt-6 space-y-4">
              {/* ข้อมูลพื้นฐาน (ดูได้อย่างเดียวทั้งคู่) */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold uppercase text-slate-400">Username</label>
                  <p className="text-sm font-medium text-slate-700">{editModalUser.username}</p>
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase text-slate-400">Email</label>
                  <p className="text-sm font-medium text-slate-700 truncate">{editModalUser.email}</p>
                </div>
              </div>

              {/* ส่วนที่ Admin แก้ไขได้ แต่ Support ดูได้อย่างเดียว */}
              <div>
                <label className="text-xs font-semibold uppercase text-slate-400">บทบาท (Role)</label>
                <select 
                  disabled={!isAdmin}
                  value={editFormData.role}
                  onChange={(e) => setEditFormData({...editFormData, role: e.target.value})}
                  className="mt-1 w-full rounded-lg border border-slate-200 p-2.5 text-sm outline-none focus:ring-2 focus:ring-amber-400 disabled:bg-slate-50 disabled:text-slate-500"
                >
                  <option value="user">User</option>
                  <option value="support">Support</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold uppercase text-slate-400">จำนวนบอทสูงสุด (Max Bots)</label>
                <input 
                  type="number"
                  disabled={!isAdmin}
                  value={editFormData.max_bots}
                  onChange={(e) => setEditFormData({...editFormData, max_bots: parseInt(e.target.value)})}
                  className="mt-1 w-full rounded-lg border border-slate-200 p-2.5 text-sm outline-none focus:ring-2 focus:ring-amber-400 disabled:bg-slate-50"
                />
              </div>

              {/* 1. แก้ไข UI ปุ่มแบนให้ชัดเจน */}
              <div>
                <label className="text-xs font-semibold uppercase text-slate-400">สถานะบัญชีผู้ใช้ (Status)</label>
                <select 
                  disabled={!isAdmin}
                  value={editFormData.is_active ? "active" : "banned"}
                  onChange={(e) => setEditFormData({...editFormData, is_active: e.target.value === "active"})}
                  className={`mt-1 w-full rounded-lg border p-2.5 text-sm font-medium outline-none focus:ring-2 focus:ring-amber-400 disabled:bg-slate-50 disabled:text-slate-500 transition-colors ${
                    editFormData.is_active 
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700' 
                      : 'border-rose-200 bg-rose-50 text-rose-700'
                  }`}
                >
                  <option value="active"> ใช้งานได้ปกติ (Active)</option>
                  <option value="banned"> ระงับการใช้งาน (Banned)</option>
                </select>
                <p className="mt-1.5 text-[10px] text-slate-500">
                  * หากเลือก "ระงับการใช้งาน" ผู้ใช้คนนี้จะไม่สามารถเข้าสู่ระบบได้
                </p>
              </div>

              {isAdmin && (
                <button 
                  onClick={() => alert("ระบบกำลังส่งอีเมลรีเซ็ตรหัสผ่าน...")}
                  className="w-full rounded-lg border border-slate-200 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  รีเซ็ตรหัสผ่านพนักงาน
                </button>
              )}
            </div>

            <div className="mt-8 flex gap-3">
              <button 
                onClick={() => setEditModalUser(null)}
                className="flex-1 rounded-xl bg-slate-100 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-200 transition-colors"
              >
                {isAdmin ? "ยกเลิก" : "ปิดหน้าต่าง"}
              </button>
              {isAdmin && (
                <button 
                  className="flex-1 rounded-xl bg-amber-400 py-3 text-sm font-semibold text-slate-900 hover:bg-amber-500 transition-colors"
                  onClick={async () => {
                    // 2. ใส่โค้ดยิง API เพื่อบันทึกข้อมูล
                    try {
                      const res = await fetch(`/api/auth/users/${editModalUser.id}/approve`, {
                        method: "PATCH",
                        headers: { 
                          "Authorization": `Bearer ${token}`,
                          "Content-Type": "application/json"
                        },
                        body: JSON.stringify({ 
                          is_approved: true,
                          is_active: editFormData.is_active,
                          max_bots: editFormData.max_bots,
                          role: editFormData.role
                        })
                      });
                      
                      if (res.ok) {
                        fetchUsers(); // รีเฟรชตารางใหม่
                        setEditModalUser(null); // ปิดหน้าต่าง
                      } else {
                        alert("เกิดข้อผิดพลาดในการบันทึกข้อมูล");
                      }
                    } catch (error) {
                      console.error("Save error", error);
                    }
                  }}
                >
                  บันทึกการเปลี่ยนแปลง
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 🟢 Modal สำหรับรออนุมัติ (Pending) */}
      {showPendingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-900">รอการอนุมัติ (Pending)</h2>
                <p className="text-sm text-slate-500 mt-1">ผู้ใช้งานที่สมัครสมาชิกเข้ามาใหม่ และรอสิทธิ์การเข้าใช้งานระบบ</p>
              </div>
              <button onClick={() => setShowPendingModal(false)} className="text-slate-400 hover:text-slate-600 transition-colors p-2">✕</button>
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

      {/* 🟢 Modal สำหรับผู้ใช้ที่โดนแบน (Banned) */}
      {showBannedModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900">ผู้ใช้ที่ถูกระงับ (Banned)</h2>
              <button onClick={() => setShowBannedModal(false)} className="text-slate-400 hover:text-slate-600 transition-colors">✕</button>
            </div>
            
            <div className="max-h-[50vh] overflow-y-auto space-y-3">
              {bannedUsersList.length === 0 ? (
                <p className="text-center py-10 text-slate-400">ไม่มีผู้ใช้ที่ถูกระงับในระบบ</p>
              ) : (
                bannedUsersList.map((user) => (
                  <div key={user.id} className="flex items-center justify-between rounded-xl border border-rose-100 bg-rose-50/30 p-4">
                    <div>
                      <p className="font-semibold text-slate-900">{user.username}</p>
                      <p className="text-sm text-slate-500">{user.email}</p>
                    </div>
                    <div className="flex gap-2">
                      <button 
                        onClick={async () => {
                          await fetch(`/api/auth/users/${user.id}/approve`, {
                            method: "PATCH",
                            headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
                            body: JSON.stringify({ is_approved: true, is_active: true })
                          });
                          fetchUsers();
                        }}
                        className="rounded-lg bg-white px-3 py-2 text-xs font-medium text-slate-600 border border-slate-200 hover:bg-slate-50 transition-colors"
                      >
                        ปลดแบน
                      </button>
                      <button 
                        onClick={async () => {
                          if(window.confirm("คุณแน่ใจหรือไม่ว่าต้องการลบผู้ใช้นี้อย่างถาวร?")) {
                            await fetch(`/api/auth/users/${user.id}`, { method: "DELETE", headers: { "Authorization": `Bearer ${token}` } });
                            fetchUsers();
                          }
                        }}
                        className="rounded-lg bg-rose-500 px-3 py-2 text-xs font-medium text-white hover:bg-rose-600 transition-colors"
                      >
                        ลบผู้ใช้ถาวร
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

>>>>>>> master
    </div>
  );
}