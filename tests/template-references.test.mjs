import assert from 'node:assert/strict';
import test from 'node:test';
import { createLoader } from './helpers/load-ts-modules.mjs';

const dir = new URL('../src/features/templates/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const { referenceCategoryOf, withReferenceCategory, pruneReferenceCategories, isReferenceCategory } = createLoader(dir, {}, {})('template-references.ts');

// Objects built inside the loader belong to another realm, so compare them as plain JSON.
const plain = (value) => JSON.parse(JSON.stringify(value));
const bottle = 'https://cdn.example/bottle.png';
const lemon = 'https://cdn.example/lemon.png';

test('reads the category of one image and ignores anything unknown', () => {
  const settings = { inputImageCategories: { [bottle]: 'product', [lemon]: 'fruit' } };
  assert.equal(referenceCategoryOf(settings, bottle), 'product');
  assert.equal(referenceCategoryOf(settings, lemon), undefined);
  assert.equal(referenceCategoryOf(settings, 'https://cdn.example/none.png'), undefined);
  assert.equal(referenceCategoryOf(undefined, bottle), undefined);
  assert.equal(referenceCategoryOf({ inputImageCategories: ['product'] }, bottle), undefined);
  assert.equal(referenceCategoryOf({ inputImageCategories: 'product' }, bottle), undefined);
});

test('only character, product, brand, logo, scene and other are categories', () => {
  assert.deepEqual(plain(['character', 'product', 'brand', 'logo', 'scene', 'other', 'Product', '', 1, null].map(isReferenceCategory)), [true, true, true, true, true, true, false, false, false, false]);
});

test('sets and clears a category without touching other settings', () => {
  const base = { feature: 'motion-transfer', inputImages: [bottle, lemon] };
  const set = withReferenceCategory(base, bottle, 'product');
  assert.deepEqual(plain(set), { ...base, inputImageCategories: { [bottle]: 'product' } });
  assert.deepEqual(base, { feature: 'motion-transfer', inputImages: [bottle, lemon] });
  const two = withReferenceCategory(set, lemon, 'other');
  assert.deepEqual(plain(two.inputImageCategories), { [bottle]: 'product', [lemon]: 'other' });
  assert.deepEqual(plain(withReferenceCategory(two, bottle, undefined).inputImageCategories), { [lemon]: 'other' });
  assert.deepEqual(plain(withReferenceCategory(set, bottle, undefined)), base);
});

test('drops categories of images that are no longer attached', () => {
  const settings = { inputImages: [bottle, lemon], inputImageCategories: { [bottle]: 'product', [lemon]: 'other' } };
  assert.deepEqual(plain(pruneReferenceCategories(settings, [lemon])), { inputImages: [bottle, lemon], inputImageCategories: { [lemon]: 'other' } });
  assert.deepEqual(plain(pruneReferenceCategories(settings, [])), { inputImages: [bottle, lemon] });
  assert.deepEqual(plain(pruneReferenceCategories({ inputImages: [] }, [bottle])), { inputImages: [] });
});
