# Design QA — Usage & Credit

## Source visual truth

- Source: `docs/reference/MOCKUP CREDIT & USAGE - EOS CREATIVE STUDIO.png`
- Intended implementation: local route `http://localhost:3000/usage`
- Target viewport: 1600 × 1000 CSS px
- State: Overview tab, default billing cycle and Daily trend selections

## Comparison status

A fresh local browser render was captured at `http://localhost:3000/usage` and checked for the source composition and interaction states. The Overview, Usage Details, Credit History, Team Usage, and Billing & Plan tabs were each selected and verified to render their expected content without navigation errors. The compact 1280px browser viewport was also checked for responsive stacking; the source mockup remains the desktop geometry reference at 1600 × 1000. Exact pixel-level comparison at the source viewport is not claimed because the available browser capture was at a smaller viewport with an existing generation-progress overlay.

## Implementation checklist

- Two-column canvas with the summary and charts in the main column.
- Plan and recent activity rail aligned from the top of the content canvas.
- 1230px desktop content geometry with 874px main / 340px rail proportions.
- Sidebar ordering, hamburger/logo lockup, and usage active state aligned to the reference.
- Existing creative brush artwork reused for the plan/banner visuals.
- All five tabs have complete layouts with functional tab switching and period controls.

final result: passed — build, targeted lint, browser tab smoke test; pixel-perfect desktop QA not claimed
