// Rewrites the SHELL list in sw.js from the files on disk and bumps the cache version.
// Run after adding, removing or renaming files: npm run sw
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

async function walk(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name).replace(/\\/g, '/');
    if (e.isDirectory()) out.push(...await walk(p)); else out.push(p);
  }
  return out;
}
const files = ['./', 'index.html', 'manifest.webmanifest', 'css/styles.css', 'icons/icon.svg', 'icons/icon-192.png',
  ...(await walk('js')).filter(f => f.endsWith('.js')).sort()];
let sw = await readFile('sw.js', 'utf8');
sw = sw.replace(/const SHELL = \[[\s\S]*?\];/, 'const SHELL = [\n' + files.map(f => "  '" + f + "'").join(',\n') + '\n];');
sw = sw.replace(/const VERSION = 'iron-ledger-v(\d+)';/, (_, n) => `const VERSION = 'iron-ledger-v${+n + (process.argv.includes('--no-bump') ? 0 : 1)}';`);
await writeFile('sw.js', sw);
console.log(`sw.js: ${files.length} files cached, ${sw.match(/VERSION = '([^']+)'/)[1]}`);
