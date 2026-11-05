import { test } from "node:test";
import assert from "node:assert/strict";
import { uploadDocument } from "../src/app/lib/documents";
import { resetUserPassword } from "../src/app/lib/users";

test("admin password reset validates confirmation and submits only the new password", async () => {
  const originalFetch = globalThis.fetch;
  const originalStorage = globalThis.localStorage;
  globalThis.localStorage = { getItem: () => null } as Storage;
  const requests: [unknown, RequestInit | undefined][] = [];
  globalThis.fetch = async (url, init) => {
    requests.push([url, init]);
    return Response.json({ message: "ok" });
  };
  try {
    await assert.rejects(resetUserPassword(42, "short", "short"), /6/);
    await assert.rejects(resetUserPassword(42, "new-password", "different"), /ไม่ตรงกัน/);
    assert.equal(requests.length, 0);
    await resetUserPassword(42, "new-password", "new-password");
    assert.equal(requests.length, 1);
    assert.equal(requests[0][0], "/api/auth/users/42/reset-password");
    assert.equal(requests[0][1]?.method, "PATCH");
    assert.deepEqual(JSON.parse(requests[0][1]?.body as string), { new_password: "new-password" });
  } finally {
    globalThis.fetch = originalFetch;
    globalThis.localStorage = originalStorage;
  }
});

test("duplicate upload retries only after approval and includes replacement flag", async () => {
  const originalFetch = globalThis.fetch;
  const originalStorage = globalThis.localStorage;
  globalThis.localStorage = { getItem: () => null } as Storage;
  const submitted: FormData[] = [];
  globalThis.fetch = async (_url, init) => {
    submitted.push(init!.body as FormData);
    return submitted.length === 1
      ? Response.json({ detail: { code: "document_exists", message: "Already exists", assigned_bots: ["HR", "Sales"] } }, { status: 409 })
      : Response.json({ id: 7, filename: "policy.txt", file_size: 3 });
  };
  try {
    const result = await uploadDocument(new File(["new"], "policy.txt"), "test", async (filename, bots) => {
      assert.equal(filename, "policy.txt");
      assert.deepEqual(bots, ["HR", "Sales"]);
      return true;
    });
    assert.equal(result?.id, 7);
    assert.equal(submitted.length, 2);
    assert.equal(submitted[0].get("replace_existing"), "false");
    assert.equal(submitted[1].get("replace_existing"), "true");
  } finally {
    globalThis.fetch = originalFetch;
    globalThis.localStorage = originalStorage;
  }
});

test("canceling replacement does not upload again", async () => {
  const originalFetch = globalThis.fetch;
  const originalStorage = globalThis.localStorage;
  globalThis.localStorage = { getItem: () => null } as Storage;
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return Response.json({ detail: { code: "document_exists", message: "Already exists", assigned_bots: [] } }, { status: 409 });
  };
  try {
    const result = await uploadDocument(new File(["new"], "policy.txt"), "test", () => false);
    assert.equal(result, null);
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = originalFetch;
    globalThis.localStorage = originalStorage;
  }
});
