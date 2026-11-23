process.env.TZ = 'UTC';

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createLoader } from './helpers/load-ts-modules.mjs';
import { collect, makeWindow } from './helpers/template-library-cases.mjs';

// The snapshot was recorded from the original templates-page-client.tsx before its constants and helpers were
// moved into separate files. These tests check that the moved code still returns the same values.
const dir = new URL('../src/features/templates/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const snapshot = JSON.parse(readFileSync(new URL('./fixtures/template-library.snapshot.json', import.meta.url), 'utf8'));

// Packages are not needed for these helpers; any name read from them is answered with its own name (icons) or a stub.
const stub = new Proxy({}, { get: (_, name) => (name === '__esModule' ? undefined : String(name)) });
const externals = new Proxy({}, { has: () => true, get: () => stub });
const { store, window } = makeWindow();
const load = createLoader(dir, externals, { window, URL });
const modules = [
  'library-modes.ts',
  'template-text.ts',
  'saved-works.ts',
  'custom-styles.ts',
  'recent-templates.ts',
  'preset-facts.ts',
  'use-template-images.ts',
  'use-template-quote.ts',
];
const impl = Object.assign({}, ...modules.map((file) => load(file)));
const actual = JSON.parse(JSON.stringify(collect(impl, { store })));

for (const section of Object.keys(snapshot)) {
  test(`templates page: ${section} matches the recorded original`, () => {
    assert.deepStrictEqual(actual[section], snapshot[section]);
  });
}

test('templates page: no section is missing or added', () => {
  assert.deepStrictEqual(Object.keys(actual).sort(), Object.keys(snapshot).sort());
});
