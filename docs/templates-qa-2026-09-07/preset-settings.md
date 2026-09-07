# Template preset settings

Added migration 0097 (applied locally), persisted settings JSON, admin snapshot display and original-work settings import. Older templates retain empty settings until the administrator reselects a work and saves it. No existing template records were changed automatically.

Generation settings use an explicit allowlist; server/provider prompts, account/workspace IDs and idempotency keys are excluded. New image/video requests retain the original settings separately from provider input. This metadata is removed before provider submission. Legacy records use known provider field mappings; fields never recorded cannot be recovered.

Frontend restores model first, followed by settings on image, standard video, text video, people video, extend video, motion transfer and TTS workspaces. Restores supported dimensions, parameters and remote source references; image output is not substituted for its source. Unavailable models/voices alert rather than silently choosing replacements. Selection never submits a paid generation.

Verified: frontend production build, latest TypeScript, backend build, 9 backend tests, targeted settings-hook ESLint. No paid generation performed. Complete preset save → reopen → generation checks across all media modes remain unverified. Temporary source URLs are not copied to permanent public storage. Advanced audio dialogue workflows and every model-specific parameter combination are not end-to-end verified. Native storyboard scene prompts/settings are reused from pre-provider scene records.
