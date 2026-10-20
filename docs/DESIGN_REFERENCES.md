# Design References

> Research date: 2026-10-21. Primary source: Dribbble. Dribbble blocks automated fetches
> (AWS WAF), so every shot below was opened in a real browser and its full-resolution
> images were reviewed. Every URL here was opened during research. No artwork from these
> shots is committed to the repository; Lintel's visual system is original and only
> synthesises the principles described here.

**Selection criteria:** (1) fit with studio operations — stages, approvals, capacity,
planning; (2) a calm, premium visual voice; (3) clear information hierarchy; (4) parts that
can be reused on web and mobile. Popularity was a tie-breaker only.

## Verdict on the three suggested shots

| Shot | Verdict | Why |
|---|---|---|
| [Planora — Project Management Dashboard](https://dribbble.com/shots/27758844-Planora-Project-Management-Dashboard), Oxiva Studio | **Included (#2)** | Best owner-dashboard layout found: KPI hero cards, ring, workload balance, milestones, assistant rail. |
| [Task & Team Management Mobile App Design](https://dribbble.com/shots/27250455-Task-Team-Management-Mobile-App-Design), Orbix Studio | **Included (#5)** | Strong mobile daily-work model: KPI donut, today's tasks, calendar with a "now" line, FAB quick-add sheet, main/Gantt toggle. |
| [Project Management System](https://dribbble.com/shots/15478390-Project-Management-System), Nikita Strunkis / Fireart | **Mood reference only** | 2021 dark glassmorphism. Low contrast on glass, dated. One idea kept: a project "wall" grouped by Top priority / Upcoming / Drafts under a large date headline. |

## Top 5 references

### 1. Plinth — project workspace for interior and landscape studios (3 shots)

- **Designer:** Luke Pyrzynski. Chosen because it fits the domain exactly ("calm system" for small interior studios).
- **URLs:**
  - Web workspace: https://dribbble.com/shots/27788473-Project-Workspace-Interior-Design-Activity-Timeline-UI
  - Client decision approval: https://dribbble.com/shots/27788424-Client-Portal-Interior-Design-Decision-Approval-UI
  - Mobile dashboard: https://dribbble.com/shots/27788443-Mobile-App-Interior-Design-Studio-Dashboard-and-Projects-UI
- **Screens:** 7-stage tracker ("Stage 5 of 7, Procurement · Installation begins Oct 12"); activity feed with Rooms / Spec list / Files tabs; decision cards comparing two material swatches; budget rail; amber "2 decisions waiting on Marta — Send a reminder"; mobile "Good morning · Your week at a glance · Needs you".
- **Hierarchy:** Every screen answers "what needs me?" first, then progress, then history. Money and dates sit in a quiet right rail.
- **Visual language:** warm off-white canvas, white cards, hairline borders, almost no shadows; sage for done segments, deep slate-teal for current; near-black primary button; ~16px card radius; real material photos supply richness instead of gradients.
- **Adapt, don't copy:** the segmented stage bar becomes our workflow-stage primitive; the swatch decision card becomes deliverable approval; "Needs you" opens every role's home. Our grid, type and multi-project owner roll-ups are our own.

### 2. Planora — project management dashboard (suggested)

- **Designer:** Oxiva Studio — https://dribbble.com/shots/27758844-Planora-Project-Management-Dashboard
- **Screens:** "Project Pulse" hero with three KPI cards showing change versus last period; completion ring; capacity ring with On track / At risk / Overloaded counts; workload bars per person; milestone checklist; health donut; activity; assistant column.
- **Hierarchy:** headline → three KPIs with deltas → 3×3 grid of modular cards, each with icon, title, one hero number, small detail.
- **Visual language:** light grey canvas, white 16px cards, black pill for active nav, one mint accent, compact neutral sans.
- **Motion it invites:** ring and bar draw-on, swipeable KPI stack.
- **Adapt, don't copy:** one hero number per card with a delta; capacity counts; assistant as a side rail (Phase 2, disabled). Replace software metrics (sprints, burndown) with studio metrics: stage throughput, approvals pending, capacity, overdue deliverables. Drop the mint glass.

### 3. Workzlow — workflow and approval dashboard

- **Designer:** Odama — https://dribbble.com/shots/27681468-Workzlow-Workspace-Workflow-and-Approval-Dashboard
- **Screens:** phase timeline across months with sub-step markers and dashed connectors to the next phase; "✓ Completed" and mono `Current` tags; approvals queue ("14 pending", Accept/Decline); SLA health dot strip (On track, At risk, Breached, Escalated).
- **Hierarchy:** the phase timeline is the hero; below it three equal panels — what needs action, health, interpretation.
- **Visual language:** desaturated palette, subtle paper grain, serif section headings with mono micro-labels — an editorial tone.
- **Adapt, don't copy:** a staircase stage timeline in the Project Control Room; a "deliverable health" dot strip for the owner; serif + mono pairing. Flat fills instead of gradients.

### 4. Workload Planner — smart team scheduling

- **Designer:** George Lov® for Fireart Studio — https://dribbble.com/shots/26612027-Workload-Planner-Smart-Team-Scheduling-UI
- **Screens:** people × days grid with booked hours per cell ("2h 30m / 8h", "1h 30m Over"); greyed weekends; segmented capacity ring around each avatar; "Unassigned" row with "+Assign".
- **Hierarchy:** overload is visible across the grid without reading numbers; exact hours are readable up close.
- **Adapt, don't copy:** people × days grid with under / at / over load states for Team Capacity; leave days hatched; holidays as a full-height band; the avatar capacity ring as a reusable "person load" component. Flatten the extruded cells to our paper style.

### 5. Task & Team Management mobile app (suggested)

- **Designer:** Orbix Studio — https://dribbble.com/shots/27250455-Task-Team-Management-Mobile-App-Design
- **Screens:** quick tiles, status donut (Stuck / In progress / In review / Done), swipeable "Today" carousel, member × project table with Main/Gantt toggle, day timeline with a vertical "now" line, FAB bottom sheet for quick add.
- **Motion:** carousel swipe, smooth view changes, sheet sliding up from the FAB.
- **Adapt, don't copy:** the employee Daily Work Planner — today's queue, timeline with a "now" line, quick actions from a FAB. Our status colours must meet AA contrast (this shot's pastels do not). Each card adds stage context ("Concept · Saska residence").

## Honourable mentions (opened during research)

| Reference | What to take |
|---|---|
| [Gantt Chart](https://dribbble.com/shots/16966132-Gantt-Chart), Ivan Strashkulych | Task tree beside bars, % progress column, today marker, context menu on bars. |
| [Timeline interactions](https://dribbble.com/shots/14002364-Timeline-interactions), Tyler Beauchamp | Animated collapse/expand of timeline sections. |
| [LOMA – AI Daily Planner](https://dribbble.com/shots/27617480-LOMA-AI-Daily-Planner-Mobile-App), Odama | Calm planner: insight card, day strip, focus timer. |
| [Flowpad](https://dribbble.com/shots/27006194-Task-Management-SaaS-Dashboard-Flowpad), Liza Naumova | Warm minimal workspace; "Under review" board column. |
| [HRISELINK – Time Off Calendar](https://dribbble.com/shots/25833052-HRISELINK-Time-Off-Calendar-HR-Management-Dashboard-Saas), OnPoint Studio | Leave calendar month grid with typed chips; Requested / Balances / Calendar tabs. |

## Module → reference map

| Lintel module | Primary pattern source |
|---|---|
| Owner command center | Planora (KPI hero, modular cards) + Workzlow (approvals queue, health strip) |
| Project control room | Workzlow (stage staircase) + Plinth (stage bar, right rail) + Strashkulych (Gantt mechanics) + Beauchamp (collapse) |
| Workflow stages | Plinth's segmented stage tracker |
| Daily work planner | Orbix mobile (today queue, "now" line, FAB) + LOMA (calm focus) |
| Team capacity & leave | Fireart Workload Planner (load grid, avatar ring) + HRISELINK (leave chips) |
| Deliverable approvals | Plinth decision card |
| Rewards | No strong reference — defined by our own motion language |

---

## Visual Direction — "Linen & Cyanotype"

Warm architectural neutrals (linen, stone, travertine, ink) with one confident accent:
**Cyanotype**, the blueprint blue of architectural drawings. Clay and sage are supporting
materials for illustration, rewards and project swatches; they never carry meaning.

**Principles**

1. **Paper, not glass.** Flat warm surfaces with hairline borders. Shadows appear only when something lifts.
2. **One accent, one job.** Cyanotype marks the primary action, the current selection and "now". Never status.
3. **Status is a vocabulary.** Every status shows a colour, a glyph and a word. Colour alone never carries meaning.
4. **Editorial numerals.** Hero numbers use the serif display face; operational text uses the UI sans.
5. **Materials are the richness.** Project photos and swatches give depth; no decorative gradients.
6. **Motion explains cause and effect.** Things move to show where they came from or went. The only loop is the skeleton shimmer.

The token values (colour, status, type, radius, elevation, spacing, motion) are defined in
code in `packages/design-system/src/tokens/` and documented in `docs/DESIGN_SYSTEM.md`.
Contrast ratios were computed with WCAG 2.x; every text token is at least 4.5:1 on every
surface of its theme.

### Typography (Google Fonts)

| Role | Family | Why |
|---|---|---|
| Display | **Newsreader** (opsz 72, 400–450, italic for emphasis) | Refined editorial serif; draws ₹; tabular digits by default, so count-ups do not jitter. |
| UI | **Geist** | Very legible; draws ₹; supports `tnum`. |
| Mono | **Geist Mono** | IDs, timestamps, durations, Gantt axis ticks. |

Rejected after testing: Fraunces (proportional digits), Instrument Serif, Hanken Grotesk
and JetBrains Mono (no ₹ glyph).
