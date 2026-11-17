// Fixed inputs for the admin credits pricing helpers. `collect(impl, stubs)` runs every case and returns
// plain JSON, so the same cases can be recorded from the original page and compared with the extracted modules.

const route = (model, provider, displayName, enabled = true, capabilities) => ({ model, provider, displayName, enabled, capabilities });

const overview = {
  routes: {
    'text-to-image': [route('wavespeed-ai/z-image/turbo', 'wavespeed', 'Z-Image Turbo'), route('x/off', 'wavespeed', 'Disabled', false)],
    'image-to-image': [route('bria/edit', 'bria', 'Bria Edit', false)],
    'image-to-video': [route('kling/i2v', 'wavespeed', 'Kling I2V'), route('other/i2v', 'fal', 'Other I2V')],
    'text-to-video': [route('seedance/t2v', 'wavespeed', 'Seedance')],
    'ai-presenter': [route('presenter/one', 'wavespeed', 'Presenter One')],
    'document-summary': [route('gemini/flash', 'wavespeed', 'Gemini Flash')],
    'document-ocr': [route('ocr/skip', 'iapp', 'Skipped OCR route')],
    audio: [route('eleven_v3', 'elevenlabs', 'Skipped audio route')],
    upscale: [],
  },
};

const ocrTypes = [
  { id: 'thai-id-card', depths: ['basic', 'advanced'], outputFormats: ['json', 'docx', 'pdf'] },
  { id: 'invoice', outputFormats: ['json'] },
  { id: 'bank-statement', depths: ['basic'], outputFormats: ['pdf'] },
];

const audioSettings = {
  routing: { textToSpeech: 'elevenlabs', podcastDialogue: 'elevenlabs', voiceClone: 'wavespeed', soundEffects: 'wavespeed' },
  featureProfiles: {
    textToSpeech: { modelId: 'eleven_multilingual_v2', models: { eleven_flash_v2_5: {}, eleven_turbo_v2_5: {}, 'minimax/speech-02-hd': {}, internal: {}, eleven_v4: {} } },
    podcastDialogue: { modelId: 'eleven_v3', models: { 'elevenlabs/eleven-v4': {}, music_v1: {}, music_v2: {} } },
    voiceClone: { modelId: 'eleven_v3', models: { 'minimax/speech-2.8-hd': {}, eleven_multilingual_v2: {}, custom_clone: {} } },
  },
  backgroundMusicPresets: [{ isActive: true, audioUrl: '', prompt: ' calm piano ' }, { isActive: false, audioUrl: '', prompt: 'x' }],
};
const audioSettingsNoPreset = {
  ...audioSettings,
  backgroundMusicPresets: [{ isActive: true, audioUrl: 'https://cdn/x.mp3', prompt: 'has file' }, { isActive: true, audioUrl: '', prompt: '   ' }],
};

const schemaRow = {
  feature: 'Text to Image', featureKey: 'text-to-image', model: 'm', provider: 'wavespeed', displayName: 'M', unit: 'Per image', note: '',
  capabilities: {
    apiSchema: {
      request_schema: {
        properties: {
          prompt: { type: 'string' },
          size: { type: 'string', enum: ['512*512', '1024*1024'], title: ' Image size ' },
          num_images: { type: 'integer', minimum: 1, maximum: 4, default: 2 },
          seed: { type: 'integer' },
          output_type: { type: 'string', readOnly: true },
          video_length: { type: 'integer', deprecated: true },
          duration_seconds: { type: 'number' },
          frame_rate: { type: 'number', default: 24 },
          aspectRatio: { type: 'string', enum: ['1:1', '16:9'] },
          negative_prompt: { type: 'string' },
        },
      },
    },
    parameters: [],
  },
};
const capabilityRow = {
  feature: 'Image to Image', featureKey: 'image-to-image', model: 'c', provider: 'wavespeed', displayName: 'C', unit: 'Per image', note: '',
  capabilities: {
    parameters: ['size', 'resolution', 'quality', 'n'],
    sizeParameter: 'size', supportedSizes: ['1024x1024', '512x512'],
    resolutionParameter: 'resolution', supportedResolutions: ['1k', '2k'],
    targetResolutionParameter: 'target_resolution',
    qualityParameter: 'quality', qualityValues: ['low', 'high'],
    countParameter: 'n',
  },
};
const ocrRow = { feature: 'Document OCR', featureKey: 'document-ocr', model: 'document-ocr/invoice/basic', provider: 'iapp', displayName: 'Invoice', unit: 'Per page', note: '' };
const docRow = { feature: 'Document Summary', featureKey: 'document-summary', model: 'g', provider: 'wavespeed', displayName: 'G', unit: 'Per document', note: '' };
const presenterRow = { feature: 'AI Presenter', featureKey: 'ai-presenter', model: 'p', provider: 'wavespeed', displayName: 'P', unit: 'Per scene', note: '' };
const manyRow = {
  feature: 'AI Presenter', featureKey: 'ai-presenter', model: 'many', provider: 'wavespeed', displayName: 'Many', unit: 'Per scene', note: '',
  capabilities: { parameters: [], apiSchema: { request_schema: { properties: Object.fromEntries(['size', 'count', 'quality', 'resolution', 'steps', 'fps', 'frames', 'length', 'audio'].map((name) => [name, { type: 'integer' }])) } } },
};
const bareRow = { feature: 'Upscale', featureKey: 'upscale', model: 'u', provider: 'bria', displayName: 'U', unit: 'Per image', note: '' };

const readyPreview = { status: 'ready', providerCostThb: 3.37, creditCost: 1, sellingPriceThb: 0, costCredits: 0, profitCredits: 0, profitThb: 0 };

const featureKeys = [
  'text-to-image', 'image-to-image', 'image-to-video', 'video-to-sfx', 'video-to-music', 'text-to-video', 'people-video',
  'motion-transfer', 'lipsync', 'extend-video', 'video', 'style-transfer', 'background-removal', 'upscale', 'extend-image',
  'ai-presenter', 'audio', 'podcastDialogue', 'audio-voice-clone', 'audio-sound-effects', 'audio-text-to-music', 'audio-cleanup',
  'audio-music', 'document', 'document-ocr', 'document-summary', 'document-translate', 'document-contract', 'document-report',
  'document-form', 'unknown-feature',
];
const categories = ['all', 'image', 'video', 'audio', 'document', 'presenter'];

function attempt(fn) {
  try { return { ok: fn() }; } catch (error) { return { throws: error instanceof Error ? error.message : String(error) }; }
}

export async function collect(impl, stubs) {
  const result = {};
  result.constants = {
    MAX_TARGET_MARKUP_PERCENT: impl.MAX_TARGET_MARKUP_PERCENT,
    MAX_TARGET_MARKUP_RATIO: impl.MAX_TARGET_MARKUP_RATIO,
    featureLabels: impl.featureLabels,
    featureOrder: impl.featureOrder,
    videoFeatureKeys: [...impl.videoFeatureKeys],
    presenterFeatureKeys: [...impl.presenterFeatureKeys],
    documentFeatureKeys: [...impl.documentFeatureKeys],
    audioFeatureKeys: [...impl.audioFeatureKeys],
    audioFeatureGroups: impl.audioFeatureGroups,
    fallbackModelRows: impl.fallbackModelRows,
    PRICING_PREVIEW_BATCH_SIZE: impl.PRICING_PREVIEW_BATCH_SIZE,
    UNUSED_VOICE_CLONE_MODELS: [...impl.UNUSED_VOICE_CLONE_MODELS],
    pricingParameterPattern: String(impl.pricingParameterPattern),
    nonPricingParameters: [...impl.nonPricingParameters],
  };
  result.matchesPricingCategory = Object.fromEntries(
    categories.map((category) => [category, featureKeys.filter((key) => impl.matchesPricingCategory(key, category))]),
  );
  result.rowKey = impl.rowKey({ provider: 'p', model: 'm', featureKey: 'f' });
  result.modelRowsFromOverview = impl.modelRowsFromOverview(overview);
  result.documentOcrPricingRows = impl.documentOcrPricingRows(ocrTypes);
  result.audioPricingRows = impl.audioPricingRows(audioSettings);
  result.audioPricingRowsNoPreset = impl.audioPricingRows(audioSettingsNoPreset);

  stubs.batches.length = 0;
  const batchInput = Array.from({ length: 120 }, (_, i) => ({ provider: 'p', model: `m${i}` }));
  const previews = await impl.previewPricingRowsInBatches(batchInput);
  result.previewBatches = { sizes: stubs.batches.map((b) => b.length), total: previews.length, first: previews[0], last: previews[previews.length - 1] };
  stubs.batches.length = 0;
  result.previewBatchesEmpty = { previews: await impl.previewPricingRowsInBatches([]), calls: stubs.batches.length };

  result.formatMetric = [undefined, NaN, Infinity, 0, 1234.5678, 0.005, -7].map((v) => impl.formatMetric(v)).concat(impl.formatMetric(1234.5678, 0), impl.formatMetric(1234.5678, 4));
  const draft = (targetMargin, fixedCostThb, minimumCreditCost) => ({ targetMargin, fixedCostThb, minimumCreditCost, promptAddonsJson: '' });
  result.previewWithDraft = [
    impl.previewWithDraft(undefined, draft('40', '0', '1'), 0.1, 0),
    impl.previewWithDraft({ ...readyPreview, status: 'unavailable' }, draft('40', '0', '1'), 0.1, 0),
    impl.previewWithDraft({ status: 'ready' }, draft('40', '0', '1'), 0.1, 0),
    impl.previewWithDraft(readyPreview, draft('40', '0', '1'), 0, 0),
    impl.previewWithDraft(readyPreview, draft('40', '0', '1'), 0.1, 0),
    impl.previewWithDraft(readyPreview, draft('40', '1.5', '3'), 0.1, 2),
    impl.previewWithDraft(readyPreview, draft('5000', '0', '1'), 0.1, 1),
    impl.previewWithDraft(readyPreview, draft('-20', 'abc', ''), 0.1, 0),
    impl.previewWithDraft(readyPreview, draft('0', '0', ''), 100, 0),
  ];

  result.pricingLabel = [impl.pricingLabel('num_images', {}), impl.pricingLabel('aspectRatio', {}), impl.pricingLabel('x', { title: '  Custom  ' })];
  result.pricingProperties = Object.fromEntries(
    Object.entries({ schemaRow, capabilityRow, ocrRow, docRow, presenterRow, manyRow, bareRow }).map(([name, row]) => [name, impl.pricingProperties(row)]),
  );
  result.defaultScenarioValues = Object.fromEntries(
    Object.entries({ schemaRow, capabilityRow, ocrRow, docRow, presenterRow, manyRow, bareRow }).map(([name, row]) => [name, impl.defaultScenarioValues(row)]),
  );
  result.cleanScenarioValues = impl.cleanScenarioValues({ a: 1, b: undefined, c: '', d: 0, e: false, f: null });

  result.promptAddonsJson = [impl.promptAddonsJson(undefined), impl.promptAddonsJson({ style: { cinematic: 2, plain: 0 } })];
  result.parsePromptAddonsJson = [
    attempt(() => impl.parsePromptAddonsJson('')),
    attempt(() => impl.parsePromptAddonsJson('   ')),
    attempt(() => impl.parsePromptAddonsJson('{"a":{"b":1}}')),
    attempt(() => impl.parsePromptAddonsJson('[]')),
    attempt(() => impl.parsePromptAddonsJson('null')),
    attempt(() => impl.parsePromptAddonsJson('"text"')),
    attempt(() => impl.parsePromptAddonsJson('{not json')),
  ];
  result.promptAddonEntries = [
    attempt(() => impl.promptAddonEntries('{"style":{"a":1,"b":2.5},"bad":[1],"nul":null}')),
    attempt(() => impl.promptAddonEntries('')),
    attempt(() => impl.promptAddonEntries('[1]')),
  ];
  result.promptAddonVariableCount = ['{"a":{},"b":{"x":1}}', '', '{oops', '[]'].map((v) => impl.promptAddonVariableCount(v));
  return result;
}
