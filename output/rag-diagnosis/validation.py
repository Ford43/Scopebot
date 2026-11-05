import sys,json,re,time
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[2]))
from rag import rag_pipeline as p
from langchain_core.documents import Document
from unittest.mock import patch
from api.database import SessionLocal
from api import models
out=Path(__file__).parent
text=re.split(r'(?=หมวดหมู่:)',Path('data/bot_bea29390/food_menu.txt').read_text(encoding='utf-8'))[1].strip()
doc=Document(page_content=text,metadata={'source':'food_menu.txt','section':text.splitlines()[0],'evidence_unit':0,'semantic_relevance':0.7682167887687683,'resolved_question':'ขอรายละเอียดอาหารจานหลัก'})
report={}
generate=p.generate_answer
validate=p.validate_grounded_answer
def capture(**kwargs):
    if '--7b' in sys.argv:
        kwargs['model']='qwen2.5:7b'
    if '--simple' in sys.argv:
        kwargs['messages']=[{'role':'system','content':'ตอบจากเอกสารเท่านั้น คืน JSON ที่มี answer เป็นคำตอบภาษาไทย และ evidence_ids เป็นหมายเลขเอกสาร ห้ามตอบซ้ำคำถาม เมื่อถามรายละเอียดทั้งหมวด ให้คัดลอกชื่ออาหาร ราคา และรายละเอียดทั้งหมดในหมวดนั้นจากเอกสาร หากไม่มีข้อมูลให้ใช้ answer เป็น ไม่พบข้อมูล และ evidence_ids เป็น []'}, {'role':'user','content':'[เอกสารที่ 1]\n'+text+'\n\nคำถาม: ขอรายละเอียดอาหารจานหลัก'}]
    response=generate(**kwargs)
    report['raw_response']=response.message.content
    return response
def check(*args,**kwargs):
    value=validate(*args,**kwargs)
    report['validation']={'answer':args[1],'evidence':args[2],'result':value}
    return value
with SessionLocal() as db:
    prompt=db.query(models.Bot).filter_by(bot_id='bot_bea29390').first().system_prompt
start=time.perf_counter()
with patch.object(p,'retrieve_docs',return_value=[doc]),patch.object(p,'generate_answer',side_effect=capture),patch.object(p,'validate_grounded_answer',side_effect=check):
    report['result']=p.ask_rag('ขอรายละเอียดอาหารจานหลัก','bot_bea29390',user_system_prompt=prompt,history=[])
report['seconds']=time.perf_counter()-start
(out/('validation-7b.json' if '--7b' in sys.argv else 'validation-simple.json' if '--simple' in sys.argv else 'validation.json')).write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(report,ensure_ascii=False),flush=True)
