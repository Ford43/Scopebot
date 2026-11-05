import json, sys, time, traceback
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from api.database import SessionLocal
from api import models
from rag import rag_pipeline as p, semantic as s, retriever as r

OUT = Path(__file__).parent
report = {'stages': [], 'question': 'ขอรายละเอียดอาหารจานหลัก'}
def save():
    (OUT/'baseline.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
def wrap(obj, name):
    original = getattr(obj, name)
    def call(*args, **kwargs):
        start = time.perf_counter()
        print('START', name, flush=True)
        entry = {'stage': name}
        try:
            value = original(*args, **kwargs)
            if name in ('retrieve_docs', 'select_evidence_units'):
                entry['documents'] = [{'text': getattr(d, 'page_content', getattr(d, 'text', '')), 'metadata': d.metadata} for d in value]
            if name == 'prepare_query': entry['plan'] = {'question': value.question, 'queries': value.queries}
            if name == 'rank_candidates':
                entry['input_count'] = len(args[1]); entry['output_count'] = len(value)
            if name == 'generate_answer':
                entry['response'] = value.model_dump() if hasattr(value,'model_dump') else value
                (OUT/'generation-input.json').write_text(json.dumps(kwargs,ensure_ascii=False,indent=2),encoding='utf-8')
            if name in ('validate_grounded_answer','_reject_grounding'): entry['result'] = value
            if name == '_reject_grounding': entry['reason'] = args[0]
            return value
        except Exception as exc:
            entry['error_type'] = type(exc).__name__
            raise
        finally:
            entry['seconds'] = round(time.perf_counter()-start,3)
            report['stages'].append(entry); save()
            print('END', name, entry['seconds'], flush=True)
    setattr(obj,name,call)
for obj,names in [(s,['prepare_query','rank_candidates']), (r,['get_embedding_model']), (p,['retrieve_docs','select_evidence_units','generate_answer','validate_grounded_answer','_reject_grounding'])]:
    for name in names: wrap(obj,name)
with SessionLocal() as db:
    bot=db.query(models.Bot).filter_by(bot_id='bot_bea29390').first()
    if bot is None: raise RuntimeError('Target bot missing')
    report['bot']={'id':bot.bot_id,'usable':bot.has_usable_knowledge,'index':bot.active_index_path,'update_status':bot.knowledge_update_status}
    prompt=bot.system_prompt
save()
start=time.perf_counter()
try:
    report['answer'], report['sources']=p.ask_rag(report['question'],'bot_bea29390',user_system_prompt=prompt,history=[])
except Exception as exc:
    report['error_type']=type(exc).__name__
    traceback.print_exc()
finally:
    report['total_seconds']=round(time.perf_counter()-start,3);save()
    print('RESULT',json.dumps({k:v for k,v in report.items() if k not in ('stages','bot')},ensure_ascii=False),flush=True)
