# GUI Quality Report

## Accessibility

### Keyboard Navigation

- Sidebar navigation is `Link`-based and keyboard-focusable.
- All action controls are native `button` / `input` / `select`.
- Added skip link: `Skip to content`.
- Added ESC close behavior for auth modal.
- Added keyboard row selection in scored signals table (`Enter` / `Space`).

### Focus and Semantic States

- Global focus ring added via `:focus-visible`.
- Loading/empty/error states now expose screen-reader semantics:
  - loading: `role="status"`, `aria-live="polite"`
  - empty: `role="status"`, `aria-live="polite"`
  - error: `role="alert"`, `aria-live="assertive"`
- Added screen-reader captions to signals tables.

### Contrast Review

- Primary text: `--text #e6ecf5` on dark background.
- Secondary text: `--muted #b6c0d0` improved for safer contrast.
- Focus indicator uses accent color and clear outline.
- Badge variations keep high-contrast foreground/background pairing.

## Performance

### Initial Budget

- First Load JS shared budget target: `<= 95 kB`
- Page-specific JS budget target: `<= 3.5 kB` per dashboard route
- API summary TTFB target (local): `<= 1.5s` cold dev

### Current Baseline (from `next build`)

- First Load JS shared: `87.1 kB`
- `/dashboard`: `2.61 kB`
- `/dashboard/decisions`: `2.96 kB`
- `/dashboard/reports`: `2.50 kB`
- `/dashboard/runs`: `2.77 kB`
- `/dashboard/signals`: `2.95 kB`

### Large List Rendering

- Decisions: page-size pagination.
- Runs/Reports/Signals: progressive rendering with `Load More` controls.
- API supports pagination (`limit`, `offset`) with `meta.total`.

## Monitoring

### Web Vitals

- Client probe added: `app/_components/web_vitals_probe.tsx`
- Captured metrics are posted to `/api/telemetry/event`.
- Events include metric name/value/rating and current path.

### User Flow Telemetry

- Event tracking added for:
  - page views (`/dashboard*`)
  - token save/clear
  - trigger success/failure
  - filter changes (decisions/reports/runs/signals)
- Event sink: `POST /api/telemetry/event` (server logs)

## Verification Commands

```bash
npm test
npm run build
npm run test:gui
```

## Automated GUI Test Result (Latest)

- `npm run test:gui` passed
- Browsers: Chromium + WebKit
- Viewports: `390x844`, `768x1024`, `1280x800`
- Axe WCAG (`wcag2a`, `wcag2aa`) violations: `0` on all tested dashboard routes
- E2E scenarios validated:
  - token save -> trigger run -> cockpit update
  - decision filter -> related signal drilldown
  - unauthorized recovery flow (clear token -> auth modal)
  - scored signal trace view
