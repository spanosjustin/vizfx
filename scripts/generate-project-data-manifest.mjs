#!/usr/bin/env node
/**
 * Writes project-data/manifest.json listing every file under project-data/
 * (recursive), except manifest.json itself. Run after adding/removing samples:
 *
 *   node scripts/generate-project-data-manifest.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_DATA_DIR = path.join(__dirname, "..", "project-data");
const MANIFEST_REL = "manifest.json";
/** Not app export JSON — excluded so the Folder list stays loadable samples only. */
const TIPS_BASENAME = "tips.json";

function collectRelativeFiles(dir, relPrefix) {
  const out = [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = relPrefix ? `${relPrefix}/${ent.name}` : ent.name;
    const abs = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (!ent.name.startsWith(".")) {
        out.push(...collectRelativeFiles(abs, rel));
      }
    } else if (
      rel !== MANIFEST_REL &&
      !ent.name.startsWith(".") &&
      ent.name !== TIPS_BASENAME
    ) {
      out.push(rel.replace(/\\/g, "/"));
    }
  }
  return out;
}

const files = collectRelativeFiles(PROJECT_DATA_DIR, "");
files.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));

const outPath = path.join(PROJECT_DATA_DIR, MANIFEST_REL);
fs.writeFileSync(outPath, `${JSON.stringify({ files }, null, 2)}\n`, "utf8");
console.log(`Wrote ${files.length} entries to ${outPath}`);
