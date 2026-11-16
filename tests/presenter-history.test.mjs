import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const source = readFileSync(new URL('../src/features/create/ai-presenter/presenter-history.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const moduleObject = { exports: {} };
vm.runInNewContext(compiled, { module: moduleObject, exports: moduleObject.exports });
const { loadPresenterHistory, presenterPreviewUrl, presenterHistoryKey } = moduleObject.exports;

const item = (id, overrides = {}) => ({ id, source: 'video-storyboard', feature: 'ai-presenter-video', mediaKind: 'video', status: 'completed', outputUrl: `https://example.com/${id}.mp4`, ...overrides });

test('loads only completed presenter videos and searches later pages with the recent-only filter', async () => {
  const calls = [];
  const fetchPage = async (input) => {
    calls.push(input);
    if (!input.offset) return { items: Array.from({ length: 50 }, (_, index) => item(`other-${index}`, { feature: 'image-to-video' })), pagination: { hasMore: true } };
    return { items: [item('new'), item('new'), item('failed', { status: 'failed' }), item('empty', { outputUrl: '' }), item('old')], pagination: { hasMore: false } };
  };
  const result = await loadPresenterHistory(fetchPage, new AbortController().signal);
  assert.deepEqual(Array.from(result, (entry) => entry.id), ['new', 'old']);
  assert.equal(calls[0].recentOnly, true);
  assert.equal(calls[1].offset, 50);
});

test('switches from an older library video back to the latest without confusing identities', () => {
  const history = [item('latest'), item('old'), item('old', { source: 'generation', outputUrl: 'https://example.com/other.mp4' })];
  const oldKey = presenterHistoryKey(history[1]);
  assert.equal(presenterPreviewUrl('library', '', history, oldKey), 'https://example.com/old.mp4');
  assert.equal(presenterPreviewUrl('latest', '', history, oldKey), 'https://example.com/latest.mp4');
  assert.equal(presenterPreviewUrl('latest', 'https://example.com/new.mp4', history, oldKey), 'https://example.com/new.mp4');
  assert.equal(presenterPreviewUrl('scene', '', history, oldKey), '');
  assert.equal(presenterPreviewUrl('library', '', history, presenterHistoryKey(history[2])), 'https://example.com/other.mp4');
  assert.equal(presenterPreviewUrl('library', '', history, 'video-storyboard:missing'), '');
});

test('stops when the history request is cancelled', async () => {
  const controller = new AbortController();
  const fetchPage = async () => { controller.abort(); return { items: [item('new')], pagination: { hasMore: false } }; };
  await assert.rejects(loadPresenterHistory(fetchPage, controller.signal), { name: 'AbortError' });
});
