import fs from "node:fs/promises";
import path from "node:path";
import { FileBlob, PresentationFile } from "@oai/artifact-tool";

const root = "C:\\Users\\keror\\Documents\\GitHub\\Scopebot";
const pptx = path.join(root, "deliverables", "ScopeBot_IT_Presentation_2026.pptx");
const out = path.join(root, ".pptx-build", "rendered");
await fs.mkdir(out, { recursive: true });
const presentation = await PresentationFile.importPptx(await FileBlob.load(pptx));
console.log(`slides=${presentation.slides.items.length}`);
for (let i = 0; i < presentation.slides.items.length; i++) {
  const slide = presentation.slides.items[i];
  const blob = await presentation.export({ slide, format: "png", scale: 1 });
  await fs.writeFile(path.join(out, `slide-${String(i + 1).padStart(2, "0")}.png`), new Uint8Array(await blob.arrayBuffer()));
  console.log(`rendered=${i + 1}`);
}
const montage = await presentation.export({ format: "webp", montage: true, scale: 1 });
await fs.writeFile(path.join(out, "montage.webp"), new Uint8Array(await montage.arrayBuffer()));
