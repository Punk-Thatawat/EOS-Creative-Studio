process.env.TZ = 'UTC';

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createLoader } from './helpers/load-ts-modules.mjs';
import { collect } from './helpers/audio-generation-cases.mjs';

// The snapshot was recorded from the original audio-generation-page.tsx before its constants and helpers
// were moved into separate files. These tests check that the moved code still returns the same values.
const dir = new URL('../src/features/create/audio-generation/components/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const snapshot = JSON.parse(readFileSync(new URL('./fixtures/audio-generation.snapshot.json', import.meta.url), 'utf8'));

const events = [];
const externals = {
  'lucide-react': new Proxy({}, { get: (_, name) => (name === '__esModule' ? undefined : String(name)) }),
  '@/lib/generation-progress-events': {
    emitGenerationSubmitting: (payload) => events.push(['submitting', payload]),
    emitGenerationRequestFinished: (payload) => events.push(['finished', payload]),
    emitGenerationRequestFailed: (payload) => events.push(['failed', payload]),
  },
};
const load = createLoader(dir, externals, { crypto: { randomUUID: () => 'uuid-1' } });
const impl = Object.assign({}, ...['audio-generation.constants.ts', 'audio-generation.helpers.ts'].map((file) => load(file)));

const actual = JSON.parse(JSON.stringify(await collect(impl, { events })));

for (const section of Object.keys(snapshot)) {
  test(`audio generation: ${section} matches the recorded original`, () => {
    assert.deepStrictEqual(actual[section], snapshot[section]);
  });
}

test('audio generation: no section is missing or added', () => {
  assert.deepStrictEqual(Object.keys(actual).sort(), Object.keys(snapshot).sort());
});
