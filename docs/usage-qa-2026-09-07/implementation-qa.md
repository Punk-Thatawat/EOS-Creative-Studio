# Usage redesign — implementation QA

7 September 2026. Scope: implement the approved Creative Pulse design in the existing Next.js application, preserving real usage API and Stripe PromptPay checkout. No production payment or manual credit change was made.

## Visual evidence

- Source: [approved-design.png](approved-design.png).
- Desktop: [16-desktop-final.png](16-desktop-final.png), CSS viewport 1488 × 1058. Source pixels: 1487 × 1058; captured content pixels: 1473 × 1048 (browser capture excludes chrome/scrollbar strips). Comparison normalizes both to 1488 × 1058; the approximately 1% scaling difference is not treated as a fidelity defect or exact pixel match.
- Full side-by-side: [17-comparison-final.png](17-comparison-final.png).
- Readable focused comparison of balance, tabs, graph and transactions: [17-comparison-final-focus.png](17-comparison-final-focus.png).
- Responsive: [11-mobile-overview.png](11-mobile-overview.png), 390 × 844; [15-tablet-overview.png](15-tablet-overview.png), 768 × 1024. No page-level horizontal overflow in measured viewports.
- Empty previous month: [14-empty-mobile.png](14-empty-mobile.png).
- New checkout reaches [13-stripe-qr-redesign.png](13-stripe-qr-redesign.png) in Stripe Sandbox.

## Comparison history and fidelity

1. First comparison: [12-comparison-first.png](12-comparison-first.png). P2: hero too tall pushed the tool strip below the viewport; transaction icons too small. Fixed hero frame from natural 3:1 to a 3.35:1 bounded frame, trimmed white margin without distorting the image, enlarged transaction icons and increased row text to 14px. Reordered tool strip Image, Video, Audio first. Restored desktop account menu in the sidebar footer after hiding the original top header for the approved layout.
2. Final comparison: full and focused images above. No remaining actionable P0/P1/P2 visual issue in reviewed viewports. P3 differences: generated hero collage is not pixel-identical; existing project tool icons are colored rather than white-on-black; separator is a clean orange rule instead of the rough paint edge; secondary tool categories continue below the three primary tools. These preserve the product's existing icon system and functional data rather than rasterizing the mock.

Required fidelity surfaces:

- **Typography:** the display heading and Thai underline are part of generated hero artwork; a semantic H1 provides accessible text. Body uses project Noto Sans Thai; balance uses Kanit. No fake graphic heading made from CSS. Small timestamps remain secondary; mobile controls stay reachable.
- **Spacing/layout:** same left navigation, editorial hero, single balance row/CTA, tabs, graph beside activities and tool strip. Stacks on mobile/tablet with no clipping of financial data. Additional six-tool data is intentionally retained below the first row.
- **Colors:** white, black, orange and hot pink match the selected direction. Positive credits use green; error states are distinguishable and labelled. Focus outlines are explicit. This is not a full WCAG certification.
- **Image quality:** new header asset generated from the actual selected image, stored in public/generated-assets/usage-creative-pulse-hero.png. Existing project raster icons reused. All page images completed loading with nonzero natural dimensions. Header imagery is decorative with semantic title equivalent.
- **Copy/content:** live balance 9,898, current-period use 102 and additions 10,000; no old May fixtures, fake plan, unsupported expiry or percentage. Admin additions are labelled admin adjustments. Stripe grants recognized by stripe_checkout reference. Success query is never treated as confirmed payment.

## Functional checks

| Test | Result |
| --- | --- |
| Current balance / overview / recorded transaction balance | PASS: 9,898 and real September transactions |
| Previous month | PASS: August reports zero activity; current wallet remains clearly labelled available balance |
| Loading | PASS: placeholders, no demo balance |
| View all | PASS: activates history and focuses its tab |
| Search / no matches | PASS: real loaded transactions filtered; empty result disables export |
| Credit increase filter | PASS: only +10,000 admin grant visible |
| Detail expansion | PASS: actual ID and recorded balance shown |
| CSV | Click exercised; generator tested for BOM, escaping, formula protection and recorded balances. Browser file contents were not separately inspected |
| Keyboard tabs | PASS: ArrowRight switches selection and focus; Home/End implemented |
| Package selection | PASS: 5,000 credits selects ฿4,500 summary; unselected checkout is disabled |
| Checkout / duplicate click controls | PASS: 1,000 selected -> Sandbox THB 1,000 -> PromptPay QR; tabs and package choices disabled during submission |
| Cancellation return | PASS: returns to local page, neutral notice, balance still 9,898; no build error |
| Success URL without payment | PASS: neutral waiting notice, no credit increase claimed; polls for 30 seconds then offers retry |
| Search while polling | PASS: AI Image search and input focus persisted across background polling |
| Manual refresh | PASS: expanded transaction details and search persisted |
| Team Usage | PASS: only four requested tabs remain |
| Desktop/tablet/mobile | PASS in 1488/768/390 CSS widths; controls readable and no page-level horizontal overflow |
| Final reload console | PASS: no new error entries. Earlier temporary missing-module errors during file replacement are historical and resolved |

## Independent static QA

QA subagent identified and re-reviewed three P2 issues, all fixed:

1. Poll/manual refresh remounting the ledger: now a stable period/tab key and refresh prop; existing history stays mounted through dashboard refresh/errors, loaded pages update without discarding filters/focus.
2. Switching tabs during pending checkout: page-level busy state disables tab/CTA navigation; synchronous ref prevents repeated submissions.
3. Negative expiry/adjustment mistaken for consumption: usage details filter transactionType=usage; generic history debit filter is labelled credit decrease.

Final independent review: no remaining P1/P2 findings in the reviewed fixes. Static review is not a substitute for the browser checks listed above.

## Automated verification

- npm run build: passed (30 routes).
- npx tsc --noEmit: passed.
- Targeted ESLint for usage page, utilities and API helper: passed.
- node scripts/usage-qa.mjs: 10 checks passed (zero/negative chart domain, decimal signs, transaction labels, CSV and date-window handling).
- git diff --check: no whitespace errors; existing Windows line-ending warnings only.

## Limits / follow-up

- Payment completion -> webhook -> credit delivery, delayed-webhook behavior and duplicate webhook replay were **not** executed end-to-end in this redesign run. Test reached QR and returned without paying. Do not call billing fully end-to-end verified.
- No injected live API outage/auth expiration test. Recovery branches and cancellation guards were reviewed statically, not all fault-injection cases were exercised.
- Multi-page history is implemented but current account has five items; 51+ record boundary cases were not live-tested.
- Backend pre-existing aggregation of multiple features mapping to one tool, empty-page total and timestamp tie ordering remain outside this frontend redesign. They need backend regression coverage before broad billing QA sign-off.
- Existing dirty unrelated files and earlier QA sections were preserved. No credentials/environment values were changed.

final result: passed

This result applies to the reviewed frontend design and tested interactions only, not complete payment-system certification.
