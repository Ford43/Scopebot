import ollama
from rag.rag_pipeline import ask_rag
from config import MODEL_NAME # ดึงชื่อโมเดลที่คุณใช้ในโปรเจกต์มาเป็นกรรมการ

# 1. ชุดข้อสอบ (เปลี่ยนคำถามและเฉลยให้ตรงกับไฟล์ traffic_law.pdf หรือชีทเรียนที่คุณอัปโหลดไว้)
TEST_CASES = [
    {
        "bot_id": "bot_ff592db3",  # ใช้ ID ของบอทที่เพิ่ง Ingest ล่าสุด
        "question": "พนักงานจะได้สิทธิลาพักร้อนกี่วันต่อปี และมีเงื่อนไขอะไรบ้าง?",
        "ground_truth": "พนักงานที่ผ่านการทดลองงานแล้ว (119 วัน) จะได้รับสิทธิลาพักร้อน 10 วันต่อปี และไม่สามารถสะสมข้ามปีได้ (ยกเว้นหัวหน้างานไม่อนุมัติให้ลาเนื่องจากความจำเป็นของงาน)"
    },
    {
        "bot_id": "bot_ff592db3",
        "question": "ประกันสุขภาพกลุ่มให้วงเงินค่ารักษาพยาบาลผู้ป่วยนอก (OPD) เท่าไหร่?",
        "ground_truth": "วงเงิน 1,500 บาท/ครั้ง (สูงสุด 30 ครั้ง/ปี)"
    },
    {
        "bot_id": "bot_ff592db3",
        "question": "ในวันศุกร์ พนักงานสามารถแต่งกายแบบไหนมาทำงานได้บ้าง?",
        "ground_truth": "สามารถสวมเสื้อยืดหรือกางเกงยีนส์ที่สุภาพได้ แต่งดเว้นกางเกงขาสั้นและรองเท้าแตะ"
    }
]

def llm_judge(question, answer, context, ground_truth):
    """ให้ Ollama สวมบทบาทเป็นกรรมการตรวจข้อสอบ"""
    
    judge_prompt = f"""เปรียบเทียบ 'คำตอบของ AI' กับ 'เฉลยที่ถูกต้อง' อย่างเป็นเหตุเป็นผล

คำตอบของ AI: {answer}
เฉลยที่ถูกต้อง: {ground_truth}

ขั้นตอนการตรวจ:
1. คำตอบของ AI มีใจความหลักตรงกับเฉลยหรือไม่? (มี/ไม่มี)
2. คำตอบของ AI ตกหล่นข้อห้าม ("งดเว้น", "ยกเว้น", "ห้าม") ที่ระบุไว้ในเฉลยหรือไม่? (ตกหล่น/ไม่ตกหล่น)
3. คำตอบของ AI เอาข้อมูลของเงื่อนไขอื่น (เช่น ไปเอาข้อมูลของวันอื่น) มาตอบปะปนด้วยหรือไม่? (มี/ไม่มี)

เกณฑ์การให้คะแนน:
ให้ Accuracy: 1 เฉพาะเมื่อ (ข้อ 1=มี, ข้อ 2=ไม่ตกหล่น, ข้อ 3=ไม่มี) เท่านั้น นอกนั้นให้ Accuracy: 0

ตอบตามรูปแบบนี้เท่านั้น:
การวิเคราะห์: [ตอบผลลัพธ์ของข้อ 1, 2 และ 3 สั้นๆ]
Accuracy: [0 หรือ 1]"""

    try:
        response = ollama.chat(
            model=MODEL_NAME, 
            messages=[{"role": "user", "content": judge_prompt}],
            options={"temperature": 0.0} # ให้กรรมการใช้เหตุผลตรงไปตรงมาที่สุด
        )
        return response["message"]["content"].strip()
    except Exception as e:
        return f"เกิดข้อผิดพลาดในการตรวจ: {e}"

def run_evaluation():
    print("🚀 เริ่มระบบตรวจข้อสอบ Scopebot แบบอัตโนมัติ...\n")
    
    for idx, test in enumerate(TEST_CASES, 1):
        print("="*60)
        print(f"📝 TEST CASE {idx}")
        print(f"❓ คำถาม: {test['question']}")
        print(f"🎯 เฉลยที่ควรจะเป็น: {test['ground_truth']}")
        print("-" * 60)

        # 2. ให้บอททำข้อสอบ (ต้องแก้ ask_rag ใน rag_pipeline.py ให้มี return_context=True ตามที่คุยกันก่อนหน้านี้ด้วยนะ)
        result = ask_rag(question=test['question'], bot_id=test['bot_id'], return_context=True)
        
        answer = result.get("answer", "")
        context = result.get("context", "")

        print(f"💬 คำตอบจาก Scopebot:\n{answer}\n")
        print(f"📄 ข้อมูลที่ดึงมาได้ (Context):")
        print(f"{context if context else '[ไม่มีข้หอมูลถูกดึงมาเลย]'}\n")
        
        # 3. ส่งให้กรรมการ (Ollama) ตรวจ
        print("👨‍⚖️ ผลการประเมินจากกรรมการ:")
        evaluation_result = llm_judge(test['question'], answer, context, test['ground_truth'])
        print(evaluation_result)
        print("="*60 + "\n")


if __name__ == "__main__":
    run_evaluation()