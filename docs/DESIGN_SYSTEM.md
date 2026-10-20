# Design System

The visual direction ("Linen & Cyanotype") and its references are in
`docs/DESIGN_REFERENCES.md`. This file is how the system is built and used.

## Package layout — `@lintel/design-system`

| Export | What | Who imports it |
|---|---|---|
| `./tokens` | Colours (light/dark), status colours, type scale, radius, elevation, spacing, motion, breakpoints. Plain TypeScript, compiled to CommonJS in `dist/`. | Web **and** mobile. Mobile must import nothing else. |
| `./theme.css` | Generated at build time from the tokens (`scripts/write-theme-css.mjs` → `dist/theme.css`). | Web (`globals.css`). |
| `./components.css` | Small handwritten CSS: popover keyframes keyed to Radix data attributes, skeleton shimmer, blueprint grid, hatching, stretched links. | Web (`globals.css`). |
| `./web` | React DOM components, consumed **as TypeScript source** through Next `transpilePackages`. | Web only. |

**Why `./web` ships as source:** one Tailwind scan and one compiler for the app and
its components, no second build to keep in sync, and the components cannot drift from
the theme they are styled with. The cost is that only bundlers that transpile workspace
packages (Next) can use them, which is the only consumer by design. Add the folder to
Tailwind with `@source` (see `apps/web/src/app/globals.css`).

## Theme CSS (no hand-copied values)

`src/theme-css/build-theme-css.ts` turns the tokens into one stylesheet:

- `@theme inline` maps Tailwind names to runtime variables: `bg-canvas`, `bg-surface`,
  `bg-raised`, `bg-sunken`, `border-hairline`, `border-rule`, `text-ink`,
  `text-ink-muted`, `text-ink-faint`, `bg-accent`, `text-on-accent`, `bg-blueprint`,
  status colours `text-on-track` / `bg-on-track-tint` / `bg-on-track-solid` (and
  `at-risk`, `blocked`, `overdue`, `review`, `done`), project swatches `bg-swatch-0…5`,
  shadows `shadow-e1…e4`. Tailwind's default palette is removed, so only tokens exist.
- `:root` holds light values; dark values apply under `prefers-color-scheme: dark`
  unless `data-theme="light"`, or always under `data-theme="dark"`.
- Durations are `--duration-*`; under `prefers-reduced-motion` or `data-motion="calm"`
  everything except `fade` collapses to 1 ms.
- One `type-*` utility per type style (`type-display-lg`, `type-body-sm`, …) carrying
  family, size (rem), line height, weight and tracking.

Change a token, run `pnpm --filter @lintel/design-system build`, and every screen follows.

## Principles in code

- **Status is colour + glyph + word.** `StatusPill` always renders all three;
  `StatusGlyph` shapes differ per status (ring, half-fill, bar, dot, tick, triangle…).
- **One accent, one job.** Cyanotype marks the primary action, the current selection
  and "now" (today lines, current stage). It never means a status.
- **The blueprint sheet** (`lt-blueprint-grid`, `bg-blueprint`) appears once per screen
  at most: the sign-in panel and the Today hero.
- **Paper, not glass.** Cards are hairline-bordered raised paper; shadows appear when
  something lifts (drawers, dialogs, the focused hero, hovered cards).

## Components (`./web`)

Controls: `Button`, `IconButton`, `Field` (label, hint, animated error), `Input`,
`Textarea`, `Select`, `Combobox`, `DatePicker`, `Checkbox` (self-drawing tick),
`Switch`. Overlays: `Dialog`, `Sheet` (right drawer / bottom sheet, full screen on
phones), `Popover`, `Tooltip`, toasts (`ToastProvider`, `useToast`). Data: `Badge`,
`CountBadge`, `StatusPill`, `StatusGlyph`, `PriorityMarker`, `Avatar` (+ load ring),
`AvatarStack`, `ProgressRing`, `StageTracker`, `KpiTile` (count-up), `Sparkline`,
`TrendBars`, `ActivityFeed`, `ApprovalCard`. Timeline: `MilestoneTimeline`,
`createTimelineScale`, `GanttChart`, `GanttRow`, `GanttBar`, `GanttMilestoneMark`,
`GanttDependencies`. Feedback: `EmptyState` + `LineDrawing` (architectural line art),
`ErrorState` (shows the request id), `Skeleton`/`SkeletonGroup` (shimmer only after
300 ms). Layout: `Card`, `CardHeader`, `PageHeader`, `Tabs`, `TabNav` (routed tabs),
`SegmentedControl`, `ResponsiveTable` (table on wide screens, cards on phones).

## Motion

Presets live in `src/web/motion/presets.ts` (from `tokens/motion.ts`): `pageEnter`,
`swapEnter`, `listItemEnter(index)` (stagger capped at 8 items), `layoutSpring`,
`snappySpring`, `dataTransition` (rings, bars, count-ups), `dialogEnter`,
`sheetTransition`, `dragLift`. `MotionPreferenceProvider` sets Motion's
`reducedMotion` to `"always"` under Calm motion and `"user"` otherwise;
`useCalmMotion()` is true for either the OS setting or Calm motion, and components that
draw (line art, rings, count-ups) skip straight to the end state.

## Accessibility rules the components enforce

Visible focus rings (`:focus-visible`, light on blueprint), 44 px targets on touch
(`pointer-coarse:` variants), labelled icon buttons (`IconButton` requires `label`),
fields wired to their label, hint and error, status never by colour alone, and text
tokens at AA contrast on every surface of their theme.

## Web app notes (`apps/web`)

- The browser calls `/api/*`, which Next rewrites to `API_INTERNAL_URL`, so the session
  cookie is first-party. `lib/api/api-client.ts` adds `x-lintel-csrf` to unsafe requests
  and turns every non-success into an `ApiError` (`expectStatus`).
- `proxy.ts` sends visitors without a session cookie to sign-in; the `(app)` layout asks
  the API who the person is on the server. A 401 anywhere returns to sign-in with the
  current path.
- A 404 from a collection endpoint renders "Not switched on yet" (the module is not
  deployed); a 404 on an item means missing or not shared.
- Navigation is one list (`shell/navigation.ts`) filtered by capabilities; entries for
  screens not built yet stay in the list with `built: false` and are never shown.
- Theme and Calm motion are cookies, so the server renders the right `data-theme` and
  `data-motion` on first paint.
