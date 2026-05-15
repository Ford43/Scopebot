import os
from langchain_google_genai import ChatGoogleGenerativeAI

# 1. ใส่ API Key ของคุณที่นี่
os.environ["GOOGLE_API_KEY"] = "AIzaSyBoHKEiCJ_O7P44kDbFKw7Bx_A2zfXNaJw"

def test_connection():
    print("🔄 กำลังส่งสัญญาณทักทายไปยังเซิร์ฟเวอร์ Google...")
    
    # เราจะลองเรียกชื่อโมเดลยอดฮิต gemini-1.5-flash ดูว่า API Key นี้มีสิทธิ์ใช้ไหม
    try:
        llm = ChatGoogleGenerativeAI(model="gemini-1.5-flash", temperature=0.0)
        
        # ส่งข้อความไปทักทาย
        response = llm.invoke("สวัสดีครับ ทดสอบระบบ 123 ช่วยตอบกลับมาสั้นๆ ว่า 'รับทราบ เชื่อมต่อสำเร็จ!'")
        
        print("\n✅ ผลการทดสอบ: เชื่อมต่อสำเร็จ 100%!")
        print(f"🤖 คำตอบจาก Gemini: {response.content}")
        
    except Exception as e:
        print("\n❌ ผลการทดสอบ: เชื่อมต่อไม่สำเร็จ!")
        print("สาเหตุ (Error Log):")
        print(e)

if __name__ == "__main__":
    test_connection()