# Home Page Implementation

## Scope

The authenticated Home page is implemented at `/home`. The root route redirects to `/home`, and the former `/dashboard` route redirects there as well. Home is an action-oriented creative workspace, not an analytics or administration dashboard.

## Reference elements reproduced

- Three-column authenticated composition: left navigation, central creative workspace, and compact right utility rail.
- Warm white surfaces, near-black typography, orange primary accent, pink/yellow secondary accents, subtle borders, and soft shadows.
- Editorial hero banner with bold headline, primary creation CTA, template CTA, and original CSS collage shapes.
- “Create with AI” tool grid for Image, Video, AI Presenter, Audio, Document, and Custom Workflow.
- Horizontal recent-project cards with project type, status, owner, update time, and progress when available.
- Curated template gallery and secondary quick-tools row.
- Right rail cards for credits, active jobs, activity feed, and a compact creative slogan.

## Intentional deviations

- The reference artwork is not used as a background or bitmap layer. Hero, project, and template visuals are original CSS compositions and abstract color blocks.
- No remote images or copyrighted people, logos, advertisements, or product photography are included.
- The shown data is typed local mock data. Progress values are only displayed for mock jobs/projects that explicitly provide them; queued jobs use meaningful status labels instead.
- Authentication, database queries, real jobs, credits, projects, and activity are deferred to their feature integration phases.

## Component structure

```text
src/app/(home)/layout.tsx
src/app/(home)/home/page.tsx
src/components/app-shell/
  home-shell.tsx
  mobile-navigation.tsx
  navigation.tsx
src/features/home/
  components/
    home-header.tsx
    home-hero.tsx
    creative-tool-grid.tsx
    creative-tool-card.tsx
    recent-projects.tsx
    project-card.tsx
    template-gallery.tsx
    template-card.tsx
    quick-tools.tsx
    home-utility-rail.tsx
  data/
  types/home.ts
```

## Responsive behavior

- Desktop widths retain the sidebar, fluid center, and utility rail.
- The main content remains `min-width: 0` and project cards scroll horizontally where appropriate.
- Below the desktop breakpoint the sidebar becomes a slide-over mobile navigation.
- The utility rail is hidden on smaller screens so the main creative actions stay dominant.
- Creation cards and quick tools collapse into two-column and single-column layouts without page-level horizontal overflow.
- Interactive controls use comfortable touch targets and visible focus rings.

## Accessibility decisions

- Semantic `header`, `nav`, `main`, `section`, `aside`, links, labels, and headings are used.
- Navigation and icon-only buttons have accessible labels and `aria-current` where appropriate.
- The mobile menu exposes expanded state, has a close button, and includes a backdrop close action.
- Decorative visual elements are marked `aria-hidden`; meaningful actions use text labels.
- Global focus-visible styles are retained through the EOS token system and shadcn/ui foundation.

## Future integration points

- Replace local project data with the Projects repository and workspace authorization checks.
- Replace active job data with Generation application service state and webhook-driven updates.
- Replace credits mock data with the Credits ledger read model.
- Replace activity mock data with the Activity module feed.
- Add real private storage thumbnails through the Storage provider abstraction.
- Add authenticated search and accessible command menu behavior to the header search field.
