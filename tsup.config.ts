import { defineConfig } from "tsup";
import { readdirSync, statSync } from "fs";
import { join, relative } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function collectEntries(dir: string, base: string = dir): Record<string, string> {
  const entries: Record<string, string> = {};
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    if (statSync(fullPath).isDirectory()) {
      Object.assign(entries, collectEntries(fullPath, base));
    } else if (entry.endsWith(".ts") && !entry.startsWith("types")) {
      const rel = relative(base, fullPath).replace(/\.ts$/, "");
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
  bundle: false,
  clean: true,
  dts: false,
  silent: false,
  target: "node18",
  platform: "node",
  noExternal: [],
  sourcemap: true,
});
