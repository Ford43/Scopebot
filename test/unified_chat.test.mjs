import { build } from "esbuild";
import { writeFile, unlink } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import assert from "node:assert/strict";

// Render the actual component with a controlled hook scheduler and network boundary.
const result = await build({
  entryPoints: ["src/app/components/admin/UnifiedChat.tsx"], bundle: true,
  platform: "node", format: "esm", packages: "external", jsx: "automatic", write: false,
  plugins: [{ name: "boundaries", setup(b) {
    b.onResolve({ filter: /^react$|lib\/api$|contexts\/AdminScopeContext$/ }, a => ({ path: a.path, namespace: "mock" }));
    b.onLoad({ filter: /.*/, namespace: "mock" }, a => ({ contents: a.path === "react" ? `
      let states=[], refs=[], effects=[], s=0, r=0, e=0, pending=[];
      globalThis.__unified={begin(){s=r=e=0;},flush(){pending.splice(0).forEach(f=>f());},reset(){effects.forEach(x=>x?.cleanup?.());states=[];refs=[];effects=[];pending=[];}};
      export function useState(v){const i=s++;if(!(i in states))states[i]=v;return [states[i],v=>states[i]=typeof v==='function'?v(states[i]):v];}
      export function useRef(v){return refs[r++]??={current:v};}
      export function useEffect(f,deps){const i=e++,prev=effects[i];if(!prev||deps.some((d,j)=>d!==prev.deps[j]))pending.push(()=>{prev?.cleanup?.();effects[i]={deps,cleanup:f()};});}
    ` : a.path.endsWith("api") ? "export const authHeaders=()=>({});" : "export const useAdminScope=()=>({scopeParam:'all'});" }));
  } }],
});
const file = new URL(`./.unified-${randomUUID()}.mjs`, import.meta.url);
await writeFile(file, result.outputFiles[0].text);
const { default: UnifiedChat } = await import(file.href);
await unlink(file);
function nodes(tree) {
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  return tree && typeof tree === "object" ? [tree, ...nodes(tree.props?.children)] : [];
}
function render() { globalThis.__unified.begin(); const tree=UnifiedChat(); globalThis.__unified.flush(); return tree; }
const settle = () => new Promise(resolve => setImmediate(resolve));
const input = () => nodes(render()).find(n => n.type === "textarea");
const select = id => nodes(render()).find(n => n.key === id).props.onClick();
const type = value => input().props.onChange({target:{value}});
const enter = () => input().props.onKeyDown({key:"Enter",shiftKey:false,preventDefault(){}});
async function isolated(fn) {
  const originalFetch=globalThis.fetch, interval=globalThis.setInterval;
  const requests=[];
  globalThis.__unifiedIntervals=[];
  globalThis.setInterval=f=>globalThis.__unifiedIntervals.push(f);
  globalThis.fetch=async (url, init) => {
    if (init?.method === "POST") return new Promise(resolve=>requests.push({url,body:init.body ? JSON.parse(init.body) : undefined,resolve}));
    return {ok:true,json:async()=>url.includes("?scope=") ? ["Alice","Bob"].map(id=>({id,line_display_name:id,mode:"human",bot_id:"bot",started_at:"2026-11-13T00:00:00Z"})) : {messages:[]}};
  };
  try { render(); await settle(); await fn(requests); }
  finally { globalThis.__unified.reset(); globalThis.fetch=originalFetch;globalThis.setInterval=interval; }
}
test("switching customer keeps drafts with their recipient and Enter cannot send another customer's draft", () => isolated(async requests => {
  select("Alice"); type("Private Alice reply");
  select("Bob"); enter(); await settle();
  assert.equal(requests.length,0,"Alice's draft must never be posted to Bob");
  assert.equal(input().props.value,"");
  type("Bob reply"); select("Alice");
  assert.equal(input().props.value,"Private Alice reply");
  enter(); await settle();
  assert.equal(requests[0].url,"/api/live/sessions/Alice/reply");
  assert.deepEqual(requests[0].body,{message:"Private Alice reply"});
  requests[0].resolve({ok:true}); await settle();
  select("Bob"); assert.equal(input().props.value,"Bob reply");
}));
test("an in-flight Alice reply cannot clear Bob's draft", () => isolated(async requests => {
  select("Alice"); type("Alice reply"); enter(); await settle();
  select("Bob"); type("Unsent Bob reply");
  requests[0].resolve({ok:true}); await settle();
  assert.equal(input().props.value,"Unsent Bob reply");
  enter(); await settle();
  assert.equal(requests[1].url,"/api/live/sessions/Bob/reply");
  assert.deepEqual(requests[1].body,{message:"Unsent Bob reply"});
  requests[1].resolve({ok:true}); await settle();
}));

const visibleMessages = () => nodes(render()).filter(n => n.props?.className?.includes('whitespace-pre-line')).map(n => n.props.children);
const response = message => ({ok:true,json:async()=>({messages:[{id:message,message,sender_type:'customer',created_at:'2026-11-13T00:00:00Z'}]})});
async function deferredMessages(fn) {
  return isolated(async posts => {
    const base=globalThis.fetch, gets=[];
    globalThis.fetch=(url,init)=>!init?.method && !url.includes('?scope=') ? new Promise(resolve=>gets.push({url,resolve})) : base(url,init);
    await fn(gets,posts);
  });
}
test('late history for Alice never replaces Bob messages',()=>deferredMessages(async gets=>{
  select('Alice');render(); select('Bob');render();
  gets[1].resolve(response('Bob message'));await settle();
  gets[0].resolve(response('Alice private message'));await settle();
  assert.deepEqual(visibleMessages(),['Bob message']);
}));
test('selecting a new customer clears the previous transcript immediately',()=>deferredMessages(async gets=>{
  select('Alice');render();gets[0].resolve(response('Alice private message'));await settle();
  assert.deepEqual(visibleMessages(),['Alice private message']);
  select('Bob');assert.deepEqual(visibleMessages(),[]);
}));
test('late reply refresh cannot overwrite the selected customer',()=>deferredMessages(async (gets,posts)=>{
  select('Alice');type('reply');enter();await settle();
  posts[0].resolve({ok:true});await settle();
  select('Bob');render();gets.at(-1).resolve(response('Bob message'));await settle();
  gets[1].resolve(response('Alice reply'));await settle();
  assert.deepEqual(visibleMessages(),['Bob message']);
}));
test('late end completion preserves the newly selected customer',()=>deferredMessages(async (gets,posts)=>{
  const previous=globalThis.window;globalThis.window={confirm:()=>true};
  try {
    select('Alice');
    const button=nodes(render()).find(n=>n.type==='button' && nodes(n).some(c=>c.props?.children==='จบ'));
    button.props.onClick();await settle();select('Bob');render();
    posts[0].resolve({ok:true});await settle();
    assert.ok(input(),'Bob must remain selected');
  } finally {globalThis.window=previous;}
}));

test('reply completion re-enables sending after revisiting its customer',()=>isolated(async posts=>{
 select('Alice');type('first');enter();await settle();select('Bob');select('Alice');
 posts[0].resolve({ok:true});await settle();type('second');
 const send=nodes(render()).find(n=>n.type==='button' && n.props.className?.includes('w-10 h-10'));
 assert.equal(send.props.disabled,false);
}));
test('clicking the selected customer retains its loaded transcript',()=>deferredMessages(async gets=>{
 select('Alice');render();gets[0].resolve(response('Alice message'));await settle();
 select('Alice');assert.deepEqual(visibleMessages(),['Alice message']);
}));

test('slow overlapping polls show completed history without waiting for the latest request',()=>deferredMessages(async gets=>{
 select('Alice');render();globalThis.__unifiedIntervals[1]();
 gets[0].resolve(response('first history'));await settle();
 assert.deepEqual(visibleMessages(),['first history']);
 gets[1].resolve(response('newer history'));await settle();
 assert.deepEqual(visibleMessages(),['newer history']);
}));
test('older poll cannot overwrite a newer completed history',()=>deferredMessages(async gets=>{
 select('Alice');render();globalThis.__unifiedIntervals[1]();
 gets[1].resolve(response('newer history'));await settle();
 gets[0].resolve(response('old history'));await settle();
 assert.deepEqual(visibleMessages(),['newer history']);
}));
