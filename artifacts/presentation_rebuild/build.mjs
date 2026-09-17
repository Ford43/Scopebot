import fs from 'node:fs/promises';
import path from 'node:path';
import {Presentation,PresentationFile} from '@oai/artifact-tool';
const root=path.resolve('.');
const dir=path.join(root,'artifacts/presentation_rebuild');
const p=Presentation.create({slideSize:{width:1280,height:720}});
const C={bg:'#07090C',cyan:'#30B9EF',purple:'#AC57E8',white:'#F2F5F8',muted:'#B7C1D0',panel:'#141B26',green:'#66D5AE',amber:'#FFBF69'};
const font='Tahoma';
const guide=[];
function text(s,t,x,y,w,h,size=26,color=C.white,bold=false,align='left'){
 const q=s.shapes.add({geometry:'textbox',position:{left:x,top:y,width:w,height:h},fill:'none',line:{fill:'none',width:0}});
 q.text=t;q.text.style={typeface:font,fontSize:size,color,bold,alignment:align,verticalAlignment:'middle',autoFit:'none',insets:{top:0,bottom:0,left:0,right:0}};return q;
}
function box(s,t,x,y,w=240,h=106,color=C.cyan,size=27){
 const q=s.shapes.add({geometry:'roundRect',position:{left:x,top:y,width:w,height:h},fill:C.panel,line:{fill:color,width:2},borderRadius:12});
 q.text=t;q.text.style={typeface:font,fontSize:size,color:C.white,bold:true,alignment:'center',verticalAlignment:'middle',autoFit:'none',insets:{top:9,bottom:9,left:12,right:12}};return q;
}
function connect(s,a,b,color=C.cyan,from='right',to='left',both=false){return s.shapes.connect(a,b,{kind:from==='right'&&to==='left'?'straight':'elbow',fromSide:from,toSide:to,line:{fill:color,width:3},tail:{type:'triangle'},...(both?{head:{type:'triangle'}}:{})});}
function line(s,x,y,w,h=0,color='#334252'){return s.shapes.add({geometry:'line',position:{left:x,top:y,width:w,height:h},line:{fill:color,width:1.5}});}
function note(s,t){text(s,t,60,605,1150,54,23,C.muted);}
function newSlide(title,subtitle,script,source){
 const s=p.slides.add();s.background.fill=C.bg;let n=p.slides.items.length;
 text(s,title,60,42,1150,66,42,C.cyan,true);if(subtitle)text(s,subtitle,60,115,1150,48,24,C.muted);
 text(s,'ScopeBot',60,678,250,24,17,C.cyan,true);text(s,String(n).padStart(2,'0'),1150,672,70,30,18,C.muted,false,'right');
 s.speakerNotes.textFrame.setText(script+'\n\nแหล่งอ้างอิง: '+source);
 guide.push({n,title,script,source});return s;
}
async function image(s,file,x,y,w,h){s.images.add({blob:new Uint8Array(await fs.readFile(path.join(dir,file))),contentType:file.endsWith('.jpg')?'image/jpeg':'image/png',position:{left:x,top:y,width:w,height:h},fit:'contain'});}
function flow(s,items,y=270,color=C.cyan){let w=(1160-(items.length-1)*40)/items.length;const shapes=items.map((t,i)=>box(s,t,60+i*(w+40),y,w,130,color,27));for(let i=1;i<shapes.length;i++)connect(s,shapes[i-1],shapes[i],color);return shapes;}

// 01 Cover
{
const s=newSlide('ScopeBot','ระบบตอบคำถามจากเอกสารผ่าน Web และ LINE',
'เวลา 30 วินาที\nเปิดด้วยชื่อเล่นของผู้พูด แล้วกล่าวว่า วันนี้จะพาดูว่า ScopeBot รับเอกสารและนำมาตอบคำถามได้อย่างไร ตั้งแต่หน้าจอไปจนถึง AI และฐานข้อมูล จากนั้นจะสาธิตระบบจริง\nส่งต่อ: เริ่มจากทีมและลำดับการนำเสนอของเรา', 'ScopeBot.pdf.pdf หน้า 1 และ README.md');
text(s,'เอกสารองค์กร\nสู่คำตอบที่ตรวจสอบได้',65,245,800,150,50,C.white,true);
text(s,'ภาพรวมระบบ  /  การพัฒนา  /  Demo',65,450,820,55,27,C.purple);
await image(s,'asset-1-2.png',930,215,280,310);
}
// 02 Team
{
const s=newSlide('ทีมผู้นำเสนอ','ทุกคนบอกชื่อเล่นก่อนเริ่มช่วงของตน',
'เวลา 40 วินาที\nแนะนำชื่อเล่นจากซ้ายไปขวา ก้อง ป๊อกกี้ ฟลุ๊ค ฟอร์ด และมอส ก่อนขึ้นแต่ละช่วงให้ผู้พูดบอกชื่อเล่นอีกครั้ง\nการแบ่งช่วงที่เสนอสำหรับซ้อม: ก้อง ภาพรวมและ Timeline; ป๊อกกี้ Frontend; ฟลุ๊ค Backend และ Database; ฟอร์ด AI/RAG และการส่งต่อ; มอส Deployment และ Demo ทีมปรับสลับกันได้โดยไม่เปลี่ยนเนื้อหา\nส่งต่อ: ลำดับเนื้อหาจะเริ่มจากผู้ใช้งาน แล้วค่อยเปิดดูภายในระบบ','ScopeBot.pdf.pdf หน้า 14–18 ชื่อและรูปสมาชิก');
const names=['ก้อง','ป๊อกกี้','ฟลุ๊ค','ฟอร์ด','มอส'];
const full=['ภควัต สุขสมโสตร','ชัชชญา จอมพงษ์','พสิษฐ์ ลี้ไพบูลย์','นรากร นิลรวม','ดุษฎี จันทรสุวรรณ'];
for(let i=0;i<5;i++){let x=60+i*235;await image(s,`asset-${14+i}-0.jpg`,x,205,210,285);text(s,names[i],x,505,210,45,30,C.cyan,true,'center');text(s,full[i],x-3,553,216,40,20,C.white,false,'center');}
}
// 03 Roadmap
{
const s=newSlide('ลำดับการนำเสนอ','ภาพรวมก่อน แล้วจึงอธิบายแต่ละส่วนและสาธิต',
'เวลา 30 วินาที\nชี้ตามเลข 1 ถึง 5 ไม่ต้องอ่านชื่อเทคโนโลยีทั้งหมดในตอนนี้ เราจะเริ่มจากภาพใหญ่ ดูส่วนที่คนใช้งาน ดูส่วนที่ประมวลผล อธิบาย AI แล้วจบด้วย Timeline และ Demo\nส่งต่อ: ภาพรวมระบบมีเส้นทางหลักดังนี้','หัวข้อการรายงานจากภาพโจทย์และ ScopeBot.pdf.pdf หน้า 2');
const labels=['01  ภาพรวมระบบ','02  Frontend และบทบาท','03  Backend และ Database','04  AI และการส่งต่อคน','05  Timeline และ Demo'];
labels.forEach((v,i)=>{text(s,v,110,198+i*74,1080,57,32,i%2?C.purple:C.white,true);});
}
// 04 Overview
{
const s=newSlide('ภาพรวมระบบ','อ่านจากช่องทางด้านซ้าย ไปยัง FastAPI แล้วแยกไปข้อมูลและ AI',
'เวลา 60 วินาที\nชี้ 1 ช่องทาง Web หรือ LINE เป็นจุดรับคำถาม\nชี้ 2 FastAPI ตรวจสิทธิ์และควบคุมการทำงาน\nชี้ 3 PostgreSQL เก็บบัญชี บอท และประวัติ\nชี้ 4 RAG ค้นเอกสารจาก ChromaDB ก่อนเรียก Ollama สร้างคำตอบ จากนั้น FastAPI ส่งกลับช่องทางเดิม\nยังไม่อธิบาย Cloudflare หรือ embeddings ในหน้านี้\nส่งต่อ: เริ่มจากส่วนที่ผู้ใช้งานมองเห็น คือ Frontend','api/main.py; api/routers/chat.py; api/routers/line_webhook.py; rag/rag_pipeline.py');
let web=box(s,'1  Web / React',60,230,275,100);let ln=box(s,'1  LINE OA',60,405,275,100,C.green);
let api=box(s,'2  FastAPI\nจัดการคำขอ',485,305,260,130);
let db=box(s,'3  PostgreSQL\nข้อมูลระบบ',930,225,290,110,C.purple);
let rag=box(s,'4  RAG + Ollama\nค้นเอกสารและตอบ',930,405,290,110,C.purple);
connect(s,web,api,C.cyan,'right','left');connect(s,ln,api,C.green,'right','left');connect(s,api,db,C.purple,'right','left',true);connect(s,api,rag,C.purple,'right','left',true);
note(s,'คำตอบย้อนกลับผ่าน FastAPI ไปยัง Web หรือ LINE ที่ส่งคำถามมา');
}
// 05 Frontend
{
const s=newSlide('Frontend','React + Vite + Tailwind CSS',
'เวลา 60 วินาที\nชี้จากซ้ายไปขวา 1 Login ให้ได้ตัวตนผู้ใช้ 2 เข้าหน้าหลัก ChatInterface ที่รวม Sidebar และ Top Bar 3 เลือกบอทเพื่อทดลองถามหรือใช้เมนูจัดการ\nAuthContext เก็บสถานะผู้ใช้ ส่วน useChatSession จัดการข้อความและการสนทนา แล้วส่งคำขอพร้อม token ไป API\nเอกสารรองรับ PDF DOCX TXT CSV ไม่เกิน 10 MB\nส่งต่อ: เมนูที่เห็นขึ้นอยู่กับบทบาทในระบบ','src/app/routes.tsx; src/app/App.tsx; src/app/components/chat/ChatInterface.tsx; api/routers/documents.py');
flow(s,['1  เข้าสู่ระบบ\nLogin','2  หน้าหลัก\nChatInterface','3  เลือกเมนู\nบอท / แชท / จัดการ']);
text(s,'สถานะผู้ใช้',80,470,340,45,27,C.cyan,true);text(s,'AuthContext',80,520,340,45,24);
text(s,'สถานะแชท',470,470,340,45,27,C.cyan,true);text(s,'useChatSession',470,520,340,45,24);
text(s,'เชื่อม Backend',860,470,340,45,27,C.cyan,true);text(s,'HTTP พร้อม JWT',860,520,340,45,24);
}
// 06 Roles
{
const s=newSlide('บทบาทและขอบเขตข้อมูล','สิทธิ์ของแพลตฟอร์มแยกจากหน้าที่ตอบแชทลูกค้า',
'เวลา 60 วินาที\nอ่านทีละแถว Admin จัดการผู้ใช้ ภาพรวม และ Log ส่วนงานบอทยังตรวจเจ้าของ\nSupport ในระบบนี้หมายถึงคนดูแลบัญชี เข้าหน้าจัดการผู้ใช้งาน ไม่ใช่ role สำหรับตอบแชท\nUser เป็นเจ้าของบอท ใช้เมนูสินค้าและแชทรวมของตัวเอง\nดังนั้น Demo ต้องให้เจ้าของบอทหรือ Admin เจ้าของบอทตอบแชท ไม่ใช้บัญชี Support\nส่งต่อ: Backend บังคับสิทธิ์นี้ซ้ำทุกคำขอที่เกี่ยวข้อง','src/app/constants/chat.ts; api/auth.py require_shop_operator, assert_bot_access, visible_bots_query');
const rows=[['Admin','จัดการผู้ใช้ ภาพรวม และ Audit Log','บอทและแชทอยู่ในขอบเขตที่ตนเป็นเจ้าของ'],['Support','ดูแลและอนุมัติบัญชีผู้ใช้งาน','ไม่เข้าหน้าบอทและไม่ตอบ Live Chat'],['User','เจ้าของบอทและเอกสาร','ใช้งานบอท ประวัติ การเชื่อมต่อ และแชทรวมของตน']];
rows.forEach((r,i)=>{let y=215+i*120;text(s,r[0],65,y,225,52,33,i===1?C.purple:C.cyan,true);text(s,r[1],325,y,880,45,27,C.white,true);text(s,r[2],325,y+50,880,44,24,C.muted);if(i<2)line(s,65,y+108,1140);});
note(s,'คนตอบแชท = เจ้าของบอทหรือ Admin ที่เป็นเจ้าของบอทนั้น');
}
// 07 Backend
{
const s=newSlide('Backend','Python คือภาษา  FastAPI คือ framework  JWT ใช้ยืนยันตัวตน',
'เวลา 60 วินาที\nชี้เลข 1 Backend รับคำขอจาก Web หรือ webhook ของ LINE\nเลข 2 คำขอ Web ตรวจ JWT บัญชีและสิทธิ์ ส่วน LINE ตรวจ signature\nเลข 3 Router เรียกงาน เช่น จัดการบอท เอกสาร หรือแชท\nเลข 4 อ่านเขียนข้อมูล เรียก RAG แล้วส่งผลกลับ\nไม่ต้องอ่านทุก endpoint ในช่วงนี้ รายชื่ออยู่ภาคผนวก\nส่งต่อ: ระบบเก็บข้อมูลสามชนิดในคนละส่วน','api/main.py; api/auth.py; api/routers/*.py');
flow(s,['1  รับคำขอ','2  ตรวจสิทธิ์','3  เลือกงาน','4  ประมวลผล'],245);
text(s,'Web และ LINE',65,420,265,45,24,C.muted,false,'center');text(s,'JWT / Signature',365,420,255,45,24,C.muted,false,'center');text(s,'Bots / Chat / Docs',665,420,255,45,24,C.muted,false,'center');text(s,'Database / RAG',965,420,255,45,24,C.muted,false,'center');
note(s,'FastAPI เป็นจุดประสานงาน และคืนผลลัพธ์หรือข้อผิดพลาดไปยังผู้เรียก');
}
// 08 Storage
{
const s=newSlide('ข้อมูลอยู่ที่ไหน','PostgreSQL เก็บข้อมูลระบบ  ChromaDB เก็บดัชนีความรู้  Storage เก็บไฟล์',
'เวลา 60 วินาที\nอธิบายจากซ้ายไปขวา PostgreSQL เก็บผู้ใช้ บอท metadata เอกสารและประวัติ ผ่าน SQLAlchemy\nChromaDB เก็บข้อความย่อยกับ embeddings โดยแยก directory ตาม bot_id ไม่ใช่ PostgreSQL คนละฐานต่อบอท\nDocument Storage เก็บไฟล์ต้นฉบับและไฟล์สำหรับนำเข้า\nส่งต่อ: ดูเฉพาะความสัมพันธ์ฐานข้อมูลที่เกี่ยวกับบอทก่อน','api/database.py; api/models.py; rag/ingest.py; docker-compose.yml');
box(s,'1  PostgreSQL',60,235,345,100);box(s,'2  ChromaDB',468,235,345,100,C.purple);box(s,'3  Document Storage',875,235,345,100,C.green,25);
text(s,'บัญชีและสิทธิ์\nบอทและรายการเอกสาร\nประวัติแชทและ Log',80,365,325,160,27);
text(s,'ข้อความย่อยและเวกเตอร์\nค้นหาเนื้อหาที่เกี่ยวข้อง\nแยกดัชนีตาม bot_id',490,365,325,160,27);
text(s,'ไฟล์ที่อัปโหลด\nPDF DOCX TXT CSV\nDocker volume: uploads',895,365,325,160,26);
note(s,'เชื่อม PostgreSQL ผ่าน SQLAlchemy และ DATABASE_URL');
}
// 09 ER
{
const s=newSlide('Database Relationships','เริ่มจาก users แล้วตามไป bots และเอกสารที่ผูกกับบอท',
'เวลา 70 วินาที\nชี้ users เป็นเจ้าของ bots และ documents ได้หลายรายการ\nบอทกับเอกสารเชื่อมผ่าน bot_documents จึงให้เอกสารเดียวใช้กับหลายบอทได้\nบอทหนึ่งมี conversations หลายรายการ และ live_sessions หลายครั้ง แต่ละ live_session มี live_messages หลายข้อความ\nนี่เป็น ER ย่อ ตาราง notifications password_reset_tokens audit_logs อยู่ในฐานเดียวกันแต่ไม่ใส่ในภาพหลักเพื่อให้อ่านง่าย\nส่งต่อ: เมื่อบอทมีเอกสารแล้ว ระบบจะสร้างฐานความรู้ให้บอท','api/models.py');
let u=box(s,'users',60,245,190,85);let b=box(s,'bots',350,245,190,85);let join=box(s,'bot_documents',650,245,245,85,C.purple,24);let d=box(s,'documents',995,245,225,85,C.purple,24);
let conv=box(s,'conversations',330,460,230,85,C.cyan,24);let ses=box(s,'live_sessions',660,460,230,85,C.cyan,24);let msg=box(s,'live_messages',990,460,230,85,C.cyan,24);
connect(s,u,b);connect(s,b,join,C.purple);connect(s,d,join,C.purple,'left','right');connect(s,b,conv,C.cyan,'bottom','top');connect(s,b,ses,C.cyan,'bottom','top');connect(s,ses,msg);
text(s,'1 : N',265,195,85,40,21,C.muted);text(s,'1 : N',555,195,85,40,21,C.muted);text(s,'N : 1',905,195,85,40,21,C.muted);text(s,'1 : N',340,388,85,40,21,C.muted);text(s,'1 : N',685,388,85,40,21,C.muted);text(s,'1 : N',905,413,85,40,21,C.muted);
note(s,'users เป็นเจ้าของ documents ด้วย  •  bots ↔ documents เป็น N : M ผ่านตารางเชื่อม');
}
// 10 Ingest
{
const s=newSlide('RAG ขั้นที่ 1 เตรียมความรู้','ทำเมื่อเพิ่ม เปลี่ยน หรือสั่งประมวลผลเอกสารของบอท',
'เวลา 60 วินาที\nอ่าน 1 ถึง 4 ผู้ใช้ส่งเอกสาร ระบบอ่านและแบ่งข้อความ BGE-M3 แปลงข้อความย่อยเป็น embeddings แล้ว ChromaDB เก็บไว้แยกตามบอท\nขั้นนี้เป็นการเตรียมดัชนีความรู้ ไม่ใช่ฝึกโมเดลภาษาใหม่ และยังไม่ใช่ขั้นตอบคำถาม\nส่งต่อ: เมื่อผู้ใช้ถาม ระบบใช้ดัชนีนี้อย่างไร','rag/ingest.py; rag/document_loader.py; rag/chunker.py; api/routers/documents.py');
flow(s,['1  เอกสาร\nของบอท','2  อ่านและแบ่ง\nข้อความ','3  BGE-M3\nสร้างเวกเตอร์','4  ChromaDB\nเก็บดัชนี'],270,C.purple);
text(s,'PDF / DOCX / TXT / CSV',70,465,530,46,27,C.white);text(s,'แยกที่ vector_db/{bot_id}',680,465,530,46,27,C.purple);
note(s,'การอัปเดตเอกสารทำให้บอทที่ใช้เอกสารนั้นต้องประมวลผลความรู้ใหม่');
}
// 11 Query
{
const s=newSlide('RAG ขั้นที่ 2 ตอบคำถาม','ค้นเนื้อหาที่เกี่ยวข้องก่อนให้โมเดลเรียบเรียงคำตอบ',
'เวลา 75 วินาที\nชี้ 1 คำถามใหม่และบริบทคำถามล่าสุดช่วยให้เข้าใจคำถามต่อเนื่อง\nชี้ 2 ตัว embedding แปลงคำค้นเพื่อหา chunks ที่ใกล้เคียงใน ChromaDB และกรองตาม distance\nชี้ 3 เอาข้อความที่ค้นได้เป็น context ส่งให้ Ollama พร้อมคำสั่งและประวัติ\nชี้ 4 คืนคำตอบพร้อมชื่อไฟล์และ snippet ให้ Web ส่วน LINE ส่งเป็นข้อความตาม router\nChromaDB เชื่อมที่การค้นหา ไม่ได้เป็นเส้นลัดเข้าโมเดล\nส่งต่อ: ดูคำถามเดียวกันในลำดับเวลาตั้งแต่ส่งจนตอบ','rag/rag_pipeline.py; rag/retriever.py; src/app/hooks/useChatSession.ts; api/routers/line_webhook.py');
const a=flow(s,['1  คำถาม\nและบริบท','2  ค้นข้อความ\nที่เกี่ยวข้อง','3  Ollama\nอ่าน context','4  คำตอบ\nและแหล่งอ้างอิง'],235,C.purple);
let db=box(s,'ChromaDB',367,455,255,85,C.purple,26);connect(s,db,a[1],C.purple,'top','bottom',true);
text(s,'BGE-M3 ใช้ค้นหา\nOllama ใช้เรียบเรียงคำตอบ',710,443,500,105,28,C.white);
note(s,'หากไม่พบข้อมูล ระบบเสนอหรือเริ่มการส่งต่อเจ้าหน้าที่ตามช่องทาง');
}
// 12 Sequence true
{
const s=newSlide('Sequence ของคำถามหนึ่งครั้ง','เวลาเดินจากบนลงล่าง อ่านลูกศรตามเลข 1 ถึง 5',
'เวลา 60 วินาที\nชี้หัวคอลัมน์ Web FastAPI และ RAG ก่อน แล้วอ่านจากบนลงล่าง\n1 Web ส่งคำถามและ session 2 FastAPI เรียก RAG หลังตรวจสิทธิ์ 3 RAG คืนคำตอบจากเอกสาร 4 Backend บันทึก conversation 5 ส่งคำตอบกลับ Web\nหน้านี้เป็น sequence แบบย่อ รายละเอียดค้นหาและ LLM อยู่หน้าก่อน\nส่งต่อ: อีกเส้นทางหนึ่งเกิดเมื่อบอทตอบไม่ได้','api/routers/chat.py; rag/rag_pipeline.py');
const xs=[190,640,1080];['Web','FastAPI','RAG'].forEach((v,i)=>{box(s,v,xs[i]-110,190,220,68,i===2?C.purple:C.cyan,28);line(s,xs[i],260,0,315);});
function msg(a,b,y,label,col=C.cyan){const q=s.shapes.add({geometry:'rect',position:{left:xs[a],top:y,width:1,height:1},fill:'none',line:{fill:'none',width:0}});const z=s.shapes.add({geometry:'rect',position:{left:xs[b],top:y,width:1,height:1},fill:'none',line:{fill:'none',width:0}});connect(s,q,z,col,a<b?'right':'left',a<b?'left':'right');text(s,label,Math.min(xs[a],xs[b])+18,y-39,Math.abs(xs[a]-xs[b])-30,36,23,C.white);}
msg(0,1,303,'1  ส่งคำถามและ session');msg(1,2,365,'2  เรียก RAG',C.purple);msg(2,1,430,'3  คืนคำตอบและ sources',C.purple);text(s,'4  บันทึก PostgreSQL',662,447,455,43,23,C.muted);msg(1,0,553,'5  ส่งผลกลับ Web');
note(s,'ลูกศรแสดงการเรียกและการคืนผล ไม่ได้แสดงเวลาในการประมวลผลจริง');
}
// 13 Handoff
{
const s=newSlide('เมื่อบอทตอบไม่ได้','สถานะการสนทนามี bot waiting และ human',
'เวลา 60 วินาที\nอ่านตามเลข 1 ถึง 4 bot ตอบจากเอกสาร เมื่อเข้า handoff จะรอใน waiting พอคนตอบครั้งแรกจึงเปลี่ยนเป็น human หลังจบงานกลับ bot และปิด active session\nWeb ที่ไม่พบคำตอบแสดงปุ่มให้เลือกติดต่อเจ้าหน้าที่ ส่วน LINE สามารถเข้าสู่คิวอัตโนมัติ\nคนตอบคือเจ้าของบอทหรือ Admin ที่เป็นเจ้าของ ไม่ใช่ role Support ของแพลตฟอร์ม\nส่งต่อ: ทั้งสองช่องทางเชื่อมผ่าน deployment เดียวกัน','api/routers/chat.py; api/routers/live_chat.py; api/routers/line_webhook.py; api/auth.py');
flow(s,['1  bot\nบอทตอบ','2  waiting\nรอคนรับ','3  human\nคนตอบแชท','4  bot\nจบ session'],250,C.amber);
text(s,'Web',80,460,150,45,28,C.cyan,true);text(s,'แสดงปุ่มติดต่อเจ้าหน้าที่เมื่อไม่พบคำตอบ',245,460,950,45,27);
text(s,'LINE',80,525,150,45,28,C.green,true);text(s,'เข้าสู่คิวเมื่อไม่พบคำตอบหรือขอคุยกับคน',245,525,950,45,27);
}
// 14 Deployment
{
const s=newSlide('Deployment','Cloudflare Tunnel รับ Web และ LINE ผ่าน Nginx จุดเดียว',
'เวลา 60 วินาที\nอ่านซ้ายไปขวา Browser และ LINE ส่ง HTTPS เข้า Tunnel จากนั้นไป Nginx\nNginx ให้ไฟล์ React กับ browser ส่วนเส้นทาง /api/ ส่งไป FastAPI รวม webhook\nFastAPI ติดต่อ PostgreSQL และ volume เอกสารกับ ChromaDB ภายใน deployment ส่วน Ollama รันบน host ตาม compose\nส่งต่อ: ต่อไปคือแผนดำเนินงานและส่วนที่ใช้ Demo','docker-compose.yml; docker-compose.tunnel.yml; deploy/nginx.conf');
let client=box(s,'Browser / LINE',60,210,245,95);let cf=box(s,'Cloudflare Tunnel',355,210,275,95,C.cyan,25);let ngx=box(s,'Nginx',695,210,210,95);let api=box(s,'FastAPI',980,390,240,95);let react=box(s,'React files',980,200,240,95);connect(s,client,cf);connect(s,cf,ngx);connect(s,ngx,react);connect(s,ngx,api,C.purple,'bottom','left');text(s,'/api/*',820,352,130,45,25,C.purple);
text(s,'Docker Compose',70,388,670,50,29,C.cyan,true);text(s,'frontend  /  api  /  db  /  cloudflared',70,440,800,45,26);text(s,'Volumes: pgdata  uploads  vectordb',70,492,820,45,24,C.muted);
note(s,'Ollama รันบน host และ API เรียกผ่าน host.docker.internal:11434');
}
// 15 Timeline
{
const s=newSlide('Timeline การทำงาน','แผนโครงการ มีนาคม ถึง ตุลาคม 2569',
'เวลา 60 วินาที\nเล่าจากบนลงล่าง มีนาคมออกแบบ เมษายนถึงพฤษภาคมพัฒนาแกนหลัก มิถุนายนถึงสิงหาคมปรับ RAG และ handoff กันยายนเตรียม demo และทดสอบ ตุลาคมเตรียมส่งมอบ\nสถานะในสองช่วงท้ายแสดงเป็นแผนตามไฟล์ต้นฉบับ ไม่กล่าวว่า UAT ผ่านแล้วหากยังไม่มีผลทดสอบ\nส่งต่อ: สำหรับการสาธิตรอบนี้จะเดินตามเส้นทางที่เตรียมไว้','ScopeBot.pdf.pdf หน้า 12 แผนงานเดิม; git log ยืนยันงานที่ปรากฏใน repository ถึง 4 ก.ย. 2569');
const rows=[['มี.ค.','ออกแบบและต้นแบบ','UX/UI, Database และ RAG'],['เม.ย. – พ.ค.','พัฒนาและเชื่อมต่อ','Web, API, LINE และสิทธิ์'],['มิ.ย. – ส.ค.','ปรับระบบและทดสอบ','RAG, Handoff และการติดตั้ง'],['ก.ย.','เตรียม Demo และ UAT','ช่วงดำเนินงานตามแผน'],['ต.ค.','เอกสารและส่งมอบ','ขั้นถัดไปตามแผน']];
rows.forEach((r,i)=>{let y=189+i*78;text(s,r[0],65,y,225,50,28,i>2?C.amber:C.cyan,true);text(s,r[1],320,y,480,50,28,C.white,true);text(s,r[2],800,y,420,50,24,C.muted);if(i<4)line(s,65,y+65,1145);});
}
// 16 Demo
{
const s=newSlide('Demo ScopeBot','เส้นทางสาธิตประมาณ 4 นาที',
'เวลา 4 นาที\nก่อนเริ่ม เปิดบัญชีเจ้าของบอทที่ได้รับอนุมัติและบอท active เตรียมเอกสารสาธิตที่ไม่มีข้อมูลส่วนบุคคล เปิด LINE OA อีกหน้าจอ\n1 แสดงบอทและเอกสารที่ใช้ 2 ถามเรื่องที่มีคำตอบในเอกสาร 3 เปิดชื่อไฟล์และ snippet บน Web 4 จาก LINE ขอคุยเจ้าหน้าที่ แล้วใช้บัญชีเจ้าของบอทเปิดแชทรวม ตอบและจบ session\nถ้า LINE ยังไม่พร้อมใช้ Web handoff กับบัญชีเจ้าของเดิมคนละหน้าต่างได้ ถ้าระบบช้าให้พูดอธิบายจาก flow ที่เตรียมไว้ ไม่กล่าวว่าทำงานสำเร็จจนเห็นผลจริง\nส่งต่อ: สรุปสิ่งที่ได้เห็นจาก Demo','src/app/components/chat/BotsPage.tsx; src/app/components/admin/UnifiedChat.tsx; api/routers/live_chat.py');
const rows=[['1','เลือกบอท','ดูเอกสารและสถานะพร้อมใช้งาน'],['2','ถามคำถาม','ใช้คำถามที่มีคำตอบอยู่ในเอกสาร'],['3','ดูแหล่งอ้างอิง','เปิดชื่อไฟล์และข้อความอ้างอิงบน Web'],['4','ส่งต่อคน','ขอเจ้าหน้าที่ ตอบในแชทรวม และจบ session']];
rows.forEach((r,i)=>{let y=205+i*89;text(s,r[0],75,y,70,58,39,C.cyan,true);text(s,r[1],170,y,325,58,31,C.white,true);text(s,r[2],510,y,690,58,26,C.muted);});
note(s,'บัญชีตอบแชทต้องเป็นเจ้าของบอท ไม่ใช่ role Support');
}
// 17 Close
{
const s=newSlide('ScopeBot ทำงานร่วมกันอย่างไร','เอกสารเป็นแหล่งความรู้และเจ้าของบอทรับช่วงเมื่อจำเป็น',
'เวลา 40 วินาที\nสรุปทีละบรรทัด Frontend เป็นจุดใช้งาน FastAPI ควบคุมงานและสิทธิ์ RAG ค้นเอกสารก่อนเรียกโมเดล ส่วนคนรับช่วงเมื่อระบบไม่มีคำตอบ\nปิดด้วย ขอบคุณครับหรือค่ะ ยินดีตอบคำถามเรื่องโครงสร้าง การเก็บข้อมูล หรือการทำงานที่สาธิตไป\nภาคผนวกถัดไปเปิดเมื่อมีคำถามเรื่อง API เท่านั้น','README.md; api/main.py; rag/rag_pipeline.py');
text(s,'Frontend เป็นจุดใช้งาน',90,215,1110,65,34,C.white,true);
text(s,'FastAPI ควบคุมคำขอและข้อมูล',90,302,1110,65,34,C.white,true);
text(s,'RAG ค้นเอกสารก่อนสร้างคำตอบ',90,389,1110,65,34,C.white,true);
text(s,'คนรับช่วงเมื่อบอทไม่มีคำตอบ',90,476,1110,65,34,C.white,true);
text(s,'คำถามและข้อเสนอแนะ',90,588,1110,58,30,C.purple);
}
// 18 API appendix
{
const s=newSlide('ภาคผนวก API หลัก','ใช้เปิดประกอบคำถามด้านเทคนิคหลังจบการนำเสนอ',
'ไม่จำเป็นต้องอ่านหน้านี้ในช่วงหลัก\nอธิบายเฉพาะกลุ่มที่ผู้ฟังถาม เช่น /api/auth สำหรับบัญชี /api/bots และ /api/documents สำหรับความรู้ /api/chat สำหรับคำถามและประวัติ /api/live สำหรับรับช่วงแชท\nLINE webhook จริงมี bot_id ต่อท้าย และตรวจ signature ส่วน /api/health เป็นจุดตรวจสถานะ','api/main.py; api/routers/*.py');
const rows=[['บัญชีและสิทธิ์','/api/auth'],['บอทและเอกสาร','/api/bots    /api/documents'],['แชทและเจ้าหน้าที่','/api/chat    /api/live'],['สถิติและการติดตาม','/api/dashboard    /api/notifications'],['Audit และสถานะ','/api/audit-logs    /api/health'],['LINE Webhook','/api/line/webhook/{bot_id}']];
rows.forEach((r,i)=>{let y=190+i*65;text(s,r[0],65,y,380,48,26,C.cyan,true);text(s,r[1],455,y,760,48,25,C.white);});
}

await fs.writeFile(path.join(dir,'speaker-notes.json'),JSON.stringify(guide,null,2));
await (await PresentationFile.exportPptx(p)).save(path.join(dir,'candidate.pptx'));
console.log('EXPORTED '+p.slides.items.length);
