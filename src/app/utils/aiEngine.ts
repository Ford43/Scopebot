// Mock AI Engine for Question Answering
export interface KnowledgeItem {
  category: string;
  keywords: string[];
  responses: string[];
}

// Knowledge Base
const knowledgeBase: KnowledgeItem[] = [
  {
    category: "ระเบียบการลา",
    keywords: ["ลา", "ลางาน", "ลาป่วย", "ลากิจ", "ลาพักร้อน", "วันลา"],
    responses: [
      "📋 **ระเบียบการลางาน**\n\n• ลาป่วย: แจ้งล่วงหน้า 1 วัน (มีใบรับรองแพทย์)\n• ลากิจ: แจ้งล่วงหน้า 3 วัน\n• ลาพักร้อน: แจ้งล่วงหน้า 7 วัน\n\nสามารถยื่นใบลาผ่านระบบ HR Online หรือแจ้งหัวหน้างานโดยตรงครับ",
      "การลางานสามารถทำได้โดยต้องแจ้งล่วงหน้า 3 วันครับ สำหรับลาป่วยฉุกเฉินสามารถแจ้งในวันเดียวกันได้ แต่ต้องมีใบรับรองแพทย์ครับ",
    ],
  },
  {
    category: "เงินเดือนและสวัสดิการ",
    keywords: ["เงินเดือน", "สวัสดิการ", "โบนัส", "ประกัน", "กองทุน"],
    responses: [
      "💰 **เงินเดือนและสวัสดิการ**\n\n• จ่ายเงินเดือน: วันที่ 25 ของทุกเดือน\n• โบนัส: ปีละ 2 ครั้ง (กลางปี + สิ้นปี)\n• ประกันสุขภาพ: ครอบคลุมพนักงานและครอบครัว\n• กองทุนสำรองเลี้ยงชีพ: บริษัทสมทบ 5%",
    ],
  },
  {
    category: "เวลาทำงาน",
    keywords: ["เวลาทำงาน", "เข้างาน", "เลิกงาน", "ชั่วโมง", "โอที"],
    responses: [
      "⏰ **เวลาทำงาน**\n\n• จันทร์-ศุกร์: 09:00-18:00 น.\n• พักเที่ยง: 12:00-13:00 น.\n• ทำงานล่วงเวลา (OT): ได้รับค่าตอบแทน 1.5 เท่า\n• วันเสาร์-อาทิตย์: หยุด",
    ],
  },
  {
    category: "ข้อมูลบริษัท",
    keywords: ["บริษัท", "ที่ตั้ง", "สาขา", "ติดต่อ", "โทร", "อีเมล"],
    responses: [
      "🏢 **ข้อมูลบริษัท**\n\nสำนักงานใหญ่: กรุงเทพมหานคร\nโทร: 02-XXX-XXXX\nอีเมล: info@company.com\nเว็บไซต์: www.company.com\n\nมีสาขาทั่วประเทศไทย 15 แห่ง",
    ],
  },
  {
    category: "HR และสรรหา",
    keywords: ["สมัครงาน", "รับสมัคร", "ตำแหน่งงาน", "สัมภาษณ์", "resume"],
    responses: [
      "👥 **สมัครงาน**\n\nสามารถดูตำแหน่งงานว่างและส่ง Resume ได้ที่:\n• เว็บไซต์: careers.company.com\n• อีเมล: hr@company.com\n\nขั้นตอนการสมัคร:\n1. ส่ง Resume\n2. สอบข้อเขียน\n3. สัมภาษณ์\n4. ประกาศผล",
    ],
  },
  {
    category: "IT Support",
    keywords: ["คอมพิวเตอร์", "รหัสผ่าน", "อีเมล", "ระบบ", "ปัญหา", "ช่วย"],
    responses: [
      "💻 **IT Support**\n\nติดต่อทีม IT:\n• โทร: ต่อ 1234\n• อีเมล: itsupport@company.com\n• Line: @ITSupport\n\nปัญหาที่พบบ่อย:\n• ลืมรหัสผ่าน: ติดต่อ IT เพื่อ Reset\n• ปัญหาอีเมล: ตรวจสอบการเชื่อมต่ออินเทอร์เน็ต",
    ],
  },
];

// AI Response Generator
export function generateAIResponse(userMessage: string): {
  response: string;
  confidence: number;
  category?: string;
} {
  const message = userMessage.toLowerCase();

  // Find matching knowledge items
  for (const item of knowledgeBase) {
    for (const keyword of item.keywords) {
      if (message.includes(keyword.toLowerCase())) {
        const response =
          item.responses[Math.floor(Math.random() * item.responses.length)];
        return {
          response,
          confidence: 0.95,
          category: item.category,
        };
      }
    }
  }

  // Greeting responses
  const greetings = ["สวัสดี", "หวัดดี", "ดี", "ว่าไง", "hello", "hi"];
  if (greetings.some((g) => message.includes(g))) {
    return {
      response:
        "สวัสดีครับ! 😊 ยินดีต้อนรับสู่ scopebot\n\nผมสามารถช่วยตอบคำถามเกี่ยวกับ:\n• ระเบียบการลางาน\n• เงินเดือนและสวัสดิการ\n• เวลาทำงาน\n• ข้อมูลบริษัท\n• การสมัครงาน\n• IT Support\n\nมีอะไรให้ผมช่วยไหมครับ?",
      confidence: 1.0,
    };
  }

  // Thank you responses
  const thanks = ["ขอบคุณ", "ขอบใจ", "thank", "thx"];
  if (thanks.some((t) => message.includes(t))) {
    return {
      response:
        "ยินดีครับ! 😊 มีคำถามอื่นๆ สามารถถามได้ตลอดเวลานะครับ\n\nหากต้องการติดต่อเจ้าหน้าที่โดยตรง สามารถกดปุ่ม '🙋‍♂️ ติดต่อเจ้าหน้าที่' ได้เลยครับ",
      confidence: 1.0,
    };
  }

  // Default fallback response
  return {
    response:
      "ขอโทษครับ ผมไม่ค่อยเข้าใจคำถามนี้ 🤔\n\nลองถามในรูปแบบอื่นได้ไหมครับ หรือเลือกหัวข้อที่สนใจจากด้านล่าง:\n\n• ระเบียบการลางาน\n• เงินเดือนและสวัสดิการ\n• เวลาทำงาน\n• ข้อมูลบริษัท\n\nหรือหากต้องการคุยกับเจ้าหน้าที่ สามารถกดปุ่ม 'ติดต่อเจ้าหน้าที่' ได้เลยครับ",
    confidence: 0.3,
  };
}

// Typing simulation delay based on response length
export function getTypingDelay(responseLength: number): number {
  const baseDelay = 800;
  const charDelay = responseLength * 15;
  return Math.min(baseDelay + charDelay, 3000);
}

// Extract keywords from user message
export function extractKeywords(message: string): string[] {
  const words = message.toLowerCase().split(/\s+/);
  const stopWords = ["ครับ", "ค่ะ", "คะ", "นะ", "ได้", "ไหม", "อะไร", "ที่"];
  return words.filter(
    (word) => word.length > 2 && !stopWords.includes(word)
  );
}