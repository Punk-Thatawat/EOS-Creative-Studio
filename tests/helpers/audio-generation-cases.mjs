// Fixed inputs for the pure parts of the audio generation page (constants and helpers).
// `collect(impl, stubs)` returns plain JSON so the same cases can be recorded from the original page
// and compared with the extracted modules.

const model = (key, isActive = false) => ({ key, isActive, name: key });
const voice = (key, name, imageUrl) => ({ key, name, imageUrl });

export async function collect(impl, stubs) {
  const result = {};
  result.constants = {
    MIN_PODCAST_SPEAKERS: impl.MIN_PODCAST_SPEAKERS,
    podcastVoiceAvatarEntries: impl.podcastVoiceAvatarEntries,
    visibleTabs: impl.visibleTabs,
    ELEVENLABS_TEXT_TO_SPEECH_MODEL_KEYS: impl.ELEVENLABS_TEXT_TO_SPEECH_MODEL_KEYS,
    MINIMAX_TEXT_TO_SPEECH_MODEL_KEYS: impl.MINIMAX_TEXT_TO_SPEECH_MODEL_KEYS,
    AUDIO_TAB_STORAGE_KEY: impl.AUDIO_TAB_STORAGE_KEY,
    audioTabKeys: impl.audioTabKeys,
    audioModeIcons: impl.audioModeIcons,
    mobileAudioModeOptions: impl.mobileAudioModeOptions,
    tones: impl.tones,
    toneKeys: impl.toneKeys,
    voiceImages: impl.voiceImages,
    waveformBars: impl.waveformBars,
    AUDIO_HISTORY_LIMIT: impl.AUDIO_HISTORY_LIMIT,
    CLONE_HISTORY_SPEECH_SCAN_LIMIT: impl.CLONE_HISTORY_SPEECH_SCAN_LIMIT,
    VOICE_PAGE_SIZE: impl.VOICE_PAGE_SIZE,
    DEFAULT_AUDIO_PROMPT: impl.DEFAULT_AUDIO_PROMPT,
    defaultAudioScenes: impl.defaultAudioScenes,
    VOICE_CLONE_MODEL_ID: impl.VOICE_CLONE_MODEL_ID,
    MINIMAX_LANGUAGE_BOOST_OPTIONS: impl.MINIMAX_LANGUAGE_BOOST_OPTIONS,
    VOICE_CLONE_MODEL_OPTIONS: impl.VOICE_CLONE_MODEL_OPTIONS,
    SFX_MODEL_OPTIONS: impl.SFX_MODEL_OPTIONS,
    podcastSpeakerTones: impl.podcastSpeakerTones,
    defaultPodcastSpeakers: impl.defaultPodcastSpeakers,
    defaultPodcastLines: impl.defaultPodcastLines,
    audioSettingInfo: impl.audioSettingInfo,
  };

  result.getPodcastVoiceAvatar = [
    null,
    undefined,
    voice('jessica_1', 'Jessica', ''),
    voice('x', 'Old Laura Voice', ''),
    voice('x', 'Brian the host', 'https://cdn.example/brian.png'),
    voice('zzz', 'Unknown', ''),
    voice('OTTO', 'X', undefined),
  ].map((v) => impl.getPodcastVoiceAvatar(v));

  result.supportsMiniMaxSpeechTuning = [
    'minimax/speech-2.8-hd', 'MiniMax_speech_02', '  minimax/speech-x ', 'minimax/voice-clone', 'minimax/speech', 'eleven_v4', '',
  ].map((m) => impl.supportsMiniMaxSpeechTuning(m));

  const picks = (items) => impl.pickTextToSpeechModels(items).map((m) => m.key + ':' + m.isActive);
  result.pickTextToSpeechModels = [
    picks([]),
    picks([model('eleven_v4'), model('minimax/speech-2.8-hd')]),
    picks([model('eleven_v4'), model('elevenlabs/eleven-v4', true), model('MiniMax/Speech-2.8-HD')]),
    picks([model('elevenlabs/eleven-v4'), model('eleven_v4')]),
    picks([model('minimax/speech-2.8-hd')]),
    picks([model('other')]),
  ];

  result.formatSceneSeconds = [-5, 0, 0.4, 0.5, 9.6, 59.4, 60, 61, 125.5, 3599].map((s) => impl.formatSceneSeconds(s));
  result.formatCreditAmount = [0, 1, 12.3456, 1234567.891, -2.5].map((v) => impl.formatCreditAmount(v));
  result.formatAudioHistoryDate = [
    ['9:05', 'th'], ['12:30:45', 'en'], ['  8:15 ', 'th'], ['not a date', 'th'], ['2026-11-17T08:30:00Z', 'th'], ['2026-11-17T08:30:00Z', 'en'], ['', 'en'],
  ].map(([value, locale]) => impl.formatAudioHistoryDate(value, locale));

  stubs.events.length = 0;
  const key = impl.createAudioIdempotencyKey();
  const requestId = impl.startAudioProgress('text-to-speech');
  impl.finishAudioProgress('text-to-speech', 'req-1');
  impl.failAudioProgress('sound-effects', 'req-2');
  result.progress = { key, requestId, events: stubs.events.slice() };

  result.estimatePodcastLineSeconds = ['', '   ', 'a', 'x'.repeat(18), 'x'.repeat(100), ' สวัสดีครับ '].map((t) => impl.estimatePodcastLineSeconds(t));
  result.formatAudioFileSize = [0, 1, 1023, 1024, 1536, 1048575, 1048576, 5.5 * 1024 * 1024, 1e9].map((b) => impl.formatAudioFileSize(b));
  return result;
}
