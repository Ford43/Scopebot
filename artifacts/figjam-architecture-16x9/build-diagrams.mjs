import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const sharp = require('sharp');

const outDir = path.dirname(new URL(import.meta.url).pathname.replace(/^\/(.:)/, '$1'));
const W = 1600, H = 900;
const C = {
  bg: '#F7FAFC', ink: '#17233C', muted: '#5B6780', line: '#667085',
  channel: '#E8F3FF', channelStroke: '#2878C8', gateway: '#FFF3E3', gatewayStroke: '#DA7B12',
  app: '#EAF8EF', appStroke: '#26945A', data: '#F3ECFF', dataStroke: '#7856D8',
  ai: '#EEF0FF', aiStroke: '#5562D9', handoff: '#FFF0E8', handoffStroke: '#E66B1A',
  error: '#FFF0F0', errorStroke: '#D64545', white: '#FFFFFF'
};

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
function text(x, y, lines, size=28, weight=500, fill=C.ink, anchor='middle') {
  const arr = Array.isArray(lines) ? lines : [lines];
  const lineH = size * 1.25;
  return `<text x="${x}" y="${y - ((arr.length-1)*lineH/2)}" text-anchor="${anchor}" font-family="IBM Plex Sans Thai, Noto Sans Thai, Arial, sans-serif" font-size="${size}" font-weight="${weight}" fill="${fill}">${arr.map((l,i)=>`<tspan x="${x}" dy="${i?lineH:0}">${esc(l)}</tspan>`).join('')}</text>`;
}
function box(x,y,w,h,lines,fill,stroke,sub=null) {
  const mainY = sub ? y+h/2-12 : y+h/2+9;
  return `<g><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="18" fill="${fill}" stroke="${stroke}" stroke-width="3"/>${text(x+w/2,mainY,lines,25,600)}${sub?text(x+w/2,y+h/2+34,sub,18,400,C.muted):''}</g>`;
}
function panel(x,y,w,h,title,fill='#FFFFFF') {
  return `<g><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="24" fill="${fill}" stroke="#D9E0EA" stroke-width="2"/>${text(x+26,y+46,title,24,700,C.ink,'start')}</g>`;
}
function arrow(x1,y1,x2,y2,label='') {
  const midX=(x1+x2)/2, midY=(y1+y2)/2;
  return `<g><path d="M ${x1} ${y1} L ${x2} ${y2}" fill="none" stroke="${C.line}" stroke-width="4" marker-end="url(#arrow)"/>${label?`<rect x="${midX-62}" y="${midY-18}" width="124" height="28" rx="8" fill="${C.bg}"/>${text(midX,midY+4,label,16,500,C.muted)}`:''}</g>`;
}
function elbow(x1,y1,x2,y2,label='') {
  const mx=(x1+x2)/2;
  return `<g><path d="M ${x1} ${y1} H ${mx} V ${y2} H ${x2}" fill="none" stroke="${C.line}" stroke-width="4" marker-end="url(#arrow)"/>${label?text(mx,y1-12,label,16,500,C.muted):''}</g>`;
}
function route(points,label='',labelX=0,labelY=0,arrowEnd=true) {
  const d=points.map((p,i)=>`${i?'L':'M'} ${p[0]} ${p[1]}`).join(' ');
  return `<g><path d="${d}" fill="none" stroke="${C.line}" stroke-width="4" stroke-linejoin="round" ${arrowEnd?'marker-end="url(#arrow)"':''}/>${label?text(labelX,labelY,label,16,500,C.muted):''}</g>`;
}
function frame(title, subtitle, body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><defs><marker id="arrow" markerWidth="12" markerHeight="12" refX="10" refY="6" orient="auto"><path d="M0,0 L12,6 L0,12 Z" fill="${C.line}"/></marker></defs><rect width="1600" height="900" fill="${C.bg}"/>${text(70,72,title,42,700,C.ink,'start')}${text(70,113,subtitle,21,400,C.muted,'start')}<line x1="70" y1="142" x2="1530" y2="142" stroke="#D9E0EA" stroke-width="2"/>${body}</svg>`;
}

function system() {
  let s='';
  s+=panel(45,180,290,620,'1  Channel Layer');
  s+=panel(375,180,280,620,'2  Gateway Layer');
  s+=panel(695,180,350,620,'3  Application Layer');
  s+=panel(1085,180,470,620,'4  Data & AI Layer');
  s+=box(75,270,230,100,'Web Browser',C.channel,C.channelStroke);
  s+=box(75,430,230,100,'LINE OA',C.channel,C.channelStroke);
  s+=box(75,590,230,100,['Human','Support'],C.channel,C.channelStroke);
  s+=box(405,320,220,105,['Cloudflare','Tunnel'],C.gateway,C.gatewayStroke);
  s+=box(405,550,220,105,['Nginx','Reverse Proxy'],C.gateway,C.gatewayStroke);
  s+=box(730,300,280,120,['React + Vite','Frontend'],C.app,C.appStroke);
  s+=box(730,540,280,120,['FastAPI','Backend'],C.app,C.appStroke);
  s+=box(1265,235,250,85,'PostgreSQL',C.data,C.dataStroke);
  s+=box(1265,345,250,85,'Document Storage',C.data,C.dataStroke);
  s+=box(1265,455,250,85,'BGE-M3',C.ai,C.aiStroke);
  s+=box(1265,565,250,85,['ChromaDB','per bot_id'],C.data,C.dataStroke);
  s+=box(1265,675,250,85,'Ollama',C.ai,C.aiStroke);
  s+=box(1110,455,115,195,['Service','Calls'],C.app,C.appStroke);
  s+=arrow(305,320,405,360,'HTTPS'); s+=arrow(305,480,405,390,'Webhook'); s+=arrow(305,640,405,620,'Live Chat');
  s+=arrow(515,425,515,550); s+=arrow(625,360,730,350,'Static'); s+=arrow(625,610,730,600,'/api');
  s+=arrow(870,420,870,540,'JWT');
  s+=arrow(1010,600,1110,552);
  s+=route([[1225,485],[1240,485],[1240,278],[1265,278]]);
  s+=route([[1225,520],[1248,520],[1248,388],[1265,388]]);
  s+=arrow(1225,500,1265,498);
  s+=arrow(1225,607,1265,607);
  s+=route([[1225,625],[1248,625],[1248,718],[1265,718]]);
  return frame('ScopeBot System Architecture','ภาพรวมช่องทาง การรับส่งคำขอ Application และ Data/AI Services',s);
}

function frontend() {
  let s='';
  const xs=[45,420,795,1170];
  s+=panel(xs[0],180,335,610,'1  Users & Access'); s+=panel(xs[1],180,335,610,'2  Routes & Views');
  s+=panel(xs[2],180,335,610,'3  State & Hooks'); s+=panel(xs[3],180,385,610,'4  API Boundary');
  s+=box(80,270,265,105,['Admin • Support','User'],C.channel,C.channelStroke);
  s+=box(80,455,265,130,['Public Routes','Login • Signup','Reset Password'],C.channel,C.channelStroke);
  s+=box(80,640,265,105,['Protected Route','/chat'],C.channel,C.channelStroke);
  s+=box(455,250,265,110,['Chat • Bots','Documents'],C.app,C.appStroke);
  s+=box(455,425,265,110,['Dashboard','Administration'],C.app,C.appStroke);
  s+=box(455,600,265,110,['Unified Chat','Integration'],C.app,C.appStroke);
  s+=box(830,250,265,110,['AuthContext','AdminScopeContext'],C.ai,C.aiStroke);
  s+=box(830,425,265,110,['useChatSession','bot • waiting • human'],C.handoff,C.handoffStroke);
  s+=box(830,600,265,110,['Notifications','Waiting Queue'],C.ai,C.aiStroke);
  s+=box(1210,300,305,120,['API Client','JWT Token'],C.channel,C.channelStroke);
  s+=box(1210,550,305,140,['FastAPI Response','Answer • Sources','Session Mode'],C.app,C.appStroke);
  s+=arrow(345,320,455,300); s+=arrow(345,522,455,480); s+=arrow(345,690,455,655);
  s+=arrow(720,300,830,300); s+=arrow(720,480,830,480); s+=arrow(720,655,830,655);
  s+=arrow(1095,300,1210,350); s+=arrow(1095,480,1210,360); s+=arrow(1095,655,1210,620);
  s+=arrow(1362,420,1362,550,'JSON');
  return frame('ScopeBot Frontend Architecture','โครงสร้างหน้าจอ State Management และการเชื่อมต่อ Backend',s);
}

function backend() {
  let s='';
  const xs=[45,410,775,1140];
  s+=panel(xs[0],180,325,610,'1  Request Entry'); s+=panel(xs[1],180,325,610,'2  Security Layer');
  s+=panel(xs[2],180,325,610,'3  API Groups'); s+=panel(xs[3],180,415,610,'4  Services & Data');
  s+=box(80,280,255,110,['React Frontend','HTTPS / JSON'],C.channel,C.channelStroke);
  s+=box(80,500,255,110,['LINE Platform','Webhook'],C.channel,C.channelStroke);
  s+=box(445,250,255,110,['CORS + JWT','Authentication'],C.gateway,C.gatewayStroke);
  s+=box(445,425,255,110,['RBAC + Ownership','Authorization'],C.gateway,C.gatewayStroke);
  s+=box(445,600,255,110,['LINE Signature','Verification'],C.gateway,C.gatewayStroke);
  s+=box(810,250,255,110,['Identity APIs','Auth • Users'],C.app,C.appStroke);
  s+=box(810,425,255,110,['Business APIs','Bots • Docs • Chat'],C.app,C.appStroke);
  s+=box(810,600,255,110,['Operations APIs','Dashboard • Audit'],C.app,C.appStroke);
  s+=box(1175,250,345,90,['PostgreSQL','Accounts • Bots • Audit'],C.data,C.dataStroke);
  s+=box(1175,400,345,90,['RAG Pipeline','Retrieve + Generate'],C.ai,C.aiStroke);
  s+=box(1175,535,345,90,['Document Storage','Original Files'],C.data,C.dataStroke);
  s+=box(1175,670,345,90,['LINE Reply / Live Chat','Human Handoff'],C.handoff,C.handoffStroke);
  s+=arrow(335,335,445,300); s+=arrow(335,555,445,655);
  s+=arrow(572,360,572,425); s+=arrow(700,305,810,305); s+=arrow(700,480,810,480); s+=arrow(700,655,810,655);
  s+=arrow(1065,305,1175,295);
  s+=arrow(1065,460,1175,445);
  s+=route([[1065,500],[1120,500],[1120,580],[1175,580]]);
  s+=route([[1065,655],[1120,655],[1120,715],[1175,715]],'Staff reply',1115,645);
  return frame('ScopeBot Backend Architecture','เส้นทาง Request ผ่าน Security, API Modules, RAG และ Data Services',s);
}

function rag() {
  let s='';
  s+=panel(45,180,1510,265,'A  Knowledge Ingestion',C.white);
  s+=box(80,270,260,105,['Upload Document','PDF • DOCX • TXT • CSV'],C.app,C.appStroke);
  s+=box(420,270,260,105,['Load + Chunk','1000 / overlap 200'],C.app,C.appStroke);
  s+=box(760,270,260,105,['BGE-M3','Embedding'],C.ai,C.aiStroke);
  s+=box(1100,270,390,105,['ChromaDB','Knowledge Index per bot_id'],C.data,C.dataStroke);
  s+=arrow(340,322,420,322); s+=arrow(680,322,760,322); s+=arrow(1020,322,1100,322);
  s+=panel(45,485,1510,330,'B  Question Answering',C.white);
  s+=box(75,590,240,110,['Question +','Recent History'],C.channel,C.channelStroke);
  s+=box(365,590,240,110,['Similarity Search','TOP_K 5'],C.ai,C.aiStroke);
  s+=box(655,590,240,110,['Prompt +','Relevant Context'],C.ai,C.aiStroke);
  s+=box(945,590,240,110,['Ollama LLM','Generate Answer'],C.ai,C.aiStroke);
  s+=box(1235,535,275,105,['Answer + Sources','Web / LINE'],C.app,C.appStroke);
  s+=box(1235,690,275,85,['No Answer','Human Handoff'],C.handoff,C.handoffStroke);
  s+=arrow(315,645,365,645); s+=arrow(605,645,655,645); s+=arrow(895,645,945,645);
  s+=arrow(1185,625,1235,585); s+=arrow(1185,675,1235,730);
  s+=`<g><path d="M 1295 375 V 465 H 485 V 590" fill="none" stroke="${C.line}" stroke-width="4" marker-end="url(#arrow)"/>${text(890,457,'Search Knowledge Index',17,500,C.muted)}</g>`;
  return frame('ScopeBot RAG Flow','แยกกระบวนการสร้าง Knowledge Index และการตอบคำถามเป็นสองเลน',s);
}

const files = [
  ['scopebot-system-architecture-16x9', system()],
  ['scopebot-frontend-architecture-16x9', frontend()],
  ['scopebot-backend-architecture-16x9', backend()],
  ['scopebot-rag-flow-16x9', rag()]
];
for (const [name,svg] of files) {
  const svgPath=path.join(outDir,`${name}.svg`), pngPath=path.join(outDir,`${name}.png`);
  fs.writeFileSync(svgPath,svg,'utf8');
  await sharp(Buffer.from(svg)).png().toFile(pngPath);
}
console.log(JSON.stringify(files.map(([name])=>({name,svg:`${name}.svg`,png:`${name}.png`})),null,2));
