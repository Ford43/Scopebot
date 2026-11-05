import json, sys, time
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[2]))
from rag import rag_pipeline as p, semantic as s
from api.database import SessionLocal
from api import models
from config import MODEL_NAME, RERANK_MIN_SCORE
import ollama
OUT=Path(__file__).parent
results={'model':MODEL_NAME,'threshold':RERANK_MIN_SCORE,'retrieval':[],'controlled':[]}
def save(): (OUT/'isolation.json').write_text(json.dumps(results,ensure_ascii=False,indent=2),encoding='utf-8')
original=s.get_reranker
def get_ranker():
    model=original()
    if not getattr(model,'probe_wrapped',False):
        predict=model.predict
        def capture(pairs,**kwargs):
            scores=predict(pairs,**kwargs)
            results['last_scores']=[{'question':q,'text':t,'score':float(v)} for (q,t),v in zip(pairs,scores)]
            save()
            return scores
        model.predict=capture;model.probe_wrapped=True
    return model
s.get_reranker=get_ranker
with SessionLocal() as db:
    bot=db.query(models.Bot).filter_by(bot_id='bot_bea29390').first()
    prompt=bot.system_prompt
for question in ['ขอรายละเอียดอาหารจานหลัก','ขอรายละเอียดอาหารจานหลัก','ผัดไทยกุ้งสดราคาเท่าไร']:
    print('RAG START',question,flush=True);start=time.perf_counter()
    try:
        answer,sources=p.ask_rag(question,'bot_bea29390',user_system_prompt=prompt,history=[])
        result={'question':question,'answer':answer,'sources':sources}
    except Exception as exc: result={'question':question,'error':type(exc).__name__}
    result['seconds']=round(time.perf_counter()-start,3)
    result['scores']=results.get('last_scores',[])
    results['retrieval'].append(result);save();print('RAG END',json.dumps({k:v for k,v in result.items() if k!='scores'},ensure_ascii=False),flush=True)
menu=Path('data/bot_bea29390/food_menu.txt').read_text(encoding='utf-8')
for question in ['ขอรายละเอียดอาหารจานหลัก','ผัดไทยกุ้งสดราคาเท่าไร','มีพิซซ่าทะเลราคาเท่าไร']:
    print('CONTROL START',question,flush=True);start=time.perf_counter()
    try:
        with ollama.Client(timeout=120) as client:
            response=client.chat(model=MODEL_NAME,messages=[{'role':'system','content':'ตอบภาษาไทยจากเอกสารที่ให้เท่านั้น คงชื่อ ราคา และรายละเอียดให้ตรงกับเอกสาร ตอบให้ครบรายการในหมวดที่ถาม ถ้าไม่มีข้อมูลให้ตอบไม่พบข้อมูล ห้ามเดา'}, {'role':'user','content':menu+'\n\nคำถาม: '+question}],options={'temperature':0,'seed':42,'num_predict':700})
        result={'question':question,'answer':response.message.content,'eval_count':response.eval_count,'eval_duration':response.eval_duration,'load_duration':response.load_duration}
    except Exception as exc:result={'question':question,'error':type(exc).__name__}
    result['seconds']=round(time.perf_counter()-start,3);results['controlled'].append(result);save();print('CONTROL END',json.dumps(result,ensure_ascii=False),flush=True)
