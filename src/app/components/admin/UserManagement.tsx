import { useState } from "react";
import { Search, ChevronDown, Hourglass, Eye, Trash2 } from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent } from "../ui/tooltip";
import { 
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, 
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, 
  AlertDialogTitle, AlertDialogTrigger 
} from "../ui/alert-dialog";

// 1. ข้อมูลจำลองและฟังก์ชันช่วยเหลือ (อยู่นอก Component)
const userManagementUsers = [
  { id: "1", name: "John Smith", email: "john.smith@gmail.com", username: "jonny77", status: "Active", role: "Admin", joined: "March 12, 2023", lastActive: "1 minute ago" },
  { id: "2", name: "Olivia Bennett", email: "ollyben@gmail.com", username: "olly659", status: "Inactive", role: "User", joined: "June 27, 2022", lastActive: "1 month ago" },
  { id: "3", name: "Daniel Warren", email: "dwarren3@gmail.com", username: "dwarren3", status: "Banned", role: "User", joined: "January 8, 2024", lastActive: "4 days ago" },
  { id: "4", name: "Chloe Hayes", email: "chloehhye@gmail.com", username: "chloehh", status: "Pending", role: "Guest", joined: "October 5, 2021", lastActive: "10 days ago" },
  { id: "5", name: "Marcus Reed", email: "reeds777@gmail.com", username: "reeds7", status: "Suspended", role: "User", joined: "February 19, 2023", lastActive: "3 months ago" },
  { id: "6", name: "Isabelle Clark", email: "belleclark@gmail.com", username: "bellecl", status: "Active", role: "Moderator", joined: "August 30, 2022", lastActive: "1 week ago" },
];

function getStatusClass(status: string) {
  switch (status) {
    case "Active": return "bg-emerald-100 text-emerald-700";
    case "Inactive": return "bg-slate-100 text-slate-600";
    case "Banned": return "bg-rose-100 text-rose-700";
    case "Pending": return "bg-sky-100 text-sky-700";
    case "Suspended": return "bg-amber-100 text-amber-700";
    default: return "bg-gray-100 text-gray-600";
  }
}

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
  return (
    <div className="p-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">User Management</h1>
          <p className="mt-2 text-sm text-slate-500 max-w-2xl">
            Manage all users in one place. Control access, assign roles, and monitor activity across your platform.
          </p>
        </div>
      </div>

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
        </div>
      </div>

      <div className="mt-6 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-slate-200 bg-slate-50 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 shadow-sm">
              <Search className="w-4 h-4 text-slate-400" />
              <input
                type="text"
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
                    {["All Status", "Active", "Inactive", "Pending", "Banned", "Suspended"].map((status) => (
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

        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-left text-sm">
            <thead>
              <tr className="bg-slate-100 text-slate-500">
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
    </div>
  );
}