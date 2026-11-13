import { build } from "esbuild";
import { writeFile, unlink } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import assert from "node:assert/strict";

// Supply page state without network effects; inspect the real components' JSX.
const result = await build({
  stdin: { contents: `export {default as History} from './src/app/components/admin/SearchHistory';
    export {default as Users} from './src/app/components/admin/UserManagement';
    export {default as Bots} from './src/app/components/chat/BotsPage';
    export {default as Form} from './src/app/components/bots/BotForm';`, resolveDir: process.cwd() },
  bundle: true, platform: "node", format: "esm", packages: "external", jsx: "automatic", write: false,
  plugins: [{ name: "page-state", setup(b) {
    b.onResolve({ filter: /^real-react$/ }, () => ({path: "react", external: true}));
    b.onResolve({ filter: /^react$|contexts\/(AuthContext|AdminScopeContext)$/ }, a => ({ path: a.path, namespace: "state" }));
    b.onLoad({ filter: /.*/, namespace: "state" }, a => ({ contents: a.path === "react" ? `
      export * from "real-react";
      export function useState(initial) { const s=globalThis.__managementState, i=s.index++; if(!(i in s.values)) s.values[i]=initial; return [s.values[i], v=>s.values[i]=v]; }
      export const useEffect=()=>{}, useRef=v=>({current:v}), useCallback=f=>f;
    ` : a.path.endsWith("AuthContext") ? `export const useAuth=()=>({user:globalThis.__managementUser});` : `export const useAdminScope=()=>({scopeParam:'all'});` }));
  } }],
});
const file = new URL(`./.management-${randomUUID()}.mjs`, import.meta.url);
await writeFile(file, result.outputFiles[0].text);
const pages = await import(file.href);
await unlink(file);
function render(page, values, props = {}) {
  globalThis.__managementState = { index: 0, values };
  globalThis.__managementUser = { id: 1, role: "admin", max_bots: 0 };
  return pages[page](props);
}
function nodes(tree) {
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  if (!tree || typeof tree !== "object") return [];
  return [tree, ...nodes(tree.props?.children)];
}
function text(tree) {
  if (Array.isArray(tree)) return tree.map(text).join("");
  if (tree == null || typeof tree === "boolean") return "";
  return typeof tree === "object" ? text(tree.props?.children) : String(tree);
}
const user = { id: 2, username: "Owner", email: "owner@example.test", role: "user", is_active: true, is_approved: true, max_bots: 0, bot_count: 1, created_at: "2026-11-10T01:00:00Z" };
test("zero quota is displayed and preserved when opening user editor", () => {
  const tree = render("Users", { 0: [user], 1: false });
  assert.ok(text(tree).includes("1/0"));
  const edit = nodes(tree).find(n => n.props?.onClick && text(n).includes("1/0"));
  assert.ok(edit);
  edit.props.onClick();
  assert.equal(globalThis.__managementState.values[8].max_bots, 0);
});
test("zero quota disables bot creation even when no bots exist", () => {
  const tree = render("Bots", { 7: false });
  const buttons = nodes(tree).filter(n => n.type === "button" && text(n).includes("สร้างบอท"));
  assert.ok(buttons.length > 0);
  assert.ok(buttons.every(n => n.props.disabled));
});
test("history renders timestamps for every timeline message", () => {
  const timeline = ["user", "bot", "staff"].map((sender, i) => ({ id: String(i), sender, text: sender, created_at: `2026-11-10T01:00:0${i}Z` }));
  const session = { session_id: "s", bot_id: "b", bot_name: "Bot", title: "test", source_channel: "web", last_at: timeline[2].created_at, msg_count: 1, answered_count: 1, messages: [], timeline };
  const tree = render("History", { 2: [session], 5: "b:s" });
  const times = nodes(tree).filter(n => n.type === "time");
  assert.deepEqual(times.map(n => n.props.dateTime), timeline.map(m => m.created_at));
  assert.ok(times.every(n => /\d{2}:\d{2}:\d{2}/.test(text(n))));
});
for (const status of ["queued", "processing", "error", "ready"]) {
  test(`document readiness reflects knowledge update ${status}`, () => {
    const existing = { bot_id: "b", name: "Bot", status: "active", knowledge_update_status: status };
    const tree = render("Form", { 1: "knowledge", 7: [{ id: 1, filename: "new.txt", file_size: 10, category: "ทั่วไป" }] }, { existing });
    const row = nodes(tree).find(n => n.key === "1" && text(n).includes("new.txt"));
    assert.ok(row);
    const badge = nodes(row).find(n => n.type?.name === "BotStatusBadge");
    assert.ok(badge);
    assert.equal(badge.props.status, status === "queued" ? "processing" : status);
  });
}


