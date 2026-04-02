import { MessageSquare, Clock, FileText } from "lucide-react";
import { Card } from "../ui/card";

const stats = [
  { id: "1", label: "แชททั้งหมด", value: "128", icon: MessageSquare },
  { id: "2", label: "รอเจ้าหน้าที่ตอบ", value: "3", icon: Clock, alert: true },
  { id: "3", label: "ไฟล์เอกสาร", value: "15", icon: FileText },
];

export default function Dashboard() {
  return (
    <div>
      <h1 className="mb-6">ภาพรวมระบบ (Overview)</h1>

      {/* Statistics cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card
              key={stat.id}
              className="p-6 border-2 border-purple-200 hover:border-purple-400 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm mb-2">{stat.label}</p>
                  <div className="flex items-center gap-2">
                    <p className="text-3xl font-bold">{stat.value}</p>
                    {stat.alert && (
                      <span className="text-red-500 text-xl">🔴</span>
                    )}
                  </div>
                </div>
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-500 rounded-lg flex items-center justify-center">
                  <Icon className="w-6 h-6 text-white" />
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Upload area */}
      <div>
        <h2 className="mb-4">อัปโหลดฐานข้อมูลเอกสาร (Knowledge Base)</h2>
        <Card className="p-12 border-2 border-dashed border-blue-400 hover:border-blue-600 transition-colors">
          <div className="flex flex-col items-center justify-center text-center">
            <div className="w-24 h-24 mb-4 text-6xl">📄</div>
            <p className="text-lg text-gray-700 mb-4">
              ลากไฟล์มาวางที่นี่ หรือ คลิกเพื่ออัปโหลด
            </p>
            <button className="px-8 py-3 bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded-lg hover:from-purple-600 hover:to-blue-600 transition-colors">
              ปุ่มอัปโหลด
            </button>
          </div>
        </Card>
      </div>
    </div>
  );
}
