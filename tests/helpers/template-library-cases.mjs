// Inputs and calls shared by the recorder (run once against the original templates-page-client.tsx) and the test (run against the split files).
// `impl` holds the functions and constants of the library page; `store` is the fake localStorage behind `window.localStorage`.
export function makeWindow() {
  const store = new Map();
  const localStorage = {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => void store.set(key, String(value)),
    removeItem: (key) => void store.delete(key),
  };
  return { store, window: { localStorage } };
}

const base = { id: 't1', slug: 'slug-1', title: 'Product ad', description: 'A description', category: 'Video', kind: 'video', format: 'Video', thumbnailUrl: '', previewUrl: '/api/template-assets/clip.mp4', targetPath: '/create/video', prompt: '  Make an ad  ', tags: [], featured: false, createdAt: '2026-01-01', updatedAt: '2026-01-02', settings: {} };
export const templates = {
  plain: base,
  motion: { ...base, id: 't2', slug: 'motion-1', title: 'Motion transfer: brand story', targetPath: '/create/video?tab=motion-transfer', settings: { feature: 'motion-transfer', sourceVideo: 'https://cdn.example/src.mp4', ratio: '9:16' } },
  swap: { ...base, id: 't3', slug: 'swap-1', targetPath: '/create/video', settings: { feature: 'video-swap', sourceImage: 'https://cdn.example/a.png', inputImages: ['https://cdn.example/b.png', 'https://cdn.example/b.png', '/api/template-assets/c.png', 'bad\\path', 42] } },
  edit: { ...base, id: 't4', slug: 'edit-1', kind: 'image', format: '4 : 5', title: 'Upscale', targetPath: '/create/image?tool=upscale', settings: { feature: 'upscale', aspectRatio: '16:9' } },
  product: { ...base, id: 't5', slug: 'product-1', category: 'Product Ads & Commercial', tags: ['Product'], settings: { feature: 'text-to-video' } },
  tagged: { ...base, id: 't6', slug: 'tagged-1', tags: ['summer', 'PRODUCT'] },
  thai: { ...base, id: 't7', slug: 'thai-1', title: 'Social media post', titleTh: '  ชื่อไทย  ', descriptionTh: 'คำอธิบายไทย', promptTh: 'พรอมต์ไทย', prompt: 'Create a premium product advertisement with intentional lighting, a clean composition, and a clear hero product.' },
  seeded: { ...base, id: 't8', slug: 'seeded-1', title: 'Training video', prompt: 'Show my product in the source video, keeping the same camera motion, lighting direction and pacing.' },
  system: { ...base, id: 't9', slug: 'system-1', title: 'Create a coherent video that follows the user instruction', description: 'Perform background removal', settings: { feature: 'text-to-video' } },
  longName: { ...base, id: 't10', slug: 'long-1', title: 'A {brand_name} story that goes on and on for a very long time without ever stopping to breathe\nsecond line' },
  audio: { ...base, id: 't11', slug: 'audio-1', kind: 'audio', format: 'MP3', targetPath: '/create/audio?x=1#top', previewUrl: 'https://cdn.example/a.mp3' },
  work: { ...base, id: 'mine:w1', slug: 'work-w1', category: 'Product Ads & Commercial' },
};

const history = { id: 'AbC_123 xyz', title: 'My clip', prompt: 'A prompt', outputUrl: 'https://cdn.example/out.mp4', createdAt: '2026-02-01', updatedAt: '2026-02-02', model: 'seedance', durationSeconds: 10, settings: { ratio: '9:16' } };
const historyBare = { id: 'x'.repeat(200), title: 'Bare', createdAt: 'a', updatedAt: 'b', settings: { model: 'kept', duration: 5 } };

const c = (key, vars) => (vars ? `${key}:${JSON.stringify(vars)}` : key);

export function collect(impl, { store }) {
  const out = {};
  const plain = (value) => JSON.parse(JSON.stringify(value ?? null));
  const section = (name, fn) => { out[name] = plain(fn()); };
  const each = (fn) => Object.fromEntries(Object.entries(templates).map(([key, t]) => [key, fn(t)]));

  section('modeOf', () => each((t) => impl.modeOf(t)));
  section('promptOf', () => each((t) => [impl.promptOf(t, 'th'), impl.promptOf(t, 'en')]));
  section('copy', () => each((t) => [impl.copy(t, 'th'), impl.copy(t, 'en')]));
  section('name', () => each((t) => [impl.name(t, 'th'), impl.name(t, 'en')]));
  section('templateHref', () => each((t) => impl.templateHref(t)));
  section('ratioOf', () => each((t) => impl.ratioOf(t)));
  section('isProductTemplate', () => each((t) => impl.isProductTemplate(t)));
  section('inputImagesOf', () => ({ ...each((t) => impl.inputImagesOf(t)), none: impl.inputImagesOf(undefined) }));
  section('referenceVideoOf', () => ({ ...each((t) => impl.referenceVideoOf(t)), none: impl.referenceVideoOf(undefined) }));
  section('variantOf', () => ({ ...each((t) => impl.variantOf(t)), none: impl.variantOf(undefined) }));
  section('tidyTitle', () => ['', '   \n  line two', 'Short', 'Hello {product_name} here', 'a'.repeat(100), 'word '.repeat(30), 'first\r\nsecond'].map((text) => [impl.tidyTitle(text), impl.tidyTitle(text, 20)]));
  section('valid', () => [undefined, '', '/path', '//evil', 'https://x.y', 'http://x', 'ftp://x', 'a\\b', '/a\\b', 'relative'].map((v) => impl.valid(v)));
  section('creditText', () => [null, 0, 1, 1.25, 1097, 0.04, 2.55].map((v) => impl.creditText(v)));
  section('workSlug', () => ['abc', 'A B_c', 'x'.repeat(200), '--'].map((id) => impl.workSlug(id)));
  section('templateOfWork', () => [impl.templateOfWork(history), impl.templateOfWork(history, true), impl.templateOfWork(historyBare)]);
  section('styleNameFromFile', () => ['photo.jpg', 'my style.png', '0b0e0c3e-6d6d-4f6f-8c4a-1c1c1c1c1c1c.png', 'abcdefghijklmnop1234567890.webp', 'x'.repeat(50) + '.png', '.png', 'a'.repeat(25) + '.png', 'IMG 1234.png'].map((file) => impl.styleNameFromFile(file, 'Untitled')));
  section('presetFacts', () => [
    impl.presetFacts({ ...templates.plain, settings: { model: 'm', ratio: '1:1', resolution: '480p', count: 2, duration: 10, outputFormat: 'mp4' } }, c),
    impl.presetFacts({ ...templates.plain, settings: { modelId: 'id', aspectRatio: '16:9', duration: 'x', count: null } }, c),
    impl.presetFacts(templates.plain, c),
  ]);

  // The browser storage helpers, driven from an empty store and then from broken values.
  section('storage', () => {
    const log = {};
    store.clear();
    log.emptyFavorites = [...impl.readFavoriteWorks()];
    log.emptyStyles = impl.readCustomStyles();
    log.emptyRecent = impl.readRecent();
    log.emptyDismissed = impl.readDismissedRuns();
    store.set('eos.templates.favorite-works', JSON.stringify(['a', 1, 'b']));
    log.favorites = [...impl.readFavoriteWorks()];
    store.set('eos.templates.favorite-works', '{not json');
    log.brokenFavorites = [...impl.readFavoriteWorks()];
    store.set('eos.templates.dismissedRuns', JSON.stringify(['r1', 2, 'r3']));
    log.dismissed = impl.readDismissedRuns();
    store.set('eos.templates.custom-styles', JSON.stringify([{ id: 'a', name: 'n', imageUrl: 'u' }, { id: 1 }, null, 'x']));
    log.styles = impl.readCustomStyles();
    impl.saveCustomStyles(Array.from({ length: 60 }, (_, i) => ({ id: `s${i}`, name: `n${i}`, imageUrl: `u${i}` })));
    log.savedStyles = JSON.parse(store.get('eos.templates.custom-styles')).length;
    store.clear();
    for (let i = 0; i < 14; i++) impl.rememberTemplate({ ...templates.plain, id: `r${i}` });
    log.recentAfterMany = impl.readRecent().map((t) => t.id);
    log.remembered = impl.rememberTemplate({ ...templates.plain, id: 'r5' }).map((t) => t.id);
    store.set('eos.templates.recent', JSON.stringify([{ id: 'ok' }, { id: 5 }, null]));
    log.recentFiltered = impl.readRecent().map((t) => t.id);
    impl.clearRecent();
    log.recentCleared = store.has('eos.templates.recent');
    log.keys = { favorites: 'eos.templates.favorite-works' };
    return log;
  });

  const constants = ['kindKeys', 'modes', 'DEFAULT_MODE', 'modeKeys', 'heroKeys', 'stepsByMode', 'laneQuery', 'laneOptions', 'editTools', 'modeFeatures', 'workflowEvent', 'modeCategory', 'modeCover', 'favoriteWorksKey', 'WORK_ID', 'WORK_TEMPLATE_EVENT', 'DISMISSED_RUNS_KEY'];
  for (const key of constants) section(`const:${key}`, () => impl[key]);
  return out;
}
