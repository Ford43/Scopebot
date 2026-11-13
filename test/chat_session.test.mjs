// Controlled-network hook tests use a small scheduler instead of a DOM dependency.
import { build } from "esbuild";
import { writeFile, unlink } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import assert from "node:assert/strict";
const mockReact = `let state=[],refs=[],effects=[],callbacks=[],s=0,r=0,e=0,c=0,pending=[];
globalThis.__chatHook={reset(){effects.forEach(x=>x?.cleanup?.());state=[];refs=[];effects=[];callbacks=[];pending=[];},begin(){s=0;r=0;e=0;c=0;},flush(){pending.splice(0).forEach(f=>f());}};
export function useState(v){let i=s++;if(!(i in state))state[i]=v;return[state[i],v=>state[i]=typeof v==='function'?v(state[i]):v];}
export function useRef(v){let i=r++;return refs[i]??={current:v};}
export function useCallback(f,deps){let i=c++,prev=callbacks[i];if(!prev||deps.some((d,j)=>d!==prev.deps[j]))callbacks[i]={deps,f};return callbacks[i].f;}
export function useEffect(f,deps){let i=e++,prev=effects[i];if(!prev||deps?.some((d,j)=>d!==prev.deps?.[j])||!deps)pending.push(()=>{prev?.cleanup?.();effects[i]={deps,cleanup:f()};});}`;
const result = await build({ entryPoints: [fileURLToPath(new URL("../src/app/hooks/useChatSession.ts", import.meta.url))], bundle: true, platform: "node", format: "esm", write: false, plugins: [{ name: "boundaries", setup(b) {
  b.onResolve({ filter: /^(react|sonner)$|lib\/api$/ }, (a) => ({ path: a.path, namespace: "mock" }));
  b.onLoad({ filter: /.*/, namespace: "mock" }, (a) => ({ contents: a.path === "react" ? mockReact : a.path === "sonner" ? "export const toast={error:()=>{},info:(message)=>{globalThis.__chatNotice=message;}}" : "export const authHeaders=()=>({})" }));
} }] });
const file = new URL(`./.chat-hook-${randomUUID()}.mjs`, import.meta.url);
await writeFile(file, result.outputFiles[0].text);
const { useChatSession } = await import(file.href);
await unlink(file);
function render(bot = "A", active = false) {
  globalThis.__chatHook.begin();
  const hook = useChatSession({ activeBot: bots[bot] ??= { bot_id: bot }, isAuthenticated: false, isChatActive: active });
  globalThis.__chatHook.flush();
  return hook;
}
const bots = {};
const ok = (answer = "old answer") => ({ ok: true, json: async () => ({ answer, session_mode: "bot" }) });
async function isolated(fn) {
  const fetch = globalThis.fetch;
  try {
    globalThis.__chatHook.reset();
    await fn();
  } finally {
    globalThis.__chatHook.reset();
    globalThis.fetch = fetch;
  }
}
for (const change of ["bot", "new", "restore"]) test(`late answer is discarded after ${change}`, () => isolated(async () => {
  let finish, signal;
  globalThis.fetch = (_url, init) => {
    signal = init?.signal;
    return new Promise((r) => finish = r);
  };
  let hook = render();
  const pending = hook.handleSend("question");
  if (change === "bot") hook.resetSessionForBot();
  else if (change === "new") hook.handleNewChat();
  else hook.restoreSession({ sessionId: "restored", messages: [] });
  const bot = change === "bot" ? "B" : "A";
  hook = render(bot);
  finish(ok());
  await pending;
  hook = render(bot);
  assert.deepEqual(hook.messages, []);
  assert.equal(hook.isTyping, false);
  assert.equal(signal?.aborted, true);
}));
test("late failure cannot clear the typing state of a newer request", () => isolated(async () => {
  const requests = [];
  globalThis.fetch = () => new Promise((resolve, reject) => requests.push({ resolve, reject }));
  let hook = render();
  const first = hook.handleSend("first");
  hook.handleNewChat();
  hook = render();
  const second = hook.handleSend("second");
  requests[0].reject(new Error("old failure"));
  await first;
  hook = render();
  assert.equal(hook.isTyping, true);
  assert(!hook.messages.some((m) => m.category === "Error"));
  requests[1].resolve(ok("new answer"));
  await second;
  hook = render();
  assert.equal(hook.isTyping, false);
  assert.equal(hook.messages.at(-1).text, "new answer");
}));
test("late staff poll cannot populate a new conversation", () => isolated(async () => {
  let finish;
  globalThis.fetch = () => new Promise((r) => finish = r);
  let hook = render("A", true);
  hook.handleNewChat();
  finish({ ok: true, json: async () => ({ mode: "human", is_active: true, messages: [{ id: "1", message: "old staff", created_at: (/* @__PURE__ */ new Date()).toISOString() }] }) });
  await new Promise((r) => setImmediate(r));
  hook = render("A", true);
  assert.deepEqual(hook.messages, []);
  assert.equal(hook.chatMode, "bot");
}));
test("a slow chat keeps the original request and accepts its eventual answer without duplicate sends", () => isolated(async () => {
  const originalSetTimeout = globalThis.setTimeout, originalClearTimeout = globalThis.clearTimeout;
  let timeout, finish, signal, requests = 0;
  globalThis.setTimeout = (fn) => { timeout = fn; return 123; };
  globalThis.clearTimeout = () => {};
  try {
    globalThis.fetch = (_url, init) => {
      requests++;
      signal = init.signal;
      return new Promise(resolve => { finish = resolve; });
    };
    let hook = render();
    const pending = hook.handleSend("question");
    timeout();
    assert.equal(signal.aborted, false);
    assert.match(globalThis.__chatNotice, /ประมวลผล/);
    hook = render();
    assert.equal(hook.isTyping, true);
    await hook.handleSend("question");
    assert.equal(requests, 1);
    finish(ok("late answer"));
    await pending;
    hook = render();
    assert.equal(hook.isTyping, false);
    assert.deepEqual(hook.messages.map(m => m.text), ["question", "late answer"]);
  } finally {
    globalThis.setTimeout = originalSetTimeout;
    globalThis.clearTimeout = originalClearTimeout;
  }
}));
test("unmount aborts a slow request and clears its waiting notice", () => isolated(async () => {
  const originalSetTimeout = globalThis.setTimeout, originalClearTimeout = globalThis.clearTimeout;
  let signal, cleared = false;
  globalThis.setTimeout = () => 123;
  globalThis.clearTimeout = id => { if (id === 123) cleared = true; };
  try {
    globalThis.fetch = (_url, init) => {
      signal = init.signal;
      return new Promise((_, reject) => signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError"))));
    };
    const pending = render().handleSend("question");
    globalThis.__chatHook.reset();
    await pending;
    assert.equal(signal.aborted, true);
    assert.equal(cleared, true);
  } finally {
    globalThis.setTimeout = originalSetTimeout;
    globalThis.clearTimeout = originalClearTimeout;
  }
}));
test("a stalled old poll does not prevent a new session receiving staff replies", () => isolated(async () => {
  const originalInterval = globalThis.setInterval;
  const originalClear = globalThis.clearInterval;
  const requests = [];
  let tick;
  globalThis.setInterval = (fn) => { tick = fn; return 123; };
  globalThis.clearInterval = () => {};
  globalThis.fetch = (url) => new Promise(resolve => requests.push({ url, resolve }));
  try {
    let hook = render("A", true);
    hook.restoreSession({ sessionId: "new-session", messages: [] });
    hook = render("A", true);
    const poll = tick();
    assert.equal(requests.length, 2);
    assert.match(requests[1].url, /new-session/);
    requests[1].resolve({ ok: true, json: async () => ({ mode: "human", is_active: true,
      messages: [{ id: "new", message: "new staff reply", created_at: new Date().toISOString() }] }) });
    await poll;
    hook = render("A", true);
    assert(hook.messages.some(m => m.text === "new staff reply"));
  } finally {
    globalThis.__chatHook.reset();
    globalThis.setInterval = originalInterval;
    globalThis.clearInterval = originalClear;
  }
}));
