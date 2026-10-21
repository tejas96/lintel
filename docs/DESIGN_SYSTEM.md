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
`GanttDependencies`, `GanttEditableBar` (drag to move, drag an end to resize, keyboard),
`GanttDateLines` (agreed and proposed end lines). Feedback: `EmptyState` + `LineDrawing` (architectural line art),
`ErrorState` (shows the request id), `Skeleton`/`SkeletonGroup` (shimmer only after
300 ms). Layout: `Card`, `CardHeader`, `PageHeader`, `Tabs`, `TabNav` (routed tabs),
`SegmentedControl`, `ResponsiveTable` (table on wide screens, cards on phones).

- `Checkbox hideLabel` keeps the label for assistive technology only, for grids of
  checkboxes whose row and column headers already say what each box means
  (the notification matrix).
- `Dialog` and `Sheet` take `autoFocusField`: an overlay that is a form opens with the
  cursor in its first text field instead of on Close. Leave it off for overlays that
  only confirm or read. Both panels clip (`overflow-clip`) rather than hide overflow,
  so focusing a field can never scroll the panel's frame out of place.
- `lt-emboss` (components.css) is a blind emboss: paper-coloured SVG read through a
  highlight and a shadow, with light and dark values. It is used once, for the reward
  seal.

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

## Web app patterns

- **Stale versions.** Writes that send `expectedVersion` treat a 409 as "someone else
  changed this": `useStaleVersion()` catches it and `StaleVersionNotice` offers a
  refresh, while the action stays disabled until the newer version is loaded. Nothing
  overwrites silently. Panels holding a draft (the leave decision note) are keyed by
  the record's version so a refresh starts them clean.
- **Server validation beside the field.** `ApiError.fieldErrors()` feeds `Field`'s
  error. The template editor goes further: `template-issues.ts` maps field paths
  (`definition.stages.2.tasks.0.title`, or `definition.tasks.<key>` for workflow rules)
  onto stages, tasks and milestones; the stage outline counts problems per stage, and
  the issues panel lists each one ("Task: Use at least 2 characters.") with a Go to
  button that opens the item with focus in the field. Schema wording is rewritten in
  plain words.
- **Client-side guards, server-side truth.** The dependency picker disables choices
  that would make a loop and says why ("Already waits for this task, so it would
  loop."); the server checks again on save.
- **Capacity.** `LoadBar` and the `Avatar` load ring share one tone scale
  (`load-presentation.ts`). In a day's bar confirmed work is solid, tentative work
  faint and blocked time hatched. Approved leave hatches the cell, leave waiting for
  approval outlines it with a dashed line, and studio holidays are one full-height
  band with the holiday's name set vertically.
- **The reward seal** presses into the page once per approved reward per device, and
  only for the person rewarded; reviewers see it at rest, and under Calm motion it
  fades in without movement. Decide once per mount (a ref), so React's double effects
  in development cannot cancel the press.
- **Board drag** uses pointer events, not HTML drag and drop: a 5 px threshold before
  lifting, a ghost in a portal with `dragLift`, edge auto-scroll, Escape to cancel,
  and the click after a drop swallowed. Touch and keyboard use the card's Move to
  menu, which reaches the same mutation.
- **Phone layouts.** A horizontal scroll wrapper (`overflow-x-auto`) around a table
  with `sr-only` text must also be `relative`; otherwise the absolutely positioned
  sr-only spans escape it and widen the phone's layout viewport. Grids that collapse
  to one column use `grid-cols-[minmax(0,1fr)]` so long content cannot widen the track.
- **Uploads** build `FormData` by hand: the contract client's multipart helper
  JSON-encodes non-file fields, which the API rejects.
- **Server sentences** sometimes carry ISO dates; `withReadableDates()` turns them into
  "Tuesday 27 October" before they are shown.
- **Insight filters** (`features/insights/`): the command center and the reports share
  one URL-backed filter set (`?from=&to=&project=&manager=&team=`, `router.push` so
  Back undoes a change). Wide screens show the period, project, manager and team
  controls in one 44 px row; phones keep the period and move the rest into a bottom
  sheet. Applied filters are removable chips; removing one moves focus to the next.
  The period popover offers common ranges with their dates in Geist Mono and a custom
  range, and scrolls inside the viewport on small phones. A filter that leaves nothing
  in view shows an empty state with Clear filters, never a wall of zeros.
- **Reports** (`features/reports/`): every chart has the numbers beside it or one press
  away ("Show the numbers"), each bar or gauge carries a tooltip and an accessible
  label, and tables become cards on phones (`ResponsiveTable`). The workload chart is a
  gauge per period: the track is available time, the fill is planned work coloured by
  load status, a dark tick is logged time. `TrendBars` takes an optional `tick` per
  datum for a sparse axis under the bars. Figures in tables are Geist Mono tabular;
  hero numbers stay in the display serif (`KpiTile`). Units go into KPI labels
  ("Available hours") so large numbers never wrap on phones.
- **Budgets** (`features/finances/`): `BudgetBar` is the budget as a track, recorded cost
  as the fill in the margin's status colour, a tick where the margin turns thin and a
  hatched overflow past the budget; the indicator is always a `StatusPill` (colour,
  glyph, word). Money is Indian-grouped (`₹43,68,000`), whole rupees drop the paise.
  The cost ledger never edits: voided entries stay, struck through, with who and why.
- **Timeline rescheduling** (`features/projects/room/`): `GanttEditableBar` follows the
  pointer day by day (a 4 px threshold keeps clicks opening the task; the click that ends
  a drag is swallowed, including React's `onClick`), shows its dates in a dark chip, and
  leaves a dashed outline where it was. On drop the server previews the knock-on and every
  moved bar slides to its proposed place with the layout spring (accent ring, dashed "was"
  outline), the agreed end is a dashed line and a moved end a solid at-risk line. The
  review floats as a compact bar at the bottom (summary, folded details, one-line reason,
  Put it back / Apply), and the reviewed bar is scrolled to the middle of the screen so it
  stays visible above it. `GanttChart` wraps its rows in a `layoutRoot`, so content added
  above the chart never makes bars animate. `focusDate` opens a chart on a date other than
  today; `labelWidth="compact"` narrows the name column (`--gantt-label`).
- **Plan tailoring** (`features/projects/new/`): the wizard's Plan step keeps the draft in
  `plan-draft.ts`, asks the server to date it after a 220 ms pause (`use-plan-preview.ts`,
  compared as text so equal requests are never refetched), and merges template, draft and
  preview in `plan-outline.ts`. The summary's dates slide when they change; the side
  timeline uses the month scale and stays in view while the list scrolls.
- **First-run tips** (`features/guidance/`): `FirstRunTip` decides once per visit whether
  to show, marks the tip seen on the server at once, and folds away when dismissed; it sits
  in the page flow (a `section`, not an `aside`, so it is not a stray landmark).
- **Due times** read the way people say them ("5:30 pm") everywhere, from one shared
  helper (`spokenTimeOfDay`). On Today, a top task due today at a time swaps the day ruler
  for an hour ruler (Now, Due, time left), whose labels never overlap the hour numbers.

