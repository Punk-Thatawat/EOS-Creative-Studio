// Fixed inputs for the pure parts of the video generation page (constants, mode/schema helpers and the
// storyboard contact-sheet analysis). `collect(impl)` returns plain JSON so the same cases can be recorded
// from the original page and compared with the extracted modules.

const WHITE = [255, 255, 255, 255];

function makeSheet(width, height, pixelAt) {
  const pixels = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const [r, g, b, a] = pixelAt(x, y);
      const offset = (y * width + x) * 4;
      pixels[offset] = r;
      pixels[offset + 1] = g;
      pixels[offset + 2] = b;
      pixels[offset + 3] = a;
    }
  }
  return { pixels, width, height };
}

// A 2x2 contact sheet: coloured cells separated by white gutters.
function gutterSheet({ cell = 52, margin = 0, frame = 0, frameValue = 30 } = {}) {
  const gutter = 8;
  const inner = cell * 2 + gutter;
  const total = inner + (margin + frame) * 2;
  return makeSheet(total, total, (x, y) => {
    const lx = x - margin;
    const ly = y - margin;
    if (lx < 0 || ly < 0 || lx >= inner + frame * 2 || ly >= inner + frame * 2) return WHITE;
    if (lx < frame || ly < frame || lx >= inner + frame || ly >= inner + frame) return [frameValue, frameValue, frameValue, 255];
    const cx = lx - frame;
    const cy = ly - frame;
    const inGutterX = cx >= cell && cx < cell + gutter;
    const inGutterY = cy >= cell && cy < cell + gutter;
    if (inGutterX || inGutterY) return WHITE;
    const quadrant = (cx >= cell ? 1 : 0) + (cy >= cell ? 2 : 0);
    const base = [[200, 60, 40], [40, 160, 90], [50, 80, 200], [180, 150, 30]][quadrant];
    const shade = (cx * 3 + cy * 5) % 40;
    return [Math.min(240, base[0] + shade), Math.min(240, base[1] + shade), Math.min(240, base[2] + shade), 255];
  });
}

const model = (capabilities) => ({ id: 'm', capabilities });

export function collect(impl) {
  const result = {};
  result.constants = {
    videoModes: impl.videoModes,
    videoTabValues: impl.videoTabValues,
    videoTabKeys: impl.videoTabKeys,
    videoModeIcons: impl.videoModeIcons,
    mobileVideoModeOptions: impl.mobileVideoModeOptions,
    VIDEO_TAB_STORAGE_KEY: impl.VIDEO_TAB_STORAGE_KEY,
    videoModeOptions: impl.videoModeOptions,
    generationModeOptions: impl.generationModeOptions,
    generationModeCopyKeys: impl.generationModeCopyKeys,
    sceneSourceOptions: impl.sceneSourceOptions,
    referenceImageRoles: impl.referenceImageRoles,
    DEFAULT_MAX_STORYBOARD_SCENES: impl.DEFAULT_MAX_STORYBOARD_SCENES,
    HARD_MAX_STORYBOARD_SCENES: impl.HARD_MAX_STORYBOARD_SCENES,
    coreModelParameterNames: [...impl.coreModelParameterNames],
    referenceImageParameterAliases: impl.referenceImageParameterAliases,
    lastImageParameterAliases: impl.lastImageParameterAliases,
    referenceAudioParameterAliases: impl.referenceAudioParameterAliases,
    referenceVideoParameterAliases: impl.referenceVideoParameterAliases,
  };

  const modeInputs = ['image-to-video', 'text-to-video', 'people-video', 'motion-transfer', 'extend-video', 'nope', '', null];
  result.isActiveVideoTab = modeInputs.map((v) => impl.isActiveVideoTab(v));
  const generationModes = impl.generationModeOptions.map((o) => o.value).concat(['unknown']);
  result.videoModeRouteFeature = generationModes.map((m) => impl.videoModeRouteFeature(m));
  result.isSingleSceneGenerationMode = generationModes.map((m) => impl.isSingleSceneGenerationMode(m));
  result.isStorylinePromptMode = generationModes.map((m) => impl.isStorylinePromptMode(m));

  const properties = {
    aspect_ratio: { type: 'string', enum: ['16:9', '9:16', 'auto'], default: '16:9' },
    resolution: { type: 'string', enum: ['720p', '1080p'] },
    seed: { type: 'integer' },
    camera_fixed: { type: 'boolean' },
    generate_audio: { type: 'boolean' },
    prompt: { type: 'string' },
    mode: { type: 'string', enum: ['std', 'pro'], default: 'pro' },
  };
  const richModel = model({
    apiSchema: { request_schema: { properties, required: ['prompt', 'image'] } },
    supportedRatios: ['1:1', '4:5'],
    supportedAspectRatios: ['21:9', ' 3:4 '],
    parameters: ['a', 'b'],
    requiredParameters: ['x'],
  });
  const fallbackModel = model({ parameters: ['alpha', 'beta'], requiredParameters: ['alpha'] });
  const emptyModel = model({});

  result.parseSchemaEnumValue = [
    impl.parseSchemaEnumValue('', properties.resolution),
    impl.parseSchemaEnumValue('720p', properties.resolution),
    impl.parseSchemaEnumValue('480p', properties.resolution),
    impl.parseSchemaEnumValue('5', { type: 'integer', enum: [3, 5, 8] }),
    impl.parseSchemaEnumValue('9', { type: 'integer' }),
  ].map((v) => (v === undefined ? '__undefined__' : v));
  result.hasSchemaValue = [undefined, null, '', 0, false, [], [0], 'x', {}].map((v) => impl.hasSchemaValue(v));
  result.isCameraFixedParameter = [['camera_fixed'], ['cameraFixed'], ['x', 'Camera Fixed'], ['x'], ['x', undefined]].map(([n, t]) => impl.isCameraFixedParameter(n, t));
  result.isSeedParameter = [['seed'], ['Seed'], ['x', ' SEED '], ['seeds'], ['x']].map(([n, t]) => impl.isSeedParameter(n, t));
  result.modelParamsForGeneration = impl.modelParamsForGeneration(
    { aspect_ratio: '16:9', seed: 4, camera_fixed: true, cameraFixed: true, mode: 'pro', extra: 1 },
    { ...properties, extra: { type: 'integer', title: 'Seed' } },
  );
  result.schemaProperties = [richModel, fallbackModel, emptyModel, undefined].map((m) => impl.schemaProperties(m));
  result.requiredSchemaParameters = [richModel, fallbackModel, emptyModel, undefined].map((m) => impl.requiredSchemaParameters(m));
  result.modelFamily = ['Vendor/Model-X/image-to-video', 'vendor/model-x/video-extend', 'Vendor/Model-X/extend-video', 'vendor/model-x/text-to-video', ''].map((m) => impl.modelFamily(m));
  result.schemaDefault = [undefined, properties.aspect_ratio, properties.resolution, properties.camera_fixed, properties.seed, { type: 'string', default: 0 }].map((p) => {
    const v = impl.schemaDefault(p);
    return v === undefined ? '__undefined__' : v;
  });
  result.findSchemaProperty = [
    impl.findSchemaProperty(properties, ['aspectRatio', 'aspect_ratio']),
    impl.findSchemaProperty(properties, ['nope']),
    impl.findSchemaProperty({}, ['a']),
  ].map((v) => v ?? '__undefined__');
  result.modelAspectRatioOptions = [richModel, fallbackModel, emptyModel, undefined].map((m) => impl.modelAspectRatioOptions(m));
  result.closestAspectRatio = [
    [1.78, ['16:9', '9:16', '1:1']], [0.56, ['16:9', '9:16', '1:1']], [1, ['16:9', '9:16', '1:1']], [2.3, ['16:9', '21:9']],
    [1.2, []], [NaN, ['1:1']], [0, ['1:1']], [-1, ['1:1']], [1.5, ['auto', '4:3', '3:2']], [1, ['1:0']],
  ].map(([v, o]) => impl.closestAspectRatio(v, o) ?? '__undefined__');
  result.findModelInputParameter = [
    impl.findModelInputParameter(richModel, 'custom', ['mode']),
    impl.findModelInputParameter(richModel, undefined, ['mode']),
    impl.findModelInputParameter(richModel, undefined, ['nope']),
    impl.findModelInputParameter(fallbackModel, undefined, ['beta']),
  ].map((v) => v ?? '__undefined__');
  result.modelSpecificDefaults = [
    impl.modelSpecificDefaults(richModel),
    impl.modelSpecificDefaults(model({
      apiSchema: { request_schema: { properties: { ...properties, image: { type: 'string', default: 'x' }, custom_prompt: { type: 'string', default: 'p' }, duration: { type: 'integer', default: 5 } } } },
      promptParameter: 'custom_prompt',
    })),
    impl.modelSpecificDefaults(fallbackModel),
    impl.modelSpecificDefaults(undefined),
  ];
  result.formatHistoryDate = [undefined, '', 'nonsense', '2026-11-17T08:30:00Z', '2026-01-02T23:05:00Z'].map((v) => impl.formatHistoryDate(v));

  // Storyboard analysis on synthetic contact sheets.
  const plain = gutterSheet();
  const framed = gutterSheet({ margin: 9, frame: 4 });
  const blank = makeSheet(40, 30, () => WHITE);
  const transparent = makeSheet(40, 30, () => [10, 10, 10, 0]);
  const bigFramed = gutterSheet({ cell: 150, margin: 12, frame: 3 });
  const bigLightFramed = gutterSheet({ cell: 150, margin: 6, frame: 3, frameValue: 225 });
  // Alpha exactly at the visibility threshold, and a frame as wide as the largest trim the code allows.
  const alpha16 = makeSheet(60, 60, (x, y) => (x >= 10 && x < 50 && y >= 10 && y < 50 ? [200, 50, 50, 16] : WHITE));
  const bigFrame16 = gutterSheet({ cell: 380, margin: 0, frame: 16 });
  const sheetCases = { plain, framed, bigFramed, bigLightFramed, alpha16, bigFrame16, blank, transparent };
  const storyboard = {};
  for (const [name, { pixels, width, height }] of Object.entries(sheetCases)) {
    const content = impl.findStoryboardContentBounds(pixels, width, height);
    const trimmed = impl.trimStoryboardFrameBounds(pixels, width, height, content);
    storyboard[name] = {
      size: [width, height],
      content,
      trimmed,
      zoomed: impl.zoomStoryboardFrameBounds(trimmed),
      gapsX: impl.findStoryboardGaps(pixels, width, height, 'x'),
      gapsY: impl.findStoryboardGaps(pixels, width, height, 'y'),
      gridGapsX: impl.findStoryboardGridGaps(pixels, width, height, 'x', 2),
      gridGapsY: impl.findStoryboardGridGaps(pixels, width, height, 'y', 2),
      gridGapsX3: impl.findStoryboardGridGaps(pixels, width, height, 'x', 3),
      peaksX: impl.findStoryboardGridPeaks(pixels, width, height, 'x', 2),
      peaksY: impl.findStoryboardGridPeaks(pixels, width, height, 'y', 2),
      edges: ['left', 'right', 'top', 'bottom'].map((side) => [0, 1, 3].map((offset) => impl.storyboardEdgeStats(pixels, width, height, side, offset, content))),
    };
  }
  result.storyboard = storyboard;

  result.findLightRuns = [
    impl.findLightRuns([0, 0.8, 0.9, 0, 0, 0, 0.75, 0.8, 0.9, 0.7, 0], 2),
    impl.findLightRuns([0, 0.8, 0.9, 0, 0.9, 0.9, 0], 2),
    impl.findLightRuns(new Array(400).fill(0).map((_, i) => (i % 100 > 90 ? 0.95 : 0.1)), 5),
    impl.findLightRuns([0.9, 0.9, 0.9], 1),
    impl.findLightRuns([0, 0.8, 0.8, 0.8, 0, 0], 4),
    impl.findLightRuns([0.1, 0.2], 1),
    impl.findLightRuns([0.9, 0.9, 0.9, 0.9, 0.9, 0.9], 2, 2, 5),
    // Long axis: the tolerance for short breaks scales with the length (2 here), so a break of 5 splits the run.
    impl.findLightRuns(new Array(1000).fill(0).map((_, i) => (i >= 100 && i < 110) || (i >= 115 && i < 125) || (i >= 600 && i < 610) || (i >= 612 && i < 622) ? 0.9 : 0.1), 3),
  ];
  const gapSets = [[], [{ start: 5, end: 8 }], [{ start: 0, end: 3 }, { start: 10, end: 12 }], [{ start: 18, end: 20 }]];
  result.axisCells = gapSets.map((g) => impl.axisCells(20, g));
  result.evenlyDividedCells = [[10, 1], [10, 3], [7, 2], [0, 2], [5, 5]].map(([l, c]) => impl.evenlyDividedCells(l, c));
  return result;
}
