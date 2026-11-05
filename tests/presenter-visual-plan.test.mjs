import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const source = readFileSync(new URL('../src/features/create/ai-presenter/presenter-visual-plan.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const moduleObject = { exports: {} };
vm.runInNewContext(compiled, { module: moduleObject, exports: moduleObject.exports });
const { presenterDirectionForChunk } = moduleObject.exports;

test('uses the opening for a new logical scene and continuation for subsequent chunks', () => {
  const firstScene = { opening: 'หยิบสินค้า', continuation: 'ตามเฟรมก่อนหน้า โดยไม่หยิบซ้ำ' };
  const secondScene = { opening: 'เริ่มในร้าน', continuation: 'คงภาพร้านและท่าจากเฟรมก่อนหน้า' };
  assert.equal(presenterDirectionForChunk('original 1', firstScene, false), firstScene.opening);
  assert.equal(presenterDirectionForChunk('original 1', firstScene, true), firstScene.continuation);
  assert.equal(presenterDirectionForChunk('original 2', secondScene, false), secondScene.opening);
  assert.equal(presenterDirectionForChunk('original 2', secondScene, true), secondScene.continuation);
});

test('keeps original direction when no analysis was requested', () => {
  assert.equal(presenterDirectionForChunk('ถ่ายภาพนิ่ง', undefined, false), 'ถ่ายภาพนิ่ง');
  assert.equal(presenterDirectionForChunk('ถ่ายภาพนิ่ง', undefined, true), 'ถ่ายภาพนิ่ง');
});
