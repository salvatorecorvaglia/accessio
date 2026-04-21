/**
 * tsup build configuration for accessio.
 *
 * Replaces the fragile regex-based scripts/build-cjs.js.
 * Produces a CJS version of every source file in src/, maintaining
 * the same directory structure so package.json exports still resolve.
 *
 * Usage:
 *   npm run build          → builds all src files to cjs/
 *   npm run build:cjs      → same as above (alias)
 */

import { defineConfig } from "tsup";
import { readdirSync, statSync } from "fs";
import { join, relative } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Collect all .js files under a directory recursively.
 * @param {string} dir
 * @param {string} [base]
 * @returns {Record<string, string>} tsup entry object { outputName: absoluteFilePath }
 */
function collectEntries(dir, base = dir) {
  const entries = {};
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    if (statSync(fullPath).isDirectory()) {
      Object.assign(entries, collectEntries(fullPath, base));
    } else if (entry.endsWith(".js")) {
      // Use the relative path (without extension) as the output name
      const rel = relative(base, fullPath).replace(/\.js$/, "");
      entries[rel] = fullPath;
    }
  }
  return entries;
}

const srcDir = join(__dirname, "src");

export default defineConfig({
  entry: collectEntries(srcDir),
  format: ["cjs"],
  outDir: "cjs",
  outExtension: () => ({ js: ".cjs" }),
  // No bundling — each source file becomes a separate CJS file,
  // preserving the same structure so intra-package imports resolve correctly.
  bundle: false,
  clean: true,
  // We maintain a hand-crafted index.d.ts — no auto dts generation needed.
  dts: false,
  // Keep console.log calls (used in debug helper)
  silent: false,
});
