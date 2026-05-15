import os
from datasets import Dataset
from ragas import evaluate
from ragas.metrics import (
    faithfulness,
    answer_relevancy,
    context_precision,
    context_recall
)
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_huggingface import HuggingFaceEmbeddings

# 1. ใส่ API Key ของ Gemini (เอามาจาก Google AI Studio)
os.environ["GOOGLE_API_KEY"] = "AIzaSyBoHKEiCJ_O7P44kDbFKw7Bx_A2zfXNaJw"
gemini_judge = ChatGoogleGenerativeAI(model="gemini-2.5-flash", temperature=0.0)

# 2. Embedding Model ตัวเดียวกับที่คุณใช้ในโปรเจกต์
local_embeddings = HuggingFaceEmbeddings(model_name="BAAI/bge-m3")

# 3. ข้อมูลที่บอทเคยตอบไว้ (จำลอง)
data = {
    "question": [
        "พนักงานจะได้สิทธิลาพักร้อนกี่วันต่อปี และมีเงื่อนไขอะไรบ้าง?",
        "ในวันศุกร์ พนักงานสามารถแต่งกายแบบไหนมาทำงานได้บ้าง?"
    ],
    "ground_truth": [
        "พนักงานที่ผ่านการทดลองงานแล้ว (119 วัน) จะได้รับสิทธิลาพักร้อน 10 วันต่อปี และไม่สามารถสะสมข้ามปีได้ (ยกเว้นหัวหน้างานไม่อนุมัติให้ลาเนื่องจากความจำเป็นของงาน)",
        "สามารถสวมเสื้อยืดหรือกางเกงยีนส์ที่สุภาพได้ แต่งดเว้นกางเกงขาสั้นและรองเท้าแตะ"
    ],
    "answer": [
        "พนักงานที่ผ่านการทดลองงานแล้วจะได้รับสิทธิลาพักร้อน 10 วันต่อปี สิทธิพักร้อนไม่สามารถสะสมข้ามปีได้", 
        "ในวันศุกร์ พนักงานสามารถแต่งกายแบบ Smart Casual หรือเสื้อยืดกางเกงยีนส์ได้"
    ],
    "contexts": [
        ["* การลาพักร้อน (Annual Leave): พนักงานที่ผ่านการทดลองงานแล้ว (119 วัน) จะได้รับสิทธิลาพักร้อน 10 วันต่อปี สิทธิพักร้อนไม่สามารถสะสมข้ามปีได้ ยกเว้นกรณีที่หัวหน้างานไม่อนุมัติให้ลาเนื่องจากความจำเป็นของงาน"],
        ["อนุญาตให้แต่งกายแบบ Smart Casual ในวันจันทร์-พฤหัสบดี และสามารถสวมเสื้อยืด/กางเกงยีนส์ที่สุภาพได้ในวันศุกร์ งดเว้นกางเกงขาสั้นและรองเท้าแตะ"]
    ]
}

# 4. แปลงข้อมูลและสั่งรัน
dataset = Dataset.from_dict(data)
print("⏳ กำลังให้ Gemini ประเมินผล RAGAS (รอสักครู่)...")

result = evaluate(
    dataset=dataset,
    metrics=[faithfulness, answer_relevancy, context_precision, context_recall],
    llm=gemini_judge,
    embeddings=local_embeddings,
)

print("\n📊 ผลคะแนน RAGAS Metrics (คะแนนเต็ม 1.0000):")
print(result)