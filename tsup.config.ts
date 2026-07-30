import { readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'tsup';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function collectEntries(dir: string, base: string = dir): Record<string, string> {
  const entries: Record<string, string> = {};
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    if (statSync(fullPath).isDirectory()) {
      Object.assign(entries, collectEntries(fullPath, base));
    } else if (entry.endsWith('.ts') && !entry.startsWith('types')) {
      const rel = relative(base, fullPath).replace(/\.ts$/, '');
      entries[rel] = fullPath;
    }
  }
  return entries;
}

const srcDir = join(__dirname, 'src');

export default defineConfig([
  {
    entry: collectEntries(srcDir),
    format: ['cjs'],
    outDir: 'cjs',
    outExtension: () => ({ js: '.cjs' }),
    bundle: false,
    clean: true,
    dts: true,
    silent: false,
    target: 'node18',
    platform: 'node',
    noExternal: [],
    sourcemap: true,
  },
  {
    entry: collectEntries(srcDir),
    format: ['esm'],
    outDir: 'esm',
    outExtension: () => ({ js: '.js' }),
    bundle: false,
    clean: true,
    dts: true,
    silent: false,
    target: 'node18',
    platform: 'node',
    noExternal: [],
    sourcemap: true,
  },
]);
