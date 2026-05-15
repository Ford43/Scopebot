import google.generativeai as genai

# 1. ใส่ API Key ของคุณที่นี่
GOOGLE_API_KEY = "AIzaSyBoHKEiCJ_O7P44kDbFKw7Bx_A2zfXNaJw"

genai.configure(api_key=GOOGLE_API_KEY)

def check_available_models():
    print("🔄 กำลังเชื่อมต่อกับ Google AI Studio...")
    try:
        # ดึงรายชื่อโมเดลทั้งหมดที่ API Key นี้มีสิทธิ์ใช้งาน
        available_models = []
        for m in genai.list_models():
            if 'generateContent' in m.supported_generation_methods:
                available_models.append(m.name)
        
        if not available_models:
            print("❌ ไม่พบโมเดลที่สามารถใช้งานได้เลย (API Key อาจจะถูกจำกัดสิทธิ์)")
            return

        print("\n✅ รายชื่อโมเดลทั้งหมดที่คุณสามารถนำไปใส่ในโค้ดได้:")
        for model in available_models:
            print(f" 👉 {model}")
            
        # ลองทดสอบทักทายโมเดลตัวแรกในลิสต์ดู
        test_model_name = available_models[-1].replace('models/', '') # เอาตัวล่าสุด
        print(f"\n🔄 กำลังทดสอบเรียกใช้โมเดล: {test_model_name} ...")
        
        model = genai.GenerativeModel(test_model_name)
        response = model.generate_content("สวัสดีครับ ระบบทำงานปกติไหม ตอบสั้นๆ")
        print(f"🤖 คำตอบที่ได้: {response.text}")

    except Exception as e:
        print("\n❌ เกิดข้อผิดพลาดในการดึงข้อมูล:")
        print(e)

if __name__ == "__main__":
    check_available_models()