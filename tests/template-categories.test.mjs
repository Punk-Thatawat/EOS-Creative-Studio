import assert from 'node:assert/strict';
import test from 'node:test';
import { createLoader } from './helpers/load-ts-modules.mjs';

const dir = new URL('../src/features/templates/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const { categoryLabel } = createLoader(dir, {}, {})('template-categories.ts');

test('shows the Thai name of a known category in Thai and the original name in English', () => {
  assert.equal(categoryLabel('Advertising', 'th'), 'โฆษณา');
  assert.equal(categoryLabel('Anime, Fantasy & Animation', 'th'), 'อนิเมะ แฟนตาซี และแอนิเมชัน');
  assert.equal(categoryLabel('Advertising', 'en'), 'Advertising');
});

test('a category without a Thai name shows as written', () => {
  assert.equal(categoryLabel('Handyman Tools', 'th'), 'Handyman Tools');
  assert.equal(categoryLabel('', 'th'), '');
});

test('every category the API lists has a Thai name', async () => {
  const known = ['AI Image & Product Photography', 'AI Presenter & Talking Avatar', 'Advertising', 'Anime, Fantasy & Animation', 'Audio', 'Branding & Graphic Design', 'Business & Corporate', 'Cinematic & Storytelling', 'Edit video', 'Education & Explainer', 'Fitness, Health & Wellness', 'Food & Cooking', 'Gaming & Sci-Fi', 'Motion', 'Motion Graphics & Transitions', 'Presenter', 'Product Ads & Commercial', 'Real Estate & Architecture', 'Seasonal & Special Events', 'Social Media & Viral Content', 'Travel, Nature & Lifestyle', 'UGC & Influencer Marketing', 'Video', 'Voice, Music & Sound Design', 'image'];
  for (const name of known) assert.notEqual(categoryLabel(name, 'th'), name, name);
});
