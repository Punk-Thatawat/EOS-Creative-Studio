process.env.TZ = 'UTC';

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createLoader } from './helpers/load-ts-modules.mjs';
import { collect } from './helpers/video-generation-cases.mjs';

// The snapshot was recorded from the original video-generation-page.tsx before its constants and helpers
// were moved into separate files. These tests check that the moved code still returns the same values.
const dir = new URL('../src/features/create/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const snapshot = JSON.parse(readFileSync(new URL('./fixtures/video-generation.snapshot.json', import.meta.url), 'utf8'));

const externals = {
  'lucide-react': new Proxy({}, { get: (_, name) => (name === '__esModule' ? undefined : String(name)) }),
};
const load = createLoader(dir, externals, { window: {}, URL, document: {} });
const modules = [
  'video-generation.constants.ts',
  'video-mode-helpers.ts',
  'video-schema-helpers.ts',
  'storyboard-split.ts',
];
const impl = Object.assign({}, ...modules.map((file) => load(file)));
const actual = JSON.parse(JSON.stringify(collect(impl)));

for (const section of Object.keys(snapshot)) {
  test(`video generation: ${section} matches the recorded original`, () => {
    assert.deepStrictEqual(actual[section], snapshot[section]);
  });
}

test('video generation: no section is missing or added', () => {
  assert.deepStrictEqual(Object.keys(actual).sort(), Object.keys(snapshot).sort());
});
