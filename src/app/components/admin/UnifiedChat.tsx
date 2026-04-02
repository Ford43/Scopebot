import { Card } from "../ui/card";
import { Badge } from "../ui/badge";

interface ChatSession {
  id: string;
  user: string;
  lastMessage: string;
  time: string;
  status: "active" | "waiting" | "closed";
  unread: number;
}

const chatSessions: ChatSession[] = [
  {
    id: "1",
    user: "สมชาย ใจดี",
    lastMessage: "ขอสอบถามเรื่องการลาครับ",
    time: "10:45 น.",
    status: "waiting",
    unread: 2,
  },
  {
    id: "2",
    user: "สมหญิง รักงาน",
    lastMessage: "ขอบคุณมากครับ แก้ไขปัญหาได้แล้ว",
    time: "09:30 น.",
    status: "closed",
    unread: 0,
  },
  {
    id: "3",
    user: "ประชา สุขใจ",
    lastMessage: "ต้องการข้อมูลเพิ่มเติมครับ",
    time: "08:15 น.",
    status: "waiting",
    unread: 1,
  },
  {
    id: "4",
    user: "มานี จริงใจ",
    lastMessage: "สวัสดีครับ ต้องการสอบถามเรื่องระเบียบการ",
    time: "เมื่อวาน",
    status: "active",
    unread: 0,
  },
];

export default function UnifiedChat() {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1>Unified Chat</h1>
        <Badge variant="destructive" className="px-3 py-1">
          3 รอตอบกลับ
        </Badge>
      </div>

      <div className="grid gap-4">
        {chatSessions.map((session) => (
          <Card
            key={session.id}
            className="p-4 hover:shadow-lg transition-shadow cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold">{session.user}</h3>
                  {session.status === "waiting" && (
                    <Badge variant="destructive" className="text-xs">
                      รอตอบ
                    </Badge>
                  )}
                  {session.status === "active" && (
                    <Badge variant="default" className="text-xs bg-green-500">
                      กำลังสนทนา
                    </Badge>
                  )}
                </div>
                <p className="text-gray-600 text-sm">{session.lastMessage}</p>
              </div>
              <div className="flex flex-col items-end gap-2">
                <span className="text-xs text-gray-500">{session.time}</span>
                {session.unread > 0 && (
                  <div className="w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-xs">
                    {session.unread}
                  </div>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
