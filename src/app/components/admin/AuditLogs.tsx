import { useEffect, useMemo, useState } from "react";
import {
  Search,
  RefreshCw,
  ShieldCheck,
  Activity,
  LogIn,
  Edit,
  Trash2,
} from "lucide-react";

interface AuditLog {
  id: number;
  user_id: number;
  username: string;
  action: string;
  role: string;
  target_type: string;
  target_id: string;
  detail: string;
  ip_address: string;
  created_at: string;
}

// เพิ่ม Record<string, string> เพื่อกัน Type Error
const actionColor: Record<string, string> = {
  login: "bg-amber-100 text-amber-700",
  update_user: "bg-blue-100 text-blue-700",
  delete: "bg-red-100 text-red-700",
  upload_document: "bg-green-100 text-green-700",
  assign_document: "bg-purple-100 text-purple-700",
  create_bot: "bg-cyan-100 text-cyan-700",
};

const formatDetail = (detail: string) => {
  try {
    const obj = JSON.parse(detail);
    return JSON.stringify(obj, null, 2);
  } catch {
    return detail; // ถ้าไม่ใช่ JSON ให้คืนค่า string เดิมกลับไป (ป้องกันเว็บพัง)
  }
};

export default function AuditLogs() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("scopebot_token");
      const res = await fetch("/api/auth/audit-logs", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) throw new Error("โหลดข้อมูลไม่สำเร็จ");

      const data = await res.json();
      setLogs(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const matchSearch =
        log.username?.toLowerCase().includes(search.toLowerCase()) ||
        log.action?.toLowerCase().includes(search.toLowerCase());

      const matchAction =
        actionFilter === "all" || log.action === actionFilter;

      return matchSearch && matchAction;
    });
  }, [logs, search, actionFilter]);

  const paginatedLogs = useMemo(() => {
    return filteredLogs.slice(
      (page - 1) * pageSize,
      page * pageSize
    );
  }, [filteredLogs, page]);

  // แก้ไข: ให้ Export ข้อมูลจาก filteredLogs แทน paginatedLogs เพื่อให้ได้ข้อมูลที่กรองไว้ทั้งหมด
  const exportCSV = () => {
    const headers = [
      "Date",
      "Username",
      "Role",
      "Action",
      "IP Address",
      "Detail",
    ];

    const rows = filteredLogs.map((log) => [
      new Date(log.created_at).toLocaleString("th-TH"),
      log.username,
      log.role,
      log.action,
      log.ip_address,
      log.detail,
    ]);

    const csv = [headers, ...rows]
      .map((row) => row.join(","))
      .join("\n");

    const blob = new Blob([csv], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "audit_logs.csv";
    link.click();
  };

  const totalLogs = logs.length;
  const loginCount = logs.filter((x) => x.action === "login").length;
  const updateCount = logs.filter((x) => x.action === "update_user").length;
  const deleteCount = logs.filter((x) => x.action === "delete").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Audit Logs</h1>
          <p className="text-gray-500 mt-1">
            ติดตามกิจกรรมทั้งหมดของผู้ใช้งานในระบบ
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={fetchLogs}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-500 text-gray-900 font-medium"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          <button
            onClick={exportCSV}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border hover:bg-gray-50"
          >
            Export CSV
          </button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border p-5">
          <div className="flex items-center justify-between">
            <span className="text-gray-500">ทั้งหมด</span>
            <Activity className="w-5 h-5 text-gray-400" />
          </div>
          <h2 className="text-3xl font-bold mt-3">{totalLogs}</h2>
        </div>

        <div className="bg-white rounded-2xl border p-5">
          <div className="flex items-center justify-between">
            <span className="text-gray-500">Login</span>
            <LogIn className="w-5 h-5 text-amber-500" />
          </div>
          <h2 className="text-3xl font-bold mt-3">{loginCount}</h2>
        </div>

        <div className="bg-white rounded-2xl border p-5">
          <div className="flex items-center justify-between">
            <span className="text-gray-500">Update</span>
            <Edit className="w-5 h-5 text-blue-500" />
          </div>
          <h2 className="text-3xl font-bold mt-3">{updateCount}</h2>
        </div>

        <div className="bg-white rounded-2xl border p-5">
          <div className="flex items-center justify-between">
            <span className="text-gray-500">Delete</span>
            <Trash2 className="w-5 h-5 text-red-500" />
          </div>
          <h2 className="text-3xl font-bold mt-3">{deleteCount}</h2>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border p-4 flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3.5 w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1); // รีเซ็ตหน้ากลับไปที่ 1 เมื่อมีการค้นหาใหม่
            }}
            placeholder="ค้นหาผู้ใช้งาน หรือ Action"
            className="w-full pl-10 pr-4 py-2.5 border rounded-xl"
          />
        </div>

        <select
          value={actionFilter}
          onChange={(e) => {
            setActionFilter(e.target.value);
            setPage(1); // รีเซ็ตหน้ากลับไปที่ 1 เมื่อมีการกรองใหม่
          }}
          className="px-4 py-2.5 border rounded-xl"
        >
          <option value="all">ทุกประเภท</option>
          <option value="login">LOGIN</option>
          <option value="update_user">UPDATE USER</option>
          <option value="delete">DELETE</option>
        </select>
      </div>

      {/* Table */}
      <div className="flex justify-end gap-2 p-4">
        <button
          disabled={page === 1}
          onClick={() => setPage(page - 1)}
          className="px-3 py-1 border rounded disabled:opacity-50 disabled:cursor-not-allowed"
        >
          ก่อนหน้า
        </button>

        <span className="px-3 py-1">หน้า {page}</span>

        <button
          disabled={page * pageSize >= filteredLogs.length}
          onClick={() => setPage(page + 1)}
          className="px-3 py-1 border rounded disabled:opacity-50 disabled:cursor-not-allowed"
        >
          ถัดไป
        </button>
      </div>

      <div className="bg-white border rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b bg-gray-50 flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-amber-500" />
          <span className="font-semibold">Activity Logs</span>
        </div>

        {loading ? (
          <div className="p-10 text-center text-gray-500">
            กำลังโหลดข้อมูล...
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-5 py-3">เวลา</th>
                  <th className="text-left px-5 py-3">ผู้ใช้งาน</th>
                  <th className="text-left px-5 py-3">Role</th>
                  <th className="text-left px-5 py-3">Action</th>
                  <th className="text-left px-5 py-3">IP Address</th>
                  <th className="text-left px-5 py-3">รายละเอียด</th>
                </tr>
              </thead>

              <tbody>
                {paginatedLogs.map((log) => (
                  <tr key={log.id} className="border-t hover:bg-gray-50">
                    <td className="px-5 py-4 whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString("th-TH")}
                    </td>

                    <td className="px-5 py-4 font-medium">{log.username}</td>

                    <td className="px-5 py-4">
                      <span className="px-2 py-1 rounded-full bg-gray-100 text-gray-700 text-xs">
                        {log.role.replace("UserRole.", "")}
                      </span>
                    </td>

                    <td className="px-5 py-4">
                      <span
                        className={`px-2 py-1 rounded-full text-xs ${
                          actionColor[log.action] || "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {log.action}
                      </span>
                    </td>

                    <td className="px-5 py-4">{log.ip_address}</td>

                    <td className="px-5 py-4">
                      <div className="text-xs bg-gray-50 rounded-lg p-2 border">
                        <pre className="whitespace-pre-wrap">
                          {/* แก้ไข: ใช้ function formatDetail ที่สร้างไว้แทนการ parse ตรงๆ */}
                          {formatDetail(log.detail)}
                        </pre>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {paginatedLogs.length === 0 && (
              <div className="p-10 text-center text-gray-500">ไม่พบข้อมูล</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}