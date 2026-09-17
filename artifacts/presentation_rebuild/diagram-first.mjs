import fs from 'node:fs/promises';
import {Presentation,PresentationFile} from '@oai/artifact-tool';
const p=Presentation.create({slideSize:{width:1280,height:720}});
const B='#07090C',F='#121D2B',C='#30B9EF',P='#AC57E8',G='#67D5AF',W='#F2F5F8',M='#AAB9CB',A='#FFBF69';
const old=JSON.parse(await fs.readFile('artifacts/presentation_rebuild/speaker-notes.json','utf8'));
const guide=[];
function txt(s,t,x,y,w,h=50,size=27,color=W,bold=false,align='center'){
const q=s.shapes.add({geometry:'textbox',position:{left:x,top:y,width:w,height:h},fill:'none',line:{fill:'none',width:0}});q.text=t;q.text.style={typeface:'Tahoma',fontSize:size,color,bold,alignment:align,verticalAlignment:'middle',autoFit:'none',insets:{top:0,bottom:0,left:0,right:0}};return q;}
function node(s,t,x,y,w=210,h=100,col=C,geo='roundRect',size=29){
const q=s.shapes.add({geometry:geo,position:{left:x,top:y,width:w,height:h},fill:F,line:{fill:col,width:3}});txt(s,t,x+10,y+10,w-20,h-20,size,W,true);return {q,x,y,w,h};}
function port(n,side){return side==='L'?[n.x,n.y+n.h/2]:side==='R'?[n.x+n.w,n.y+n.h/2]:side==='T'?[n.x+n.w/2,n.y]:[n.x+n.w/2,n.y+n.h];}
function arrow(s,points,col=C,head=true,width=3){
for(let i=1;i<points.length;i++){const [x,y]=points[i-1],[xx,yy]=points[i];const a=s.shapes.add({geometry:'rect',position:{left:x,top:y,width:0.1,height:0.1},fill:'none',line:{fill:'none',width:0}});const b=s.shapes.add({geometry:'rect',position:{left:xx,top:yy,width:0.1,height:0.1},fill:'none',line:{fill:'none',width:0}});s.shapes.connect(a,b,{kind:'straight',line:{fill:col,width},...(head&&i===points.length-1?{tail:{type:'triangle'}}:{})});}}
function link(s,a,b,col=C,sa='R',sb='L',via=[]){arrow(s,[port(a,sa),...via,port(b,sb)],col);}
function sub(s,t,x,y,w=240,col=M){txt(s,t,x,y,w,45,23,col);}
function stage(s,n,x,y,col=C){node(s,String(n),x,y,42,42,col,'ellipse',23);}
function slide(title,oldN,read,script){const s=p.slides.add();s.background.fill=B;txt(s,title,55,35,1170,70,43,C,true,'left');txt(s,String(p.slides.items.length).padStart(2,'0'),1170,670,55,25,17,M,false,'right');
const o=old.find(x=>x.n===oldN);const spoken=script??o.script;const notes=`วิธีชี้ภาพ: ${read}\n\n${spoken}\n\nแหล่งอ้างอิง: ${o.source}`;s.speakerNotes.textFrame.setText(notes);guide.push({n:p.slides.items.length,title,read,script:spoken,source:o.source});return s;}
function foot(s,t){txt(s,t,65,620,1140,42,23,M);}

// 1: The product itself as a diagram. No photographs or screenshots.
{
let s=slide('ScopeBot',1,'ชี้เอกสารด้านซ้าย ผ่าน ScopeBot ตรงกลาง แล้วไปยังสองช่องทางด้านขวา','เวลา 40 วินาที\nแนะนำชื่อเล่นผู้พูดและสมาชิก ก้อง ป๊อกกี้ ฟลุ๊ค ฟอร์ด มอส แล้วกล่าวว่า ScopeBot นำเอกสารมาเป็นแหล่งความรู้ ผู้ใช้ถามผ่าน Web หรือ LINE ระบบค้นเนื้อหาที่เกี่ยวข้องก่อนตอบ\nวันนี้จะใช้ Diagram พาดูว่าภายในทำงานอย่างไร แล้วสาธิตระบบจริง');
let d=node(s,'เอกสาร',65,255,220,220,P,'flowChartDocument',36);let b=node(s,'ScopeBot',490,210,300,300,C,'hexagon',43);let web=node(s,'Web',985,200,230,120,C,'roundRect',36);let ln=node(s,'LINE',985,425,230,120,G,'roundRect',36);link(s,d,b,P);link(s,b,web,C,'R','L',[[890,360],[890,260]]);link(s,b,ln,G,'R','L',[[890,360],[890,485]]);sub(s,'แหล่งความรู้',60,495,230,P);sub(s,'ค้นก่อนตอบ',510,530,260,C);foot(s,'ระบบตอบคำถามจากเอกสารผ่าน Web และ LINE');
}
// 2: Big picture, deliberately only four functional groups.
{
let s=slide('ภาพรวมระบบ',4,'1 ซ้าย: ช่องทาง  2 กลาง: Backend  3 ขวาบน: ข้อมูล  4 ขวาล่าง: AI');
let web=node(s,'Web',65,210,205,95,C);let ln=node(s,'LINE',65,430,205,95,G);let api=node(s,'FastAPI',475,260,270,210,C,'hexagon',38);let db=node(s,'PostgreSQL',960,175,265,145,P,'can',29);let rag=node(s,'RAG + AI',960,435,265,145,P,'hexagon',32);
link(s,web,api,C,'R','L',[[370,257],[370,365]]);link(s,ln,api,G,'R','L',[[370,477],[370,365]]);link(s,api,db,P,'R','L',[[850,365],[850,247]]);link(s,api,rag,P,'R','L',[[850,365],[850,507]]);stage(s,1,65,150);stage(s,2,585,190);stage(s,3,1065,115,P);stage(s,4,1065,365,P);sub(s,'จัดการคำขอ',490,490,240);foot(s,'คำตอบกลับผ่าน FastAPI ไปยังช่องทางเดิม');
}
// 3: Frontend navigation, one branching map, no faux screenshot.
{
let s=slide('Frontend',5,'เริ่มที่ Login ไปยัง React จากนั้นเลือกหนึ่งในสามงาน และส่งคำขอไป API','เวลา 60 วินาที\nชี้ Login เพื่ออธิบายการเข้าสู่ระบบและ AuthContext\nReact เป็นจุดรวมหน้าบอท แชท และเมนูจัดการตามสิทธิ์ ทุกงานเรียก Backend ผ่าน HTTP พร้อม JWT\nuseChatSession ดูแลข้อความและ session ในส่วนแชท\nส่งต่อ: เมนูที่เห็นขึ้นอยู่กับบทบาทของบัญชี');
let login=node(s,'Login',60,300,185,110);let app=node(s,'React',370,250,240,210,C,'hexagon',36);link(s,login,app);
const ys=[175,325,475],labs=['บอท + เอกสาร','แชท','จัดการบัญชี'];const ns=labs.map((t,i)=>node(s,t,760,ys[i],265,95,i===1?P:C,'roundRect',29));ns.forEach((n,i)=>link(s,app,n,i===1?P:C,'R','L',[[685,355],[685,ys[i]+47.5]]));let api=node(s,'API',1130,285,110,140,P,'hexagon',28);ns.forEach((n,i)=>link(s,n,api,P,'R','L',[[1075,ys[i]+47.5],[1075,355]]));sub(s,'AuthContext',45,440,210);sub(s,'Vite + Tailwind CSS',335,485,310);foot(s,'เมนูเปลี่ยนตามสิทธิ์  /  คำขอส่งพร้อม JWT');
}
// 4: permissions as reachability graph.
{
let s=slide('ใครเข้าถึงอะไร',6,'อ่านทีละแถว Admin, Support, User แล้วเน้นหมายเหตุเรื่องเจ้าของบอท');
const roles=['Admin','Support','User'],dest=['ผู้ใช้ + ภาพรวม + Log','จัดการผู้ใช้','บอท + เอกสาร + แชท'];roles.forEach((t,i)=>{let y=175+i*145;let a=node(s,t,100,y,225,105,i===1?P:C,'ellipse',31);let b=node(s,dest[i],635,y,540,105,i===1?P:C,'roundRect',32);link(s,a,b,i===1?P:C);});foot(s,'งานบอทและ Live Chat ตรวจเจ้าของบอท แม้เป็น Admin');
}
// 5: two auth paths converge before business routing.
{
let s=slide('Backend รับคำขออย่างไร',7,'ชี้แถว Web และ LINE แยกกัน แล้วมารวมที่ Router ก่อนแยกไปงานข้อมูลหรือ RAG');
let w=node(s,'Web',55,200,165,95);let l=node(s,'LINE',55,435,165,95,G);let jwt=node(s,'JWT',335,165,230,160,C,'diamond',30);let sig=node(s,'Signature',335,405,230,160,G,'diamond',26);link(s,w,jwt);link(s,l,sig,G);let r=node(s,'Router',700,275,220,180,C,'hexagon',32);link(s,jwt,r,C,'R','L',[[635,245],[635,365]]);link(s,sig,r,G,'R','L',[[635,485],[635,365]]);let db=node(s,'ข้อมูล',1040,205,190,120,P,'can');let ai=node(s,'RAG',1040,435,190,120,P,'hexagon');link(s,r,db,P,'R','L',[[980,365],[980,265]]);link(s,r,ai,P,'R','L',[[980,365],[980,495]]);foot(s,'Python + FastAPI  /  ตรวจสิทธิ์ก่อนเรียกงาน');
}
// 6: storage shown by actual semantics, not three paragraphs.
{
let s=slide('ข้อมูล 3 ส่วน',8,'เริ่มที่ ScopeBot กลางภาพ แล้วชี้ซ้าย ขวา ล่าง ตามชนิดข้อมูล');
let center=node(s,'ScopeBot',485,250,290,175,C,'hexagon',35);let pg=node(s,'PostgreSQL',60,225,285,200,C,'can',30);let ch=node(s,'ChromaDB',940,225,280,200,P,'can',32);let file=node(s,'ไฟล์เอกสาร',505,505,250,95,G,'flowChartDocument',28);link(s,center,pg,C,'L','R');link(s,center,ch,P);link(s,center,file,G,'B','T');sub(s,'บัญชี / บอท / ประวัติ',55,450,300);sub(s,'ข้อความย่อย + เวกเตอร์',925,450,310);foot(s,'ดัชนี ChromaDB แยกตาม bot_id');
}
// 7: focus ER on knowledge; chat relationships go in Notes, reducing overload.
{
let s=slide('Database: เจ้าของและความรู้',9,'อ่าน users บนสุด แตกไป bots กับ documents แล้วดูตารางเชื่อมด้านล่าง','เวลา 60 วินาที\nusers เป็นเจ้าของ bots และ documents ได้หลายรายการ จึงเป็น 1 ต่อหลาย\nbots และ documents เชื่อมผ่าน bot_documents บอทหนึ่งใช้หลายเอกสาร และเอกสารเดียวผูกกับหลายบอทได้\nนี่เป็นส่วนความสัมพันธ์ด้านความรู้ ส่วน conversations ผูกกับ bot และ live_sessions ผูกกับ bot โดย live_messages ผูกกับ session\nส่งต่อ: ต่อไปนำเอกสารเหล่านี้มาเตรียมให้ AI ค้นหา');
let u=node(s,'users',515,155,250,100);let b=node(s,'bots',100,335,270,125);let d=node(s,'documents',910,335,270,125,P);let j=node(s,'bot_documents',480,510,320,105,P,'roundRect',28);link(s,u,b,C,'L','T',[[235,205]]);link(s,u,d,P,'R','T',[[1045,205]]);link(s,b,j,P,'B','L',[[235,562]]);link(s,d,j,P,'B','R',[[1045,562]]);sub(s,'1 : N',255,230,170,C);sub(s,'1 : N',840,230,170,P);sub(s,'1 : N',295,570,170,P);sub(s,'N : 1',815,570,170,P);txt(s,'N : M',500,355,280,70,42,P,true);
}
// 8: ingestion represented by documents -> chunk set -> embedding -> storage.
{
let s=slide('เตรียมความรู้ให้บอท',10,'ชี้เอกสาร 1 ตามลูกศรไปข้อความย่อย 2, BGE-M3 3 และ ChromaDB 4');
let doc=node(s,'เอกสาร',60,270,205,220,P,'flowChartDocument',32);let chunks=node(s,'ข้อความ\nย่อย',360,290,215,175,P,'flowChartMultidocument',31);let embed=node(s,'BGE-M3',670,270,220,220,P,'hexagon',31);let db=node(s,'ChromaDB',985,270,235,220,P,'can',30);link(s,doc,chunks,P);link(s,chunks,embed,P);link(s,embed,db,P);[140,440,755,1080].forEach((x,i)=>stage(s,i+1,x,185,P));sub(s,'อ่านไฟล์',60,525,205);sub(s,'แบ่งข้อความ',345,525,245);sub(s,'สร้างเวกเตอร์',650,525,260);sub(s,'แยกตามบอท',980,525,250);foot(s,'PDF / DOCX / TXT / CSV');
}
// 9: query flow with Chroma on retrieval, source result visible.
{
let s=slide('ค้นก่อนตอบ',11,'เริ่มคำถามซ้ายบน ค้นกับ ChromaDB ด้านล่าง แล้วส่ง context ไป Ollama และคำตอบ');
let q=node(s,'คำถาม',55,205,200,125,C,'roundRect',32);let search=node(s,'ค้นหา',380,175,230,185,P,'hexagon',34);let db=node(s,'ChromaDB',380,460,230,145,P,'can',28);let llm=node(s,'Ollama',745,185,230,165,P,'hexagon',34);let answer=node(s,'คำตอบ',1060,205,170,125,G,'roundRect',29);link(s,q,search);link(s,search,llm,P);link(s,llm,answer,G);link(s,db,search,P,'T','B');sub(s,'context',610,210,135,P);sub(s,'BGE-M3',550,380,220,P);sub(s,'อ้างอิงเอกสาร',990,380,270,G);foot(s,'คำถามต่อเนื่องใช้บริบทจากประวัติ');
}
// 10: true sequence with minimal labels.
{
let s=slide('คำถามหนึ่งครั้ง',12,'หัวคอลัมน์เป็นผู้เกี่ยวข้อง เวลาเดินจากบนลงล่างตามเลข 1–5');
const xs=[190,640,1090];['Web','FastAPI','RAG'].forEach((t,i)=>{node(s,t,xs[i]-110,145,220,75,i===2?P:C,'roundRect',30);arrow(s,[[xs[i],220],[xs[i],615]],'#344456',false,2);});
const msg=(a,b,y,t,col)=>{arrow(s,[[xs[a],y],[xs[b],y]],col);txt(s,t,Math.min(xs[a],xs[b])+20,y-45,410,40,25,W,false,'left');};msg(0,1,285,'1  ส่งคำถาม',C);msg(1,2,365,'2  ค้นและสร้างคำตอบ',P);msg(2,1,445,'3  คืนผล',P);txt(s,'4  บันทึกประวัติ',665,467,400,45,25,M,false,'left');msg(1,0,575,'5  แสดงคำตอบ',G);
}
// 11: State cycle conveys the handoff, not a text checklist.
{
let s=slide('บอทส่งต่อให้คน',13,'อ่านวงจรตามเข็มนาฬิกาจาก bot ไป waiting และ human แล้วกลับ bot');
let bot=node(s,'bot',70,240,230,230,C,'ellipse',40);let wait=node(s,'waiting',515,240,230,230,A,'ellipse',35);let human=node(s,'human',960,240,230,230,G,'ellipse',36);link(s,bot,wait,A);link(s,wait,human,G);sub(s,'ขอเจ้าหน้าที่',295,255,225,A);sub(s,'คนตอบครั้งแรก',735,255,235,G);link(s,human,bot,C,'B','B',[[1075,555],[185,555]]);sub(s,'จบการสนทนา',475,555,310,C);foot(s,'Web ให้เลือกส่งต่อ  /  LINE เข้าคิวได้อัตโนมัติ');
}
// 12: deployment topology, all nodes accurately scoped.
{
let s=slide('ระบบเชื่อมต่อกันที่ไหน',14,'อ่านทางเข้าซ้ายบน ผ่าน Tunnel และ Nginx จากนั้นแยกไฟล์เว็บกับ API แล้วดูบริการด้านล่าง');
let client=node(s,'Web / LINE',55,170,220,95);let tun=node(s,'Tunnel',400,170,215,95);let nginx=node(s,'Nginx',740,170,190,95);let react=node(s,'React files',1030,170,205,95);link(s,client,tun);link(s,tun,nginx);link(s,nginx,react);let api=node(s,'FastAPI',720,355,230,145,C,'hexagon',32);link(s,nginx,api,C,'B','T');sub(s,'/api/*',935,285,155,C);
let pg=node(s,'PostgreSQL',55,550,240,105,P,'can',26);let store=node(s,'ไฟล์ + ChromaDB',380,550,265,105,P,'can',25);let oll=node(s,'Ollama',1010,360,225,135,P,'hexagon',30);link(s,api,pg,P,'B','T',[[835,520],[175,520]]);link(s,api,store,P,'B','T',[[835,520],[512.5,520]]);link(s,api,oll,P);sub(s,'รันบน host',1010,550,225,P);txt(s,'Docker Compose',55,380,530,65,31,C,true,'left');
}
// 13: timeline is actually a timeline, not rows of prose.
{
let s=slide('Timeline 2569',15,'อ่านหมุดเวลาซ้ายไปขวา ช่วงกันยายนและตุลาคมเป็นแผนที่ต้องยืนยันสถานะ','เวลา 50 วินาที\nแผนเดิมเริ่มมีนาคมออกแบบ เมษายนถึงพฤษภาคมพัฒนาแกนหลัก มิถุนายนถึงสิงหาคมปรับระบบ กันยายนเตรียม Demo และ UAT ตุลาคมเตรียมส่งมอบ\nรายการนี้เป็นแผนจากเอกสารเดิม ต้องอัปเดตสถานะกับทีม ไม่อ้างว่า UAT ผ่านแล้ว\nส่งต่อ: ต่อไปสาธิตตามเส้นทางที่เตรียม');
arrow(s,[[100,360],[1180,360]],C,true,5);const xs=[135,380,625,870,1115],months=['มี.ค.','เม.ย.–พ.ค.','มิ.ย.–ส.ค.','ก.ย.','ต.ค.'],labs=['ออกแบบ','พัฒนา','ปรับระบบ','Demo / UAT','ส่งมอบ'];xs.forEach((x,i)=>{node(s,String(i+1),x-28,332,56,56,i>=3?A:C,'ellipse',25);txt(s,months[i],x-115,220,230,65,32,i>=3?A:C,true);txt(s,labs[i],x-115,445,230,60,29,W,true);if(i>=3)sub(s,'ตามแผน',x-110,520,220,A);});
}
// 14: demo is a path, two rows with one direction of reading.
{
let s=slide('Demo: เดินตามเส้นทางนี้',16,'ชี้ 1–3 แถวบน แล้วลงมาที่ 4–5 แถวล่าง','เวลา 4 นาที\nก่อนเริ่ม เปิดบัญชีเจ้าของบอทที่อนุมัติแล้ว บอท active และประมวลผลเอกสารพร้อมใช้งาน\n1 เลือกบอทและเอกสาร 2 ถามเรื่องที่อยู่ในเอกสาร 3 เปิดชื่อไฟล์กับข้อความอ้างอิงบน Web 4 ขอคุยเจ้าหน้าที่จาก LINE หรือ Web 5 เจ้าของบอทตอบในแชทรวมและจบ session\nใช้ข้อมูลสาธิตที่ไม่มีข้อมูลส่วนบุคคล ซ้อมเส้นทางนี้ก่อนวันจริง\nส่งต่อ: สรุปภาพการทำงานทั้งหมด');
let ns=[node(s,'1\nเลือกบอท',70,195,240,155,C,'hexagon',30),node(s,'2\nถาม',515,195,240,155,C,'ellipse',31),node(s,'3\nดูอ้างอิง',960,195,240,155,P,'flowChartDocument',30),node(s,'4\nขอเจ้าหน้าที่',960,470,240,145,A,'roundRect',28),node(s,'5\nตอบและจบ',515,470,240,145,G,'roundRect',29)];link(s,ns[0],ns[1]);link(s,ns[1],ns[2],P);link(s,ns[2],ns[3],A,'B','T');link(s,ns[3],ns[4],G,'L','R');txt(s,'ประมาณ\n4 นาที',85,455,220,145,37,M,true);
}
// 15: final recap with one question and two possible paths.
{
let s=slide('ScopeBot ทำงานครบวงจร',17,'เริ่มคำถามทางซ้าย ผ่านการค้น แล้วแตกเป็นตอบจากเอกสารหรือส่งต่อคน','เวลา 45 วินาที\nคำถามเข้ามาทาง Web หรือ LINE แล้ว FastAPI เรียก RAG ค้นเอกสาร ถ้ามีข้อมูลก็สร้างคำตอบและส่งกลับ ถ้าไม่มีคำตอบจะเสนอหรือเริ่มการส่งต่อคนตามช่องทาง\nชี้สองทางเลือกให้เห็นว่าความรู้จากเอกสารและเจ้าของบอททำงานร่วมกัน\nขอบคุณและเปิดรับคำถาม');
let q=node(s,'คำถาม',55,285,210,130,C);let r=node(s,'ค้นเอกสาร',435,245,270,210,P,'hexagon',34);let a=node(s,'คำตอบ',960,170,250,130,G);let h=node(s,'เจ้าของบอท',960,445,250,130,A,'ellipse',30);link(s,q,r,C);link(s,r,a,G,'R','L',[[825,350],[825,235]]);link(s,r,h,A,'R','L',[[825,350],[825,510]]);sub(s,'พบข้อมูล',780,170,175,G);sub(s,'ส่งต่อ',785,445,165,A);foot(s,'คำถามและข้อเสนอแนะ');
}
await (await PresentationFile.exportPptx(p)).save('artifacts/presentation_rebuild/diagram-candidate.pptx');
await fs.writeFile('artifacts/presentation_rebuild/diagram-notes.json',JSON.stringify(guide,null,2));
await fs.writeFile('deliverables/ScopeBot_Diagram_Speaking_Guide_TH.md','# ScopeBot: คู่มือเล่าผ่าน Diagram\n\nภาพส่วนใหญ่อ่านซ้ายไปขวา ยกเว้น Sequence อ่านบนลงล่าง และวงจรส่งต่อคนอ่านตามลูกศร ไม่ต้องอ่านทุกชื่อเทคโนโลยี ให้บอกว่าใครส่งอะไร ระบบทำอะไรต่อ และผลกลับไปไหน\n\n'+guide.map(x=>`## ${x.n}. ${x.title}\n\nชี้ภาพ: ${x.read}\n\n${x.script}\n\nอ้างอิง: ${x.source}\n`).join('\n'));
console.log('EXPORTED '+p.slides.items.length);
