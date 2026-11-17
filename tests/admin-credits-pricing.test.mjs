import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createLoader } from './helpers/admin-credits-load.mjs';
import { collect } from './helpers/admin-credits-pricing-cases.mjs';

// The snapshot was recorded from the original src/app/admin/credits/page.tsx before its helpers were moved
// into separate files. These tests check that the moved code still returns exactly the same values.
const dir = new URL('../src/app/admin/credits/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const snapshot = JSON.parse(readFileSync(new URL('./fixtures/admin-credits-pricing.snapshot.json', import.meta.url), 'utf8'));

const batches = [];
const externals = {
  '@/lib/api/credit-pricing': {
    previewAdminCreditPricingRules: async (batch) => {
      batches.push(batch);
      return batch.map((entry) => ({ status: 'ready', model: entry.model }));
    },
  },
};
const load = createLoader(dir, externals);
const impl = Object.assign(
  {},
  ...['pricing.constants.ts', 'pricing-rows.ts', 'pricing-preview.ts', 'pricing-parameters.ts', 'prompt-addons.ts'].map((file) => load(file)),
);

const actual = JSON.parse(JSON.stringify(await collect(impl, { batches })));

for (const section of Object.keys(snapshot)) {
  test(`admin credits pricing: ${section} matches the recorded original`, () => {
    assert.deepStrictEqual(actual[section], snapshot[section]);
  });
}

test('admin credits pricing: no section is missing or added', () => {
  assert.deepStrictEqual(Object.keys(actual).sort(), Object.keys(snapshot).sort());
});
