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
- Page-specific JS budget target: `<= 6.5 kB` per dashboard route (고급 차트 포함)
- API summary TTFB target (local): `<= 1.5s` cold dev

### Current Baseline (from `next build`)

- First Load JS shared: `87.1 kB`
- `/dashboard`: `4.09 kB`
- `/dashboard/decisions`: `3.2 kB`
- `/dashboard/reports`: `3.94 kB`
- `/dashboard/runs`: `4.19 kB`
- `/dashboard/signals`: `5.84 kB`

### API TTFB Spot Check (local)

- `/api/agent/summary` TTFB: `0.127s`
- `/api/agent/signals/scored?scope=KR` TTFB: `0.126s`
- Budget pass: `<= 1.5s`

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

## Feature Validation (WS-Y)

- `npm run test:gui:features` passed
- 검증 항목:
  - 레이더 차트 값-원점수 매핑
  - 삼관왕 단계 상태-PASS/FAIL 매핑
  - VSI 구간 라벨 매핑
  - Flow 괴리 경고 조건
  - 리스크 태그 생성 규칙
  - Stacked Final score 정합성
  - KR 자동완성/필터 동작
  - Entry Trigger 트래커 렌더링
  - 모바일/태블릿/데스크톱 차트 카드 레이아웃
  - KR/US 스코프 분리 일관성
