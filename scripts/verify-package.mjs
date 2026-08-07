#!/usr/bin/env node
/**
 * Loads the built artifacts the way a consumer does.
 *
 * `pnpm pack --dry-run` only checks which files are included — it never imports them, so
 * a build that emits unresolvable import specifiers passes packing and still fails for
 * every consumer. This script requires the CJS entry, imports the ESM entry, exercises a
 * real request against each, and checks every subpath declared in package.json#exports.
 *
 * Run after `pnpm run build`.
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

let failures = 0;
const ok = (msg) => console.log(`  ok   ${msg}`);
const fail = (msg, err) => {
  failures++;
  console.error(`  FAIL ${msg}\n       ${err?.message ?? err}`);
};

function jsonFetch(body, status = 200) {
  return () =>
    Promise.resolve(
      new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json' },
      }),
    );
}

console.log('\nentry points');

let cjs;
try {
  const mod = require('../cjs/index.cjs');
  cjs = mod.default ?? mod;
  if (typeof cjs.get !== 'function') throw new Error('default export has no get()');
  ok('require("./cjs/index.cjs")');
} catch (err) {
  fail('require("./cjs/index.cjs")', err);
}

let esm;
try {
  const mod = await import(new URL('../esm/index.js', import.meta.url));
  esm = mod.default;
  if (typeof esm.get !== 'function') throw new Error('default export has no get()');
  if (typeof mod.AccessioError !== 'function') throw new Error('missing named AccessioError');
  ok('import("./esm/index.js")');
} catch (err) {
  fail('import("./esm/index.js")', err);
}

console.log('\nrequests through the built output');

for (const [label, client] of [
  ['cjs', cjs],
  ['esm', esm],
]) {
  if (!client) continue;
  try {
    globalThis.fetch = jsonFetch({ hello: 'world' });
    const res = await client.get('https://example.test/x');
    if (res.data?.hello !== 'world') throw new Error(`unexpected data ${JSON.stringify(res.data)}`);
    ok(`${label}: get() returns parsed JSON`);
  } catch (err) {
    fail(`${label}: get() returns parsed JSON`, err);
  }

  try {
    let sawSignal = false;
    globalThis.fetch = (_url, init) => {
      sawSignal = init?.signal !== undefined;
      return jsonFetch({ ok: true })();
    };
    const controller = new AbortController();
    await client.get('https://example.test/x', { signal: controller.signal });
    if (!sawSignal) throw new Error('config.signal did not reach fetch');
    ok(`${label}: get(url, { signal }) forwards the signal`);
  } catch (err) {
    fail(`${label}: get(url, { signal }) forwards the signal`, err);
  }
}

console.log('\nsubpath exports');

for (const [subpath, conditions] of Object.entries(pkg.exports)) {
  const name = subpath === '.' ? '<root>' : subpath;
  try {
    require(`../${conditions.require.default.replace(/^\.\//, '')}`);
    ok(`require ${name}`);
  } catch (err) {
    fail(`require ${name}`, err);
  }
  try {
    const url = new URL(`../${conditions.import.default.replace(/^\.\//, '')}`, import.meta.url);
    await import(pathToFileURL(url.pathname).href);
    ok(`import ${name}`);
  } catch (err) {
    fail(`import ${name}`, err);
  }
}

console.log(
  failures === 0 ? '\nPackage verification passed.\n' : `\n${failures} check(s) failed.\n`,
);
process.exit(failures === 0 ? 0 : 1);
