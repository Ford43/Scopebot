// Run TypeScript regression tests with the project's existing esbuild dependency.
import { build } from "esbuild";
import { fileURLToPath } from "node:url";
import { writeFile, unlink } from "node:fs/promises";
import { randomUUID } from "node:crypto";
const result = await build({
  entryPoints: [fileURLToPath(new URL("./review_frontend.test.ts", import.meta.url))],
  bundle: true, platform: "node", format: "esm", packages: "external", write: false,
});
const output = new URL(`./.frontend-${randomUUID()}.mjs`, import.meta.url);
await writeFile(output, result.outputFiles[0].text, { flag: "wx" });
try {
  await import(output.href);
} finally {
  await unlink(output);
}
