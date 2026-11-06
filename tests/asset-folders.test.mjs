import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import vm from "node:vm";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const source = readFileSync(new URL("../src/features/assets/asset-folders.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const mod = { exports: {} };
vm.runInNewContext(compiled, { module: mod, exports: mod.exports });
const { isSystemAssetFolder, isUnfiledAssetFolder } = mod.exports;

test("built-in type folders are unfiled, while user folders remain visible", () => {
  for (const name of ["Image", "Videos", "Voice", "Document", "IMAGE"]) {
    assert.equal(isSystemAssetFolder(name), true);
    assert.equal(isUnfiledAssetFolder(name), true);
  }
  assert.equal(isUnfiledAssetFolder(null), true);
  assert.equal(isSystemAssetFolder("Campaign"), false);
  assert.equal(isUnfiledAssetFolder("Campaign"), false);
});
