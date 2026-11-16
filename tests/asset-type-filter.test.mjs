import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const source = readFileSync(new URL('../src/features/assets/asset-type-filter.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const moduleObject = { exports: {} };
vm.runInNewContext(compiled, { module: moduleObject, exports: moduleObject.exports });
const { selectAssetType, isAssetTypeSelected } = moduleObject.exports;

test('All clears the selected tag without deleting it', () => {
  const result = selectAssetType('All Types', 'tag-1');
  assert.equal(result.type, 'All Types');
  assert.equal(result.tag, null);
  assert.equal(isAssetTypeSelected('All Types', 'All Types', 'tag-1'), false);
  assert.equal(isAssetTypeSelected('All Types', result.type, result.tag), true);
});

test('other media types retain the selected tag', () => {
  const result = selectAssetType('Images', 'tag-1');
  assert.equal(result.type, 'Images');
  assert.equal(result.tag, 'tag-1');
  assert.equal(isAssetTypeSelected('Images', result.type, result.tag), true);
});
