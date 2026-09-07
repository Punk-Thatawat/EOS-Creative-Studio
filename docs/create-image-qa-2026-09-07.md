# Image completion QA — 2026-09-07

## Scope and results

Ran the actual React generation hook in isolated headless Edge, with mocked API completion events. No provider calls or credit spending. All 18 scenarios passed; TypeScript `tsc --noEmit` passed. The live authenticated Create Image page also opened and displayed its existing generated result.

| Feature | Fresh completion | Session resume | History rediscovery |
| --- | --- | --- | --- |
| Text to Image | PASS | PASS | PASS |
| Image to Image | PASS | PASS | PASS |
| AI Background | PASS | PASS | PASS |
| Upscale | PASS | PASS | PASS |
| Extend Image | PASS | PASS | PASS |
| AI Style Transfer (currently hidden) | PASS | PASS | PASS |

Each automated case selects an old result while waiting, delivers a completed job, then asserts the new output URL is present, processing has stopped, the old selection is cleared, and no browser runtime errors occurred.

## Fixes

- Added background job resume state/effect; background and upscale jobs can be rediscovered from history.
- Clear stale recent-image selection when new outputs arrive for the active feature.
- Switch gallery back to current output and close stale fullscreen/compare overlays when fresh outputs arrive.
- Align Extend preview, download and fullscreen URLs; resolve fullscreen indices after filtering failed images.
- Add an explicit image-load retry action.
- Keep local solid-background composition processing until its final asset is ready; avoid publishing the provider cutout as final and ignore cancelled final composition results.

## Limitations

These are browser-hook integration tests, not paid end-to-end provider runs or complete visual assertions. Actual provider latency, CDN image decoding, local solid-background canvas composition, download/fullscreen interactions and every model-specific configuration still require live end-to-end validation. The component changes were reviewed by a separate QA agent and typechecked.

## Re-run

Run `node scripts/qa-image-completion.cjs` from the frontend repository. This local QA harness uses the installed backend esbuild and bundled Playwright runtime paths declared at its top; adjust those paths on another machine.
