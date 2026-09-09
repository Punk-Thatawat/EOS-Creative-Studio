# Design QA — Assets creative universe (2026-09-07)

## Evidence and comparison

- Source: `C:/Users/Thatawat.T/AppData/Local/Temp/codex-clipboard-3b90ea60-1ac8-4545-a796-8fb2f4481c9e.png` (1487 × 1058).
- Route: http://localhost:3000/assets, authenticated, All types, grid, five real assets.
- Desktop: `docs/assets-design/desktop-final.png`, CSS viewport 1487 × 1058, screenshot 1472 × 1048 (browser capture excludes scrollbar/edge pixels). Source and implementation opened together in one comparison tool result; no pixel-perfect claim.
- Mobile: `docs/assets-design/mobile-final.png`, CSS viewport 390 × 844. Tablet: `docs/assets-design/tablet-final.png`, CSS viewport 900 × 900; tablet capture has browser scaling artifacts, so DOM overflow was separately measured.
- Desktop and mobile content have no horizontal overflow. All five image elements finished loading successfully.
- Full-view and readable hero/card regions inspected together; separate crops were unnecessary at desktop resolution.

## Comparison history

1. P2: duplicated old type/folder/tag dropdowns pushed toolbar onto another row. Removed duplicates; folder/tag management retained in compact disclosure.
2. P2: heavy synthesized heading weight and old sidebar width differed from reference. Changed display weight/condensation and scoped sidebar width to 220px on assets only. Post-fix evidence: desktop-final.png.
3. Temporary hot-reload errors during editing (stylesheet creation order and removed preview helper) were fixed. TypeScript and ESLint pass; subsequent reloads and preview interactions succeeded. Console history retains these two earlier errors; no new error appeared during final interactions.

## Required fidelity surfaces

- Typography: condensed Impact display with Thai body font from existing EOS system. Headline wrapping and hierarchy match; exact generated mock font cannot be recovered (minor residual difference).
- Spacing: full-width header/logo, 220px sidebar, hero left text/right art, three-column grid and compact pills. Compact folder disclosure intentionally preserves existing management functionality absent from mock.
- Colors: white canvas, black headline/selected pill, orange and pink artwork/accent, light neutral borders; existing EOS icons and logo reused.
- Images: custom generated collage placed as a WebP asset, no screenshot-as-UI. Cards use real API images with top alignment, not invented mock gallery content.
- Copy: approved heading/subtitle retained. System-like titles receive a neutral display fallback; original asset records are unchanged. Missing authored titles are not replaced with invented image descriptions.

## Functional QA

- Header search -> empty results -> keyboard clear -> all five items returned.
- Video filter -> empty state; All filter -> five items restored.
- Grid/list toggles; open image preview; close preview: passed.
- Desktop/mobile/tablet width checks: passed.
- `npx tsc --noEmit`, scoped ESLint, `git diff --check`: passed.
- Destructive actions, downloads, and media playback for nonexistent audio/video assets were not executed; existing handlers retained.

## Follow-up polish

- P3: authored asset names would improve distinction between legacy system-prompt-titled outputs.
- P3: generated hero varies slightly in portrait/ribbon placement; art direction and composition are preserved.

final result: passed

# Design QA — Video Thai localization final pass (9 September 2026)

## Evidence

- Implementation route: `http://localhost:3000/create/video?qa=thai-audit-final`.
- Browser state: Thai locale selected by default; fresh browser tab and full reload used for the final pass.
- Video tabs checked: Image to Video, Text to Video, People Video, Motion Transfer, Lipsync, and Extend Video.
- Nested states checked: generation-mode menu, model-driven settings, schema dropdown values/descriptions, result library, credit estimate empty/loading states, and video-player controls.

## Verification

- Provider schema labels and descriptions are routed through the shared key-based video schema copy helper, including resolution, seed, mask image, reference audio/video, and output-resolution guidance.
- The credit panel now explains the required action in Thai, including `อัปโหลดรูปภาพหรือวิดีโอเพื่อดูเครดิตโดยประมาณ` and model-selection guidance.
- Model and provider names remain unchanged; user-facing labels, descriptions, validation messages, controls, and accessible names are translated.
- The Thai prompt guidance uses a real localized raster asset (`public/generated-assets/be-descriptive-th.png`); the original English artwork is retained for English locale and embedded brand artwork remains unchanged.
- Fresh-tab console check returned no errors after the final reload.

## Verification results

- TypeScript: passed (`npx tsc --noEmit`, also completed during production build).
- Production build: passed (`npm run build`).
- Targeted ESLint: passed.
- `git diff --check`: passed; only existing line-ending warnings were reported.

final result: passed

# Design QA — Video Thai localization follow-up (9 September 2026)

## Evidence

- Local route checked: `http://localhost:3000/create/video?qa=thai-audit-before`.
- Responsive in-app browser viewport: approximately `694 × 698` CSS px.
- Accessibility tree and visual screenshots checked after the final code changes.

## Verification

- All six video tabs were opened: Image to Video, Text to Video, People Video, Motion Transfer, Lipsync, and Extend Video.
- Visible labels, descriptions, upload guidance, prompt helpers, settings, credit states, result-library states, validation copy, and accessible labels render in Thai by default.
- The Image to Video mode menu was opened and all generation modes were confirmed translated.
- People Video now explains the empty credit state in Thai: upload media first to see the estimated credits, then choose a People Video model.
- Decorative prompt guidance is rendered as Thai text and uses the Noto Sans Thai font family; model/provider names remain unchanged.
- No console errors observed while switching tabs. TypeScript, targeted ESLint, production build, and `git diff --check` passed.

## Limits

- Real media upload and provider generation were not run because the local QA state has no configured model/session inputs. Dynamic provider-supplied descriptions may still reflect the provider configuration.

## Final result

final result: passed

---

# Previous QA report — Extend Image preview (preserved)

## Evidence

- Source visual truth: `C:\Users\Thatawat.T\AppData\Local\Temp\codex-clipboard-f5596ece-94d6-4b29-b7c2-8f2a6d269e71.png` (user-provided Extend Image screen with an uploaded source image, 1591 × 881 px).
- Implementation route: `http://localhost:3000/create/image?tab=extend-image`.
- Implementation screenshot: CUA browser capture displayed inline during QA; it was not persisted to a local file.
- Implementation viewport: Codex in-app browser, responsive desktop viewport; exact CSS viewport was not exposed by the browser surface.
- State: Extend Image tab, no authenticated source upload in the QA browser session. The uploaded-source composition state from the source visual could not be reproduced without signing in.

## Comparison

- The source visual was opened and inspected at its native 1591 × 881 px dimensions.
- The implementation was opened and captured in the selected in-app browser at the Extend Image route.
- Focused-region comparison was not completed because the source-image state was unavailable in the implementation session.

## Findings

- The implementation change separates the uploaded source image into an explicit source frame and a new-area frame.
- The new-area share now follows the selected amount: 25% → 20% of the output frame, 50% → one third, and 100% → one half.
- The Extend Image outer preview stays fixed at 16:9; the selected output ratio controls the measured composition inside it, while direction and amount control how the source and new area are divided.
- The preview no longer lets a model preview or placeholder replace an uploaded source composition.
- The composition now uses the source image's natural aspect ratio and is sized as a single unit, so the striped percentage area touches the source image without an internal black gap.
- The source image is constrained to its frame with explicit `width: 100%`, `height: 100%`, and `object-fit: contain`, preventing the previous crop/zoom caused by incomplete absolute sizing.

## Verification

- TypeScript: passed (`npx tsc --noEmit`).
- Production build: passed (`npm run build`).
- Targeted ESLint: passed with one pre-existing warning for the unused `setBackgroundPreviewMode` state setter in `preview-panel.tsx`.
- Full ESLint: existing unrelated errors remain in admin model routes and audio generation files.

## Comparison history

1. Before: the source image element used direction-specific absolute positioning without an explicit frame height, and the preview could prefer a model preview/placeholder over the uploaded source.
2. Fix: added a dedicated source frame, explicit contained image sizing, amount-aware layout variables, a fixed outer preview with a measured inner composition, and source-image precedence.
3. After: the empty Extend Image route rendered without runtime errors in the in-app browser; the uploaded-source visual comparison remains unavailable because the browser session is unauthenticated. The source-composition layout is implemented using a measured canvas and the selected output ratio.

## Final result

final result: blocked

Blocker: the implementation browser session is not authenticated, so the uploaded source-image state shown in the reference cannot be captured for a same-state visual comparison.

# Design QA — Settings bilingual redesign

## Evidence

- Source visual truth: `C:\Users\Thatawat.T\AppData\Local\Temp\codex-clipboard-d1e3e789-7a85-45e1-94f4-51e7117428dc.png` (user-provided EOS Settings reference).
- Implementation route: `http://localhost:3000/settings`.
- Implementation screenshots: Codex in-app browser captures at desktop `1265 × 712` and responsive `664 × 696` CSS viewport captures, shown inline during QA.
- Primary comparison state: Settings page, Thai locale, top of page with the language section visible.
- Interaction states checked: English locale, saved state, Security anchor, Notifications section, email notification off state.

## Comparison

- The source reference and the final Settings implementation were inspected together as the comparison input.
- The implementation keeps the EOS visual language from the reference: white canvas, orange accent, rounded cards, soft borders, compact right rail, and existing EOS navigation.
- The redesign improves information hierarchy with a sticky section index, a dedicated language card, clearer row-level settings, and explicit save feedback while remaining responsive at the narrow viewport.

## Findings

- Thai is the default locale and the root document now starts with `lang="th"`.
- The Settings screen includes a Thai/English segmented control; the selected language updates the page copy and document language.
- `Noto Sans Thai` is declared as the interface font in the language section and remains the app's existing sans token.
- Workspace name, project starting point, authentication, active sessions, and three notification preferences are surfaced in one scannable flow.
- Section navigation scrolls to the selected card and updates its active state.
- Save feedback changes from `บันทึกการเปลี่ยนแปลง` / `Save changes` to the saved state; the preference is stored locally and syncs to `PATCH /api/v1/users/me` when an access token is available.
- Responsive layout collapses the left index into a horizontal section bar and keeps controls usable without clipping.

## Verification

- TypeScript: passed (`npx tsc --noEmit`).
- Production build: passed (`npm run build`).
- Targeted ESLint for Settings files: passed.
- Full ESLint: existing unrelated errors remain in `src/app/admin/model-routes/page.tsx` and `src/features/create/audio-generation/components/audio-generation-page.tsx`; warnings also remain in pre-existing files.
- Browser runtime logs: no errors observed for the Settings route.

## Final result

final result: passed

# QA — Preserve dynamic model names

## Finding and fix

- Dynamic values supplied by the API, including model names and voice model names, must remain provider-owned labels and must not be passed through Thai word substitution.
- Added `preserveLabel` / `preserveDescription` support to the shared `Dropdown` component and marked model/voice model labels as non-translatable.
- UI labels around those values continue to use the key-based dictionary.

## Verification

- The selected model label and dropdown option labels are rendered under `data-no-translate`.
- The Image, Video, and Audio model selectors now preserve provider names while localizing their surrounding labels.
- TypeScript: passed (`npx tsc --noEmit`).

## Final result

final result: passed

# QA — Hydration mismatch fix

## Finding and fix

- The reported mismatch was caused by the legacy DOM translation observer changing an image `alt` attribute before nested client components completed hydration.
- The observer is now gated until after hydration and no longer mutates React-owned DOM during the hydration window.
- Key-based components render their localized text through `t(key)` during React render, so they remain deterministic between server and client.

## Verification

- Reloaded `/create/image?qa=hydration-fix` in the in-app browser after the change.
- Image tabs, AI Background mode labels, upload helper text, image settings, and Thai shell labels rendered normally.
- No Next.js hydration overlay or runtime error was observed.
- TypeScript: passed (`npx tsc --noEmit`).

## Final result

final result: passed

# i18n architecture — key-based migration

## Implementation

- Added the typed source-of-truth dictionary at `src/lib/i18n/dictionary.ts` with separate `en` and `th` messages and compile-time key parity.
- Extended `useLocale()` with `t(key, params)` and interpolation support.
- Migrated shared shell copy, Settings copy, generic Create forms, Image tabs/background tools, Video tabs/generation modes, and Audio tabs/tones to stable translation keys.
- Kept the legacy rendered-copy adapter as a temporary compatibility fallback for older feature components that still contain hardcoded strings; it does not replace the typed dictionary for migrated UI.

## Verification

- TypeScript: passed (`npx tsc --noEmit`).
- Production build: passed after the key-based changes (`npm run build`).
- Browser smoke check: Thai key-based copy confirmed on AI Presenter and Video routes; English persistence was previously verified across navigation.

## Final result

final result: passed

# Design QA — All Create tabs and feature localization

## Evidence

- Implementation routes checked: `/create/image`, `/create/video`, `/create/audio`, `/create/ai-presenter`, `/create/document`, and `/create/workflow`.
- Browser state: Thai locale selected by default; responsive in-app browser viewport approximately `694 × 698` CSS px.
- Interaction states checked: all Image/Video tabs, Audio tools and settings, generic Create feature forms, empty/loading/error copy, accessibility labels, and English locale persistence across routes.

## Verification

- Thai copy is applied across the shared shell and Create surfaces through the central locale provider, including legacy feature UI, tabs, fields, controls, validation messages, empty states, previews, and tooltips/accessible labels.
- Image tabs verified: Text to Image, Image Remix, AI Background, Upscale, and Extend Image.
- Video tabs verified: Image to Video, Text to Video, People Video, Motion Transfer, Lipsync, and Extend Video.
- Audio tools verified: Text to Speech, Podcast & Dialogue, Voice Clone, Sound Effects, and Voice Cleaner, including tone, language, format, speed, history, and preview controls.
- AI Presenter, Document, and Workflow routes render their headings, descriptions, models, aspect-ratio options, cost messaging, and save actions in Thai.
- Switching to English and saving restores English shell and feature copy after navigation; Thai was restored as the final persisted locale.
- Embedded raster artwork may retain its original English lettering; DOM labels and alternative text are localized.
- No runtime errors observed while loading routes or switching feature tabs.

## Verification results

- TypeScript: passed (`npx tsc --noEmit`).
- Production build: passed (`npm run build`, 30 routes generated).
- `git diff --check`: passed; only existing line-ending warnings were reported.

## Final result

final result: passed

# Design QA — Global shell localization follow-up

## Evidence

- Implementation route: `http://localhost:3000/settings`.
- Browser state: Thai locale selected in Settings; responsive viewport `694 × 698` CSS px for the mobile shell check.
- Verified surfaces: header search and credits, account menu, mobile navigation drawer, Settings content, and the shared locale provider.

## Verification

- Thai switch updates the Settings content, document language, header search labels, credits label, account menu labels, and mobile navigation labels in one state change.
- English switch restores the corresponding English shell and Settings copy.
- Account menu exposes the localized accessible name and logout action.
- Initial runtime error caused by using the locale hook from a server-rendered right rail was fixed by making the right rail a client component; the route then loaded normally.
- TypeScript: passed (`npx tsc --noEmit` after the workspace's concurrent admin change settled).
- Production build: passed (`npm run build`).
- Targeted ESLint: passed with one pre-existing warning for the unused `AdminFeatureNavigation` in `navigation.tsx`.
- Browser accessibility snapshot: localized labels confirmed for Thai navigation, search, account menu, Settings controls, and notification switches.

## Final result

final result: passed

# Design QA — Usage Creative Pulse redesign (7 September 2026)

Templates follow-up (7 September 2026): see [Templates implementation QA](docs/templates-qa-2026-09-07/implementation-qa.md) and [source/implementation comparison](docs/templates-qa-2026-09-07/07-comparison.png). Desktop/mobile/tablet reviewed, tablet overflow fixed, builds and backend tests passed. Actual audio/video playback remains pending real Preview URLs; this is not an unconditional media QA pass.

Source visual truth: `docs/usage-qa-2026-09-07/approved-design.png`.
Implementation: `docs/usage-qa-2026-09-07/16-desktop-final.png`, local `/usage`, signed-in September 2026, available credits 9,898.
Viewport: 1488 × 1058 CSS px; source 1487 × 1058 pixels, implementation content capture 1473 × 1048 pixels excluding browser strips; both normalized to 1488 × 1058 for composition comparison (approximately 1% scale difference, not an exact-pixel claim). Responsive checks: 768 × 1024 and 390 × 844.
Full comparison: `docs/usage-qa-2026-09-07/17-comparison-final.png`; focused data-region comparison: `docs/usage-qa-2026-09-07/17-comparison-final-focus.png`.

See [complete findings, comparison history, required fidelity surfaces and test limits](docs/usage-qa-2026-09-07/implementation-qa.md).

First P2 visual findings (hero height and icon size) were fixed and re-captured. Independent static QA P2 findings (refresh remount, checkout lock lifetime and debit semantics) were fixed and re-reviewed. No remaining P0/P1/P2 in this frontend review; generated collage/icon/separator differences are P3 polish.

Build, TypeScript, targeted ESLint and 10 data-helper checks passed. Browser verified real balance, history/search/filter/detail actions, keyboard tabs, package selection, Sandbox QR, cancellation return, neutral success-query handling and state-preserving refresh. No new console errors after final reload. No real payment made; payment completion/webhook credit delivery and outage/large-pagination cases remain explicitly unverified.

final result: passed
