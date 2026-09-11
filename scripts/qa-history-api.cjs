/* eslint-disable @typescript-eslint/no-require-imports -- standalone Node QA utility */
// Run: node scripts/qa-history-api.cjs. No browser, network, or credentials used.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const filename = path.resolve(__dirname, '../src/lib/api/history.ts');
const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
let token = 'test-token';
let request;
let respond;
const exportsObject = {};
vm.runInNewContext(source, {
  exports: exportsObject,
  require(name) {
    assert.equal(name, '@/lib/auth/access-token');
    return { getApiAccessToken: async () => token };
  },
  process: { env: { NEXT_PUBLIC_BACKEND_URL: 'https://example.test/api/v1/' } },
  URLSearchParams,
  fetch: async (url, options) => { request = { url, options }; return respond(options); },
}, { filename });
const { fetchHistory } = exportsObject;
const item = {
  id: 'test', source: 'generation', mediaKind: 'image', feature: 'new-feature',
  title: '', status: 'queued', outputCount: 0, totalCount: 1, completedCount: 0,
  createdAt: '2026-09-07T00:00:00Z', updatedAt: '2026-09-07T00:00:00Z',
};
const empty = {
  items: [], pagination: { limit: 24, offset: 0, total: 0, hasMore: false },
  summary: { total: 0, inProgress: 0, completed: 0, failed: 0, images: 0, videos: 0, audio: 0 },
};
function serve(data, status = 200) {
  respond = async () => new Response(JSON.stringify(data), { status });
}
let passed = 0;
async function check(name, run) {
  await run();
  passed++;
  console.log(`PASS ${name}`);
}
async function main() {
  await check('empty response and existing query/auth behavior', async () => {
    serve({ data: empty });
    assert.equal(JSON.stringify(await fetchHistory()), JSON.stringify(empty));
    assert.equal(request.url, 'https://example.test/api/v1/history?offset=0&limit=24');
    assert.equal(request.options.headers.Authorization, 'Bearer test-token');
    assert.equal(request.options.credentials, 'include');
    assert.equal(request.options.cache, 'no-store');
    const signal = new AbortController().signal;
    await fetchHistory({ search: '  ocean  ', type: 'video', status: 'completed', offset: 50, limit: 50, signal });
    assert.equal(request.options.signal, signal);
    assert.equal(new URL(request.url).search, '?search=ocean&type=video&status=completed&offset=50&limit=50');
  });
  await check('all backend sources/statuses, optional metadata, and unknown fields survive', async () => {
    for (const [source, mediaKind] of [['generation', 'image'], ['video-storyboard', 'video'], ['audio', 'audio']]) {
      for (const status of ['queued', 'processing', 'completed', 'failed', 'cancelled']) {
        const data = { ...empty, items: [{ ...item, source, mediaKind, status, settings: { nested: ['a'] }, prompt: 'hello', durationSeconds: 1.25, future: true }] };
        serve({ data });
        assert.equal(JSON.stringify(await fetchHistory()), JSON.stringify(data));
      }
    }
  });
  await check('missing required fields and malformed containers reject gracefully', async () => {
    const valid = { ...empty, items: [item] };
    const invalid = [[], {}, { ...valid, items: {} }, { ...valid, items: [null] }, { ...valid, pagination: [] }, { ...valid, summary: null }];
    for (const group of ['pagination', 'summary']) {
      for (const field of Object.keys(valid[group])) {
        const data = structuredClone(valid);
        delete data[group][field];
        invalid.push(data);
      }
    }
    for (const field of Object.keys(item)) {
      const data = structuredClone(valid);
      delete data.items[0][field];
      invalid.push(data);
    }
    invalid.push({ ...valid, items: [{ ...item, status: 'unknown' }] });
    invalid.push({ ...valid, pagination: { ...empty.pagination, total: '1' } });
    invalid.push({ ...valid, summary: { ...empty.summary, total: -1 } });
    for (const data of invalid) {
      serve({ data });
      await assert.rejects(fetchHistory(), /History response was invalid/);
    }
  });
  await check('empty envelopes, invalid JSON, and HTTP error messages', async () => {
    for (const payload of [null, {}, { data: null }]) {
      serve(payload);
      await assert.rejects(fetchHistory(), /History response was empty/);
    }
    respond = async () => new Response('<html>');
    await assert.rejects(fetchHistory(), /History response was empty/);
    serve({ message: 'Session expired' }, 401);
    await assert.rejects(fetchHistory(), /Session expired/);
    serve({ message: { unexpected: true } }, 500);
    await assert.rejects(fetchHistory(), /Unable to load history/);
  });
  await check('missing token prevents fetch', async () => {
    token = null;
    request = null;
    await assert.rejects(fetchHistory(), /Please sign in/);
    assert.equal(request, null);
    token = 'test-token';
  });
  await check('pre-abort, in-flight abort, and body-read abort preserve cancellation', async () => {
    const controller = new AbortController();
    controller.abort();
    request = null;
    await assert.rejects(fetchHistory({ signal: controller.signal }), { name: 'AbortError' });
    assert.equal(request, null);
    const pending = new AbortController();
    respond = ({ signal }) => new Promise((resolve, reject) => {
      signal.addEventListener('abort', () => reject(signal.reason), { once: true });
      pending.abort();
    });
    await assert.rejects(fetchHistory({ signal: pending.signal }), { name: 'AbortError' });
    const body = new AbortController();
    respond = async () => ({ ok: true, json: async () => { body.abort(); throw body.signal.reason; } });
    await assert.rejects(fetchHistory({ signal: body.signal }), { name: 'AbortError' });
  });
  console.log(`${passed} focused history API checks passed.`);
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
