import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import vm from "node:vm";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const source = readFileSync(new URL("../src/features/history/exclusive-audio-playback.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const moduleObject = { exports: {} };
vm.runInNewContext(compiled, { module: moduleObject, exports: moduleObject.exports });
const { pauseOtherHistoryAudio } = moduleObject.exports;

test("playing an item pauses every other history player without pausing itself", () => {
  const calls = [0, 0, 0];
  const players = calls.map((_, index) => ({ pause: () => { calls[index]++; } }));
  pauseOtherHistoryAudio(players, players[1]);
  assert.deepEqual(calls, [1, 0, 1]);

  pauseOtherHistoryAudio(players, players[0]);
  assert.deepEqual(calls, [1, 1, 2]);
});
