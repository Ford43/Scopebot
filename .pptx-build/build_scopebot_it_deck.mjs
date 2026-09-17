import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { Presentation, PresentationFile } from "@oai/artifact-tool";

process.env.RUNTIME_NODE_MODULES = "C:\\Users\\keror\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\node\\node_modules";
const workspaceDir = "C:\\Users\\keror\\Documents\\GitHub\\Scopebot";
const SKILL_DIR = "C:\\Users\\keror\\.codex\\plugins\\cache\\openai-primary-runtime\\presentations\\26.909.11809\\skills\\presentations";
const TMP_DIR = path.join(workspaceDir, ".pptx-build");
const FINAL_PPTX = path.join(workspaceDir, "deliverables", "ScopeBot_IT_Presentation_2026.pptx");
const RUNTIME_PYTHON = "C:\\Users\\keror\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\python\\python.exe";
const { finalizePresentation } = await import(pathToFileURL(path.join(SKILL_DIR, "container_tools", "artifact_tool_utils.mjs")).href);

const W = 1280, H = 720;
const C = { bg: "#080B12", ink: "#F4F7FF", muted: "#B7C5D8", cyan: "#28B7F2", purple: "#A45AF4", navy: "#102445", teal: "#23C6C8", yellow: "#FFCB44", line: "#25415D", soft: "#121C2B" };
const FONT = "Leelawadee UI";
const p = Presentation.create({ slideSize: { width: W, height: H } });

function rect(slide, x, y, w, h, fill, radius = false, line = "none") {
  return slide.shapes.add({ geometry: radius ? "roundRect" : "rect", position: { left:x, top:y, width:w, height:h }, fill, line: { style:"solid", fill:line, width: line === "none" ? 0 : 1 }, borderRadius: radius ? "rounded-xl" : undefined });
}
function txt(slide, text, x, y, w, h, opts = {}) {
  const sh = slide.shapes.add({ geometry:"textbox", position:{left:x,top:y,width:w,height:h}, fill:"none", line:{style:"solid",fill:"none",width:0} });
  sh.text = text;
  sh.text.style = { typeface:FONT, fontSize:opts.size ?? 24, color:opts.color ?? C.ink, bold:opts.bold ?? false, alignment:opts.align ?? "left", verticalAlignment:opts.valign ?? "middle", autoFit:"shrinkText", breakLine: false };
  return sh;
}
function header(slide, title, subtitle = "") {
  txt(slide, title, 74, 48, 1000, 54, {size:38,bold:true,color:C.cyan});
  if (subtitle) txt(slide, subtitle, 76, 106, 1000, 30, {size:18,color:C.muted});
  rect(slide, 74, 145, 106, 4, C.purple);
  txt(slide, "ScopeBot  |  IT briefing", 1022, 52, 180, 26, {size:14,color:C.muted,align:"right"});
}
function footer(slide, n) {
  rect(slide, 0, 694, W, 26, C.navy);
  txt(slide, "ข้อมูลจากโค้ดและคู่มือโปรเจค ScopeBot", 72, 697, 500, 18, {size:12,color:"#9CB7D8"});
  txt(slide, String(n).padStart(2,"0"), 1150, 697, 58, 18, {size:12,color:"#9CB7D8",align:"right"});
}
function note(slide, text) { slide.speakerNotes.textFrame.setText(text); }
function pill(slide, label, x, y, w, fill = C.purple) { rect(slide,x,y,w,34,fill,true); txt(slide,label,x,y+2,w,28,{size:15,bold:true,align:"center",color:C.bg}); }
function card(slide, title, body, x, y, w, h, accent=C.cyan) { rect(slide,x,y,w,h,C.soft,true,C.line); rect(slide,x,y,6,h,accent); txt(slide,title,x+24,y+20,w-42,31,{size:23,bold:true}); txt(slide,body,x+24,y+58,w-42,h-72,{size:17,color:C.muted,valign:"top"}); }

// 1 Cover
{ const s=p.slides.add(); s.background.fill=C.bg; rect(s,0,0,18,H,C.cyan); rect(s,18,0,8,H,C.purple); pill(s,"IT PRESENTATION",78,102,184,C.purple); txt(s,"ScopeBot",78,166,720,84,{size:66,bold:true,color:C.cyan}); txt(s,"แพลตฟอร์ม AI Chatbot\nสำหรับความรู้ภายในองค์กร",80,264,700,116,{size:36,bold:true}); txt(s,"เอกสารองค์กร  •  คำตอบด้วย RAG  •  ส่งต่อเจ้าหน้าที่",82,408,660,36,{size:20,color:C.muted});
  rect(s,875,115,258,258,C.soft,true,C.line); txt(s,"AI",920,147,170,74,{size:60,bold:true,color:C.purple,align:"center"}); txt(s,"Knowledge\nAssistant",903,236,202,70,{size:26,bold:true,align:"center",color:C.cyan}); rect(s,840,476,310,4,C.cyan); txt(s,"สรุปสำหรับฝ่ายเทคโนโลยีสารสนเทศ",80,615,670,30,{size:19,color:C.muted}); txt(s,"17 กันยายน 2569",880,615,270,30,{size:18,color:C.muted,align:"right"}); note(s,"Sources: Scopebot README.md; .env.example; user-supplied ScopeBot.pdf.pdf used only as visual reference."); }

// 2 Scope
{ const s=p.slides.add(); s.background.fill=C.bg; header(s,"ขอบเขตของ ScopeBot","ระบบตอบคำถามจากเอกสารองค์กร พร้อมช่องทางสนทนาและการส่งต่อเจ้าหน้าที่"); card(s,"Knowledge chatbot","สร้างบอทได้หลายตัว และผูกเอกสารความรู้ให้แต่ละบอท",76,196,340,190,C.cyan); card(s,"RAG pipeline","แยกข้อความจากเอกสาร สร้าง embedding ค้นหาส่วนที่เกี่ยวข้อง แล้วส่งบริบทให้โมเดล",470,196,340,190,C.purple); card(s,"Live support","ส่งต่อบทสนทนาให้เจ้าหน้าที่เมื่อผู้ใช้ขอความช่วยเหลือหรือบอทตอบไม่ได้",864,196,340,190,C.teal); rect(s,76,450,1128,138,C.soft,true,C.line); txt(s,"ช่องทางที่รองรับ",104,474,270,29,{size:23,bold:true,color:C.cyan}); txt(s,"Web chat",420,474,192,29,{size:22,bold:true}); txt(s,"LINE webhook",680,474,220,29,{size:22,bold:true}); txt(s,"Admin workspace",955,474,210,29,{size:22,bold:true}); txt(s,"ระบบมี dashboard, การจัดการบอท, เอกสาร, ผู้ใช้ และประวัติสนทนา",104,526,980,28,{size:18,color:C.muted}); footer(s,2); note(s,"Source: README.md Features and project structure; repository source under src/app, api, rag."); }

// 3 Architecture
{ const s=p.slides.add(); s.background.fill=C.bg; header(s,"สถาปัตยกรรมปัจจุบัน","องค์ประกอบที่ตรวจพบในโปรเจคและเส้นทางข้อมูลหลัก");
  const nodes=[ ["Web application","React + Vite\nTailwind CSS, shadcn/Radix UI",90,220,250,C.cyan], ["API service","FastAPI\nSQLAlchemy + Alembic",390,220,250,C.purple], ["RAG service","Ollama + BGE-M3\nChromaDB",690,220,250,C.teal], ["Data store","PostgreSQL\nบัญชี บอท เอกสาร ประวัติ",990,220,210,C.yellow] ];
  for (const [a,b,x,y,w,accent] of nodes){ card(s,a,b,x,y,w,150,accent); }
  txt(s,"Web chat และ LINE",90,422,250,26,{size:17,color:C.muted,align:"center"}); txt(s,"ตรวจสิทธิ์และประมวลผล",390,422,250,26,{size:17,color:C.muted,align:"center"}); txt(s,"ค้นหาเอกสารและสร้างคำตอบ",690,422,250,26,{size:17,color:C.muted,align:"center"}); txt(s,"บันทึกสถานะและประวัติ",990,422,210,44,{size:17,color:C.muted,align:"center"});
  rect(s,90,515,1110,76,C.navy,true); txt(s,"การเชื่อมต่อภายนอก: LINE ส่ง event เข้า webhook ของบอท และ Ollama ทำงานเป็น service แยกที่ API เข้าถึงได้",116,534,1060,33,{size:19,color:C.ink,align:"center"}); footer(s,3); note(s,"Sources: README.md Tech Stack and Docker deployment section; docker-compose.yml; .env.example."); }

// 4 RAG
{ const s=p.slides.add(); s.background.fill=C.bg; header(s,"การจัดการเอกสารและ RAG","ค่าเริ่มต้นปัจจุบันกำหนดให้ค้นหา 5 ส่วนของเอกสารต่อคำถาม");
  const steps=[ ["01","อัปโหลด","PDF, DOCX, TXT, CSV\nขนาดสูงสุด 10 MB"], ["02","แบ่งเนื้อหา","Chunk 1,000 ตัวอักษร\nซ้อนทับ 200 ตัวอักษร"], ["03","สร้างดัชนี","BGE-M3 สร้าง embedding\nเก็บใน ChromaDB"], ["04","ตอบคำถาม","ค้นหา Top K = 5\nส่งบริบทเข้า Ollama"] ];
  steps.forEach(([num,ti,bo],i)=>{ const x=78+i*285; rect(s,x,212,238,244,C.soft,true,C.line); txt(s,num,x+22,230,58,32,{size:21,bold:true,color:i%2?C.purple:C.cyan}); txt(s,ti,x+22,278,190,32,{size:24,bold:true}); txt(s,bo,x+22,334,192,76,{size:18,color:C.muted,valign:"top"}); });
  rect(s,104,520,1072,70,"#102C36",true); txt(s,"เมื่อมีเอกสารชื่อซ้ำ ระบบขอการยืนยันก่อนแทนที่ และประมวลผลใหม่ให้ทุกบอทที่ผูกกับเอกสารนั้น",132,538,1016,34,{size:18,color:"#D6FBFA",align:"center"}); footer(s,4); note(s,"Sources: .env.example values TOP_K=5, CHUNK_SIZE=1000, CHUNK_OVERLAP=200, EMBEDDING_MODEL=BAAI/bge-m3; api/routers/documents.py; README.md regression-test note."); }

// 5 Product operation
{ const s=p.slides.add(); s.background.fill=C.bg; header(s,"การใช้งานและการส่งต่อเจ้าหน้าที่","บอทตอบคำถามตามความรู้ที่กำหนด และส่งงานให้ทีม support เมื่อจำเป็น");
  card(s,"ผู้ใช้งาน","ถามคำถามผ่านหน้า web chat หรือ LINE",94,210,300,145,C.cyan); card(s,"ScopeBot","ตรวจสิทธิ์ ดึงบริบทจากเอกสาร และสร้างคำตอบ",488,210,300,145,C.purple); card(s,"เจ้าหน้าที่","รับช่วงสนทนาและให้คำตอบเพิ่มเติมใน live chat",882,210,300,145,C.teal);
  rect(s,94,410,1088,145,C.soft,true,C.line); txt(s,"ประวัติการสนทนา",124,436,300,29,{size:23,bold:true,color:C.cyan}); txt(s,"ระบบเก็บประวัติบอทและเจ้าหน้าที่ในบริบทเดียวกัน เพื่อให้เจ้าหน้าที่เห็นสิ่งที่ผู้ใช้ถามและคำตอบก่อนหน้า",124,482,1005,40,{size:19,color:C.muted}); footer(s,5); note(s,"Sources: README.md Features; api/routers/live_chat.py; api/chat_history.py; src/app/components/admin/SearchHistory.tsx."); }

// 6 Access and controls
{ const s=p.slides.add(); s.background.fill=C.bg; header(s,"สิทธิ์ผู้ใช้และการควบคุม","การเข้าถึงแยกตามบทบาท และระบบตรวจสถานะบัญชีในคำขอที่ต้องยืนยันตัวตน");
  card(s,"Admin","จัดการบอท เอกสาร ผู้ใช้ การอนุมัติ และ dashboard",86,208,340,174,C.purple); card(s,"Support","ดูและรับช่วงบทสนทนาที่ส่งต่อจากบอท",470,208,340,174,C.cyan); card(s,"User","ใช้งานบอทตามสิทธิ์ หลังผู้ดูแลอนุมัติบัญชี",854,208,340,174,C.teal);
  rect(s,86,454,1108,106,C.navy,true); txt(s,"Controls ที่ต้องตั้งค่าใน pilot",118,474,350,28,{size:20,bold:true,color:C.cyan}); txt(s,"SECRET_KEY เฉพาะสภาพแวดล้อมจริง   /   จำกัด CORS เฉพาะโดเมนที่ใช้   /   ปิด DEBUG ก่อนเปิดใช้งาน",118,514,1035,25,{size:17,color:C.muted,align:"center"}); footer(s,6); note(s,"Sources: README.md Features and production checklist; .env.example JWT/CORS/DEBUG settings; api/auth.py."); }

// 7 Deployment
{ const s=p.slides.add(); s.background.fill=C.bg; header(s,"แนวทางติดตั้งสำหรับ Pilot","โปรเจครองรับ Docker Compose และ Cloudflare Tunnel สำหรับโดเมน HTTPS");
  const deploy=[ ["1","เตรียม environment","PostgreSQL, Ollama, secrets และ URL ที่อนุญาต"], ["2","เริ่มบริการ","Frontend, API และ database ด้วย Docker Compose"], ["3","เปิดช่องทางภายนอก","ตั้ง HTTPS และ update LINE webhook หากใช้ LINE"], ["4","ทดสอบก่อนเปิดใช้","Smoke test, ทดสอบ reset password และ user approval"] ];
  deploy.forEach(([n,t,b],i)=>{const x=88+i*278; pill(s,n,x,210,42,i%2?C.purple:C.cyan); txt(s,t,x,265,230,52,{size:23,bold:true,align:"center"}); txt(s,b,x,340,230,88,{size:17,color:C.muted,align:"center",valign:"top"});});
  rect(s,94,518,1095,52,"#172030",true); txt(s,"ข้อจำกัดที่ต้องรับรู้: RAG ใช้ไม่ได้หาก API ติดต่อ Ollama ไม่ได้",112,530,1058,28,{size:18,bold:true,color:C.yellow,align:"center"}); footer(s,7); note(s,"Sources: README.md Deploy with Docker + Cloudflare Tunnel; Production checklist; .env.example OLLAMA_HOST."); }

// 8 Readiness
{ const s=p.slides.add(); s.background.fill=C.bg; header(s,"สิ่งที่ฝ่าย IT ควรกำหนดก่อนเริ่ม Pilot","รายการนี้อ้างอิงจากการตั้งค่าและขั้นตอน deploy ที่มีอยู่ในโปรเจค");
  card(s,"สภาพแวดล้อม","เลือกที่ตั้งของ PostgreSQL, Ollama และที่เก็บ backup ของฐานข้อมูล",84,210,520,150,C.cyan); card(s,"โดเมนและเครือข่าย","กำหนด HTTPS, CORS, firewall/VPN และ URL ของ frontend",676,210,520,150,C.purple); card(s,"บัญชีและผู้รับผิดชอบ","กำหนด admin, support, SMTP และขั้นตอนอนุมัติผู้ใช้",84,414,520,150,C.teal); card(s,"ชุดเอกสารเริ่มต้น","คัดเลือกเอกสารฉบับควบคุมเวอร์ชันสำหรับทดสอบความถูกต้องของคำตอบ",676,414,520,150,C.yellow); footer(s,8); note(s,"Sources: README.md Company pilot checklist and production checklist; .env.example."); }

// 9 closing
{ const s=p.slides.add(); s.background.fill=C.bg; rect(s,0,0,18,H,C.cyan); rect(s,18,0,8,H,C.purple); txt(s,"ScopeBot",80,124,710,72,{size:60,bold:true,color:C.cyan}); txt(s,"พร้อมสำหรับการประเมิน Pilot\nในสภาพแวดล้อมของบริษัท",82,238,790,116,{size:39,bold:true}); rect(s,82,419,720,4,C.purple); txt(s,"หัวข้อสำหรับการประชุมถัดไป",82,463,430,30,{size:23,bold:true,color:C.cyan}); txt(s,"ขอบเขตเอกสาร  •  สภาพแวดล้อมติดตั้ง  •  ผู้รับผิดชอบการทดสอบ",82,514,800,35,{size:20,color:C.muted}); pill(s,"Q&A",994,492,138,C.purple); txt(s,"ScopeBot IT Presentation",82,635,420,26,{size:16,color:C.muted}); note(s,"Sources: all content derived from Scopebot repository files and user-supplied PDF visual reference."); }

await fs.mkdir(TMP_DIR,{recursive:true});
const candidatePath = path.join(TMP_DIR,"scopebot_it_candidate.pptx");
await (await PresentationFile.exportPptx(p)).save(candidatePath);
const requirements = { explicitTotalSlideCount: 9, requiredNativeTableOwnerSlides: [], requiredNativeChartOwnerSlides: [] };
const result = await finalizePresentation({ ...requirements, workspaceDir, candidatePath, finalPath:FINAL_PPTX, pythonExecutable:RUNTIME_PYTHON, integrityValidatorPath:path.join(SKILL_DIR,"container_tools","inspect_presentation_package_integrity.py"), layoutValidatorPath:path.join(SKILL_DIR,"container_tools","inspect_presentation_layout_geometry.py"), layoutArgs:["--expected-slide-size-emu","12192000,6858000","--validate-bullet-geometry","--validate-heading-fit"], fontPolicy:{basis:"design",families:[FONT]}, verifyArtifactToolImport:true, receiptPath:path.join(TMP_DIR,"scopebot_it_validation.json") });
console.log(JSON.stringify(result));
