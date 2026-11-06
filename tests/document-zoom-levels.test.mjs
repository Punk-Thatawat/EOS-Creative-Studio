import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import vm from "node:vm";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const source = readFileSync(new URL("../src/features/create/document/document-zoom-levels.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const moduleObject = { exports: {} };
vm.runInNewContext(compiled, { module: moduleObject, exports: moduleObject.exports });
const { nextDocumentZoom, documentZoomLevels } = moduleObject.exports;

test("zoom uses the same steps and limits as OCR", () => {
  assert.equal(nextDocumentZoom(100, "in"), 125);
  assert.equal(nextDocumentZoom(100, "out"), 75);
  assert.equal(nextDocumentZoom(300, "in"), 300);
  assert.equal(nextDocumentZoom(25, "out"), 25);
});

test("fit-to-page values remain visible and can step to a preset", () => {
  assert.ok(documentZoomLevels(92).includes(92));
  assert.equal(nextDocumentZoom(92, "in"), 100);
  assert.equal(nextDocumentZoom(92, "out"), 75);
});
