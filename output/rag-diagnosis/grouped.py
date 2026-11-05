import json, sys, time, re
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[2]))
from langchain_core.documents import Document
from rag import semantic as s, rag_pipeline as p
from unittest.mock import patch
from api.database import SessionLocal
from api import models
OUT=Path(__file__).parent
text=Path('data/bot_bea29390/food_menu.txt').read_text(encoding='utf-8')
groups=[part.strip() for part in re.split(r'(?=หมวดหมู่:)',text)[1:]]
docs=[Document(page_content=t,metadata={'source':'food_menu.txt','section':t.splitlines()[0],'evidence_unit':i,'unit_order':i}) for i,t in enumerate(groups)]
results=[]
with SessionLocal() as db:
    bot=db.query(models.Bot).filter_by(bot_id='bot_bea29390').first();prompt=bot.system_prompt
model=s.get_reranker()
predict=model.predict
def capture(pairs,**kwargs):
    scores=predict(pairs,**kwargs)
    results[-1]['scores']=[{'section':t.splitlines()[0],'score':float(score)} for (_,t),score in zip(pairs,scores)]
    return scores
model.predict=capture
for question in ['ขอรายละเอียดอาหารจานหลัก','ขอรายละเอียดของหวาน','มีพิซซ่าทะเลราคาเท่าไร']:
    row={'question':question};results.append(row);start=time.perf_counter()
    ranked=s.rank_candidates(question,docs)
    row['rank_seconds']=round(time.perf_counter()-start,3)
    start=time.perf_counter()
    try:
        with patch.object(p,'retrieve_docs',return_value=ranked):
            row['answer'],row['sources']=p.ask_rag(question,'bot_bea29390',user_system_prompt=prompt,history=[])
    except Exception as exc:row['error']=type(exc).__name__
    row['answer_seconds']=round(time.perf_counter()-start,3)
    (OUT/'grouped.json').write_text(json.dumps(results,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps(row,ensure_ascii=False),flush=True)
