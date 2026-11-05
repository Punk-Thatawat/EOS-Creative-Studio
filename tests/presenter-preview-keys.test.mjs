import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('generated presenter player and overlay use distinct URL-scoped keys', () => {
  const source = readFileSync(new URL('../src/features/create/ai-presenter/ai-presenter-page.tsx', import.meta.url), 'utf8');
  assert.match(source, /<EosVideoPlayer\s+key=\{`player:\$\{displayedVideoUrl\}`\}/);
  assert.match(source, /<VideoPreviewOverlayActions\s+key=\{`actions:\$\{displayedVideoUrl\}`\}/);
});
