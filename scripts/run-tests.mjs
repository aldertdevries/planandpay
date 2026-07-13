// Draait js/tests.js in Node met minimale browser-shims.
// Gebruik: node scripts/run-tests.mjs
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

// localStorage-shim
const opslag = new Map();
globalThis.localStorage = {
  getItem: (k) => (opslag.has(k) ? opslag.get(k) : null),
  setItem: (k, v) => opslag.set(k, String(v)),
  removeItem: (k) => opslag.delete(k),
};

// canvas-shim (alleen wat laadDemoData nodig heeft)
globalThis.document = {
  createElement: () => ({
    width: 0, height: 0,
    getContext: () => ({ fillRect() {}, fillText() {} }),
    toDataURL: () => 'data:image/png;base64,demo',
  }),
  getElementById: () => null,
};

const bron = ['js/validatie.js', 'js/agenda.js', 'js/facturatie.js', 'js/db.js', 'js/tests.js']
  .map((bestand) => readFileSync(join(root, bestand), 'utf8'))
  .join('\n');
(0, eval)(bron);
