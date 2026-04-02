import { Card } from "../ui/card";
import { Brain, TrendingUp, MessageSquare, CheckCircle } from "lucide-react";

const aiMetrics = [
  {
    id: "1",
    label: "คำถามที่ตอบได้",
    value: "95.3%",
    change: "+2.1%",
    icon: CheckCircle,
    color: "text-green-600",
    bgColor: "bg-green-100",
  },
  {
    id: "2",
    label: "ความมั่นใจเฉลี่ย",
    value: "92.7%",
    change: "+1.5%",
    icon: Brain,
    color: "text-blue-600",
    bgColor: "bg-blue-100",
  },
  {
    id: "3",
    label: "คำถามต่อวัน",
    value: "342",
    change: "+15%",
    icon: MessageSquare,
    color: "text-purple-600",
    bgColor: "bg-purple-100",
  },
  {
    id: "4",
    label: "อัตราความพึงพอใจ",
    value: "4.8/5",
    change: "+0.3",
    icon: TrendingUp,
    color: "text-orange-600",
    bgColor: "bg-orange-100",
  },
];

const topQuestions = [
  { id: "1", question: "ระเบียบการลางาน", count: 45, category: "ระเบียบการ" },
  { id: "2", question: "เงินเดือน", count: 38, category: "สวัสดิการ" },
  { id: "3", question: "เวลาทำงาน", count: 32, category: "ข้อมูลทั่วไป" },
  { id: "4", question: "สมัครงาน", count: 28, category: "HR" },
  { id: "5", question: "IT Support", count: 24, category: "IT" },
];

const categoryDistribution = [
  { category: "ระเบียบการ", percentage: 35, color: "bg-blue-500" },
  { category: "สวัสดิการ", percentage: 25, color: "bg-purple-500" },
  { category: "ข้อมูลทั่วไป", percentage: 20, color: "bg-green-500" },
  { category: "HR", percentage: 12, color: "bg-orange-500" },
  { category: "IT", percentage: 8, color: "bg-red-500" },
];

export default function AIAnalytics() {
  return (
    <div>
      <h1 className="mb-6">AI Analytics</h1>

      {/* AI Performance Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {aiMetrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <Card key={metric.id} className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className={`w-12 h-12 ${metric.bgColor} rounded-lg flex items-center justify-center`}>
                  <Icon className={`w-6 h-6 ${metric.color}`} />
                </div>
                <span className="text-sm text-green-600 bg-green-50 px-2 py-1 rounded">
                  {metric.change}
                </span>
              </div>
              <p className="text-2xl font-bold mb-1">{metric.value}</p>
              <p className="text-sm text-gray-600">{metric.label}</p>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Questions */}
        <Card className="p-6">
          <h2 className="mb-4">คำถามยอดนิยม</h2>
          <div className="space-y-3">
            {topQuestions.map((item, index) => (
              <div key={item.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-full flex items-center justify-center text-sm font-semibold">
                    {index + 1}
                  </div>
                  <div>
                    <p className="font-medium">{item.question}</p>
                    <p className="text-xs text-gray-500">{item.category}</p>
                  </div>
                </div>
                <span className="text-sm font-semibold text-purple-600">
                  {item.count} ครั้ง
                </span>
              </div>
            ))}
          </div>
        </Card>

        {/* Category Distribution */}
        <Card className="p-6">
          <h2 className="mb-4">การกระจายตามหมวดหมู่</h2>
          <div className="space-y-4">
            {categoryDistribution.map((item) => (
              <div key={item.category}>
                <div className="flex justify-between mb-2">
                  <span className="text-sm font-medium">{item.category}</span>
                  <span className="text-sm text-gray-600">{item.percentage}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`${item.color} h-2 rounded-full transition-all duration-500`}
                    style={{ width: `${item.percentage}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Brain className="w-5 h-5 text-purple-600" />
              <span className="font-semibold">AI Insight</span>
            </div>
            <p className="text-sm text-gray-700">
              คำถามเกี่ยวกับ "ระเบียบการ" มีแนวโน้มเพิ่มขึ้น 15% ในสัปดาห์นี้
              แนะนำให้เพิ่มข้อมูลในส่วนนี้เพื่อปรับปรุงความแม่นยำ
            </p>
          </div>
        </Card>
      </div>

      {/* Training Suggestions */}
      <Card className="p-6 mt-6">
        <h2 className="mb-4">คำแนะนำในการปรับปรุง AI</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 border-2 border-yellow-200 bg-yellow-50 rounded-lg">
            <p className="font-semibold mb-2">⚠️ ต้องการข้อมูลเพิ่มเติม</p>
            <p className="text-sm text-gray-700">
              พบคำถามเกี่ยวกับ "โบนัสพิเศษ" 12 ครั้ง แต่ยังไม่มีข้อมูลในระบบ
            </p>
          </div>
          <div className="p-4 border-2 border-green-200 bg-green-50 rounded-lg">
            <p className="font-semibold mb-2">✅ ทำงานได้ดี</p>
            <p className="text-sm text-gray-700">
              คำถามเกี่ยวกับ "การลางาน" ตอบได้ถูกต้อง 98%
            </p>
          </div>
          <div className="p-4 border-2 border-blue-200 bg-blue-50 rounded-lg">
            <p className="font-semibold mb-2">💡 แนะนำ</p>
            <p className="text-sm text-gray-700">
              เพิ่มคำถามที่พบบ่อยใน Quick Replies เพื่อประสบการณ์ที่ดีขึ้น
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
