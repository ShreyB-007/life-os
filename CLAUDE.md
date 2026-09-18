# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # start dev server (localhost:5173)
npm run build      # production build → dist/
npm run preview    # serve the dist/ build locally
npm run test:e2e   # Playwright end-to-end suite (tests/e2e/*.spec.ts) — requires `npm run dev` running
```

No linter is configured. `npm run test:e2e` runs the Playwright suite in `tests/e2e/` against `localhost:5173` and the real Supabase project (there is no separate test/staging project) — it's serial/single-worker by design since there's no per-test data isolation, and test fixtures are prefixed `QA-Test-` and swept up in `afterEach` hooks. A second, older/lighter Playwright suite lives in `qa/` (`npm run qa`, runs against the `preview` build on port 4173) — kept as-is, not superseded by `tests/e2e/`.

## Environment

Create `.env.local` for local dev:
```
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

Both vars are also set in Vercel project settings for production.

## Deploy

Every `git push` to `main` triggers an automatic Vercel production deploy via the connected GitHub repo. Do not run `vercel deploy` manually — just push.

Git commits must use `shreybansal15704@gmail.com` (personal email). The local repo config is already set; verify with `git config user.email` before committing if in doubt.

## Architecture

**State ownership** — `Dashboard` is the single source of truth for all habit data. It owns:
- `logs` — historical logs per habit (last 400 days), used by `computeStreak()` and `computeOverallStreak()`
- `todayLogs` — today's log entry per habit, used to restore card UI on reload and to derive `allDone`

Cards receive `streak`, `todayLog`, and `onLog`. They never hold canonical state. `GymCard` additionally receives `allLogs` (full gym history) to compute the weekly rest-day cap.

**Optimistic updates** — every card calls `onLog(habitKey, logEntry)` *before* `await supabase.upsert(...)`. `onLog` splices the new entry into `logs[habitKey]` and updates `todayLogs[habitKey]` immediately, so streak numbers and the AllDoneBanner react without waiting for the network.

**`allDone` is derived, not state** — computed from `todayLogs` on every render:
```js
const allDone =
  (todayLogs.gym?.done === true || todayLogs.gym?.is_rest_day === true) &&
  todayLogs.japanese?.done === true &&
  todayLogs.dsa?.done === true
```
A gym rest day counts as "gym satisfied". There is no `habitsDone` state.

**DSACard stale-closure guard** — `DSACard` keeps a `countsRef` that is updated synchronously in `adjust()`. This prevents rapid button presses from reading stale `counts` from the React closure. `countsRef` is the source of truth for computing the next count; `counts` state is for rendering only.

**Card refs + constellation pulse** — all three habit cards are `forwardRef`. Dashboard holds `gymCardRef`, `japaneseCardRef`, `dsaCardRef` and a `constellationRef`. When `onLog` detects a wasAlreadyDone→nowDone transition, it calls `constellationRef.current.triggerPulse(cardRef.current)` to fire a ripple from the nearest constellation node to the card position. `triggerPulse` is exposed via `useImperativeHandle` on `NeuralConstellation`.

**Streak logic** (`src/lib/streaks.js`):
- `computeStreak(logs, restDays)` — per-habit streak. Walks backwards from today, skips today-with-no-log, skips `is_rest_day=true`, skips scheduled `restDays` day-of-week. Gym passes `[0]` (Sunday); others pass `[]`.
- `computeOverallStreak(gymLogs, japaneseLogs, dsaLogs)` — cross-habit day streak shown in TopBar. A day counts if: gym is `done=true` OR `is_rest_day=true` OR it's Sunday, AND japanese `done=true`, AND dsa `done=true`. Skips today if not yet complete.
- `computeSubtaskStreak(allLogs, subtaskKey)` — per-subtask streak for JapaneseCard.

**Gym rest-day cap** — `GymCard` enforces max 2 rest days per Mon–Sun week. Week start: `today - (today.getDay() + 6) % 7` days. At 1 used: warning label shown. At 2 used: button disabled, relabeled "Rest limit reached".

**Gym deselect/override** — clicking a workout type opens the exercise-logging drawer for it (pre-filled if already logged today); switching to a different type while one is active offers to carry today's session over. Clicking any workout type while in rest-day state overrides the rest day. The rest day button itself is a toggle — tapping it again while active deselects it (`done=false`, cleared payload).

## Database

Schema and seed data live in `supabase_setup.sql`. Run it once in the Supabase SQL editor to provision a new environment. The unique constraint on `habit_logs(habit_key, log_date)` is what makes upsert safe — all writes use `onConflict: 'habit_key,log_date'`.

**Payload shapes per habit:**
- Gym: `{ workout_type: "Push" | "Pull" | "Legs" | "Cardio" | "rest" }` — deselected state saves `{}`
- Japanese: `{ subtasks: { anki: bool, duolingo: bool, study: bool } }`
- DSA: `{ easy: number, med: number, hard: number }`

## Design system

**Fonts** (loaded via Google Fonts in `index.html`):
- `font-display` → Syne — headings, card titles, banner text
- `font-body` → Outfit — body text, labels, buttons
- `font-mono` → JetBrains Mono — streak numbers, DSA counts

**CSS custom properties** — the design token system. All color values for cards and text live in CSS variables, not Tailwind classes. Defined in `src/index.css`:
- `:root` (light mode defaults) and `html.dark` (dark overrides)
- Text tokens: `--os-fg`, `--os-secondary`, `--os-muted` — used as `text-os-fg` etc. via Tailwind
- Card tokens: `--card-bg`, `--card-border`, `--card-shadow`, `--card-blur`
- Input tokens: `--input-border`, `--input-hover-bg`, `--input-hover-border`
- Never use `dark:bg-*` / `dark:border-*` Tailwind classes for card surfaces — use the CSS classes below

**Per-habit color identity** (accent bars, icons, hover glows):
- Gym: `#6366F1` indigo
- Japanese: `#8B5CF6` violet
- DSA: `#06B6D4` cyan
- Done state: `#10B981` emerald **only** — never used decoratively

**Card pattern** — use CSS classes, not inline styles, for card surfaces:
```jsx
// Undone: className="habit-card card-interactive rounded-xl habit-gym" (or habit-japanese / habit-dsa)
// Done:   className="habit-card-done rounded-xl"
```
`.habit-card` / `.habit-card-done` are defined in `index.css` and adapt to both themes via CSS variables. `.habit-gym`, `.habit-japanese`, `.habit-dsa` override the hover glow color. Do not put card background/border values in `style={{}}`.

**Card accent bar** — absolute left-edge bar, 3px wide:
```jsx
<div className="card-accent-bar" style={{ backgroundColor: isDone ? '#10b981' : '#6366F1' }} />
```

**Streak tiers and filters** (applied to both number and flame icon):
| Tier | CSS class | Color | Filter |
|------|-----------|-------|--------|
| cold | — | `var(--os-muted)` | none |
| warm (1–6) | `text-gradient-amber` | `#F59E0B` | `drop-shadow(0 0 8px rgba(245,158,11,0.6))` |
| hot (7–29) | `text-gradient-hot` | `#F97316` | `drop-shadow(0 0 10px rgba(249,115,22,0.7))` |
| legendary (30+) | `text-gradient-legendary` | animated indigo→violet→cyan | `drop-shadow(0 0 12px rgba(139,92,246,0.8))` |

`StreakDisplay` takes `flash={booped}` — when true it briefly plays `animate-streak-flash` (scale 1→1.3→1, 400ms) to celebrate a habit completion.

**Named animations** (defined in `tailwind.config.js`, usable as `animate-*` classes):
- `boop` — card scale pop on done transition
- `slide-down` — AllDoneBanner entrance
- `streak-flash` — StreakDisplay scale flash on completion
- `bar-shine` — one-shot progress bar shine sweep (staggered per row via `animationDelay`)
- `pulse-warm` / `pulse-hot` / `pulse-legendary` — continuous streak tier pulse
- `legendary-ring` / `float` — legendary tier halo and flame effects

Additional CSS-only animations defined in `index.css` (not in Tailwind): `cosmicBreath`, `lightBreath`, `iconDrift1–8`, `cosmicTextShift`.

**Animated gradient text classes** (in `index.css`):
- `.text-gradient-cosmic` — indigo→violet→cyan→emerald cycle; used on AllDoneBanner text
- `.text-gradient-legendary` — indigo→violet→cyan cycle; used on legendary streak number

**Background layer stack** (z-index order, bottom to top):
1. `html` element — animated breathing gradient (`cosmicBreath` dark / `lightBreath` light) + static grid/dot texture
2. `<FloatingIcons />` — 8 large Tabler icons (z=1), fixed position, low opacity, independent drift animations; cursor magnetic lean via CSS `translate` property (DOM direct, no React re-renders)
3. `<NeuralConstellation />` — Canvas 2D via React portal to `document.body` (z=2); 28 drifting nodes, quadratic-bezier connections, pulse ripple from habit completions, allDone celebration ring; cursor pull strength is per-theme (`pullStrength` on DARK_THEME / LIGHT_THEME)
4. Cursor spotlight — `pointer-events:none` fixed div with radial-gradient (z=3)
5. Content — navbar + page content (z=4)

## Icons

Tabler Icons outline webfont loaded via CDN in `index.html`. Usage: `<i className="ti ti-{icon-name}" />`. Icon names come from the `icon` column in the `habits` and `goals` tables.

## Automated Agent Workflow

These agents run automatically after EVERY implementation, without being asked. Do not skip them. Do not ask the user to run them manually. This behavior persists across all sessions regardless of context.

### Agent 1: QA Agent

Runs after every implementation. The QA agent operates as if it has zero context about the codebase — it only knows what a user would see and experience. It tests behavior, not code.

Workflow (up to 3 iterations):

ITERATION LOOP:
1. QA agent generates test scenarios covering:
   - Happy path (expected normal usage)
   - Boundary values (0, 1, max, max+1, max-1)
   - Invalid inputs (wrong type, empty, negative, decimal where not allowed)
   - Rapid interactions (clicking same button 5x fast)
   - State transitions (log → unlog → relog, select → deselect → reselect)
   - Cross-feature interactions (does feature A break when feature B is used)
   - Edge cases specific to the feature just implemented

2. For each scenario, QA agent predicts the expected behavior, then describes what actually happens based on reading the implementation code. If it cannot determine behavior from code alone, it flags it explicitly.

3. QA agent writes a report to qa_reports/qa_[timestamp].md containing:
   - PASS: scenario + observed behavior matches expected + verification tag (`VERIFIED-LIVE-PROD` / `VERIFIED-LIVE-DEV` / `VERIFIED-CODE-REVIEW`)
   - FAIL: scenario + expected behavior + actual behavior + likely cause + verification tag
   - UNCLEAR: scenario that needs manual verification (implicitly `UNVERIFIED`)
   A PASS reached by "reading the implementation code" (per step 2 above) must be tagged `VERIFIED-CODE-REVIEW`, not left to imply it was actually run. Don't let a report's overall "X/Y passed" headline flatten a mix of live-checked and code-read scenarios into one confidence level — the per-scenario tags are what future sessions should trust, not the headline number.

4. Main agent reads the report. For each FAIL:
   - Implements the fix
   - Marks the fix in the report

5. QA agent re-runs ONLY the failed scenarios from the previous iteration.

6. Repeat up to 3 total iterations. After 3 iterations, log any remaining FAILs to qa_reports/unresolved_[timestamp].md and continue.

After the loop completes, QA agent appends a one-line summary to CLAUDE.md under "## QA History": date + feature + pass rate + a verification-mix note (e.g. "2026-06-15: PR graph fixes — 11/12 passed, 1 unresolved (tooltip hover on mobile); 8 live-verified, 3 code-reading") — don't state a bare pass rate without saying how it was checked, since a future session reading only this line has no other way to know.

### Agent 2: Code Quality Agent

Runs after QA Agent completes (every session). Checks the entire repo, not just the files changed in this session.

Checklist (fix automatically, do not ask user):

CLEANUP:
- Remove all console.log, console.warn, console.error statements unless they are inside a try/catch error handler
- Remove all commented-out code blocks (not comments explaining logic)
- Remove unused imports in every file
- Remove unused variables and functions
- Remove any files in src/ that are not imported anywhere

CONSISTENCY:
- All date computations use getLocalDate() from src/lib/dateUtils.js — no toISOString() anywhere
- All card surfaces use the design system from CLAUDE.md (inline styles for dark surfaces, not dark: Tailwind classes)
- All fonts use the three defined families: Syne, Outfit, JetBrains Mono
- All streak displays use the StreakDisplay component, not ad-hoc implementations
- All Supabase writes include explicit log_date: getLocalDate()

PERFORMANCE:
- No useEffect with missing or incorrect dependency arrays
- No unnecessary re-renders (check for object/array literals created inline in JSX that should be memoized)
- No fetch calls inside render functions without caching
- Images and SVGs are not re-created on every render

ARCHITECTURE:
- No hardcoded user data (gym type names, exercise names, etc.) in component files — these come from Supabase or config
- No business logic inside JSX return statements — extract to functions
- No prop drilling more than 2 levels deep without justification
- Environment variables: verify no VITE_ vars are logged or exposed in error messages

After running, write a brief report to qa_reports/code_quality_[timestamp].md listing what was found and fixed. If nothing needed fixing, write "No issues found."

### Execution order per session:
1. Implement the requested feature/fix
2. Run QA Agent (up to 3 iterations)
3. Run Code Quality Agent
4. Commit with message format: "feat/fix: [description] — QA: X/Y passed"

## Session Handoff Protocol

### Session Start (always do this first):
1. Read HANDOFF.md completely before touching any code
2. Read `qa_reports/` directory — check the most recent QA report for any unresolved issues
3. Run `git log --oneline -10` to see the last 10 commits and understand recent changes
4. Do not ask the user what to work on if HANDOFF.md has a clear "In Progress" or "Queued Next" section — pick it up automatically
5. **When a prior entry claims a bug is fixed or a behavior is confirmed, check its verification tag (see below) before trusting it.** Anything tagged `VERIFIED-CODE-REVIEW` or `UNVERIFIED` is a claim, not a confirmed fact — it still needs an actual live check before you rely on it or tell the user it's resolved. Only `VERIFIED-LIVE-PROD` or `VERIFIED-LIVE-DEV` mean someone actually ran/clicked/observed it. An untagged legacy entry (written before this rule existed) should be treated the same as `UNVERIFIED` until re-checked.

### Verification tags (required)

Every conclusion recorded about a bug, fix, or QA result — in HANDOFF.md's "Just Completed" and "Unresolved Issues" sections, in a `qa_reports/*.md` PASS/FAIL/UNCLEAR line, or in a CLAUDE.md QA History line — must be suffixed with exactly one of these tags:

- **`VERIFIED-LIVE-PROD`** — actually reproduced/checked against the deployed production URL (real clicks, real network requests, real DOM/response inspected — not inferred).
- **`VERIFIED-LIVE-DEV`** — actually reproduced/checked against the local dev server (`npm run dev`) or a live-invoked edge function/DB query, but not the deployed production build.
- **`VERIFIED-CODE-REVIEW`** — concluded by reading source code, grepping, or reasoning about logic only. Nothing was run, clicked, or observed. This includes "the build passed" — a successful build proves the code compiles, not that the feature behaves correctly.
- **`UNVERIFIED`** — stated as true (e.g. carried forward from a previous session, or asserted without checking) but not actually checked by any method this session.

This exists because this project has twice closed real bugs as "not reproducible" based on `VERIFIED-CODE-REVIEW`-level inspection alone (Bug 7, Bug 8) — both required an actual live check to catch. A `VERIFIED-CODE-REVIEW` conclusion is not worthless (it's often correct), but it must never be silently upgraded to the confidence level of a live check, by this session or a future one. When a fix touches user-visible behavior, prefer live verification before closing it; if you can't (e.g. it requires writing to real production data with no safe test path), say so explicitly and leave the tag as `VERIFIED-CODE-REVIEW` or `UNVERIFIED` rather than rounding up.

### Session End (always do this last, after QA and code quality agents):
After all work is complete for the session, update HANDOFF.md with the current state. Overwrite the entire file with fresh content each time. Use this exact format:

```
# Life OS — Handoff Log

## Meta
Last updated: [ISO timestamp]
Last updated by: [Claude Code | Codex]
Current phase: Phase N — [Phase Name]

## Just Completed (this session)
- [one line per task completed] — [VERIFIED-LIVE-PROD | VERIFIED-LIVE-DEV | VERIFIED-CODE-REVIEW | UNVERIFIED]
  (tag required for any line that claims a bug is fixed, a behavior works, or a QA scenario passed. Plain process/administrative lines — "read HANDOFF.md", "added a new file" — don't need one.)

## In Progress (incomplete — pick up here first)
[Exact description of what was started but not finished, and what remains.
If nothing is in progress, write: None — see Queued Next.]

## Queued Next (in priority order)
1. [Next task — specific enough to start without asking the user]
2. ...

## Phase Completion Status
-> Phase 1 (Dashboard + Habits): ✅ Complete
-> Phase 2 (Gym Workout Tracker): [status]
-> Phase 3 (Goals Page + Masters Research Agent): [status]
-> Phase 4 (News Feeds — Gemini): [status]
-> Phase 5 (Weekly Review + Polish): [status]

## Known Working Features (do not regress these)
[List confirmed working features]

## Decisions Made (do not reverse without explicit user instruction)
[Architectural and design decisions]

## Unresolved Issues
[Issues from qa_reports/unresolved_*.md, or "None". Each issue gets a verification
tag too — e.g. a bug closed as "not reproducible" is a VERIFIED-CODE-REVIEW or
VERIFIED-LIVE-DEV claim, not automatically resolved; leave it here (not under
Known Working Features) until it carries a VERIFIED-LIVE-PROD or VERIFIED-LIVE-DEV
tag from an actual repro attempt.]

## Files Changed This Session
[Every file modified, created, or deleted]

## QA Status
Last QA run: [timestamp]
Pass rate: [X/Y passed]
Report: qa_reports/[filename]
```

## QA History

- 2026-06-15: Per-set PR graph fixes — 12/12 passed
- 2026-06-16: 5 changes (global PR dot, rest-day deletes session, DSA graph, cursor glow, pill buttons) — 35/35 passed
- 2026-06-18: Split delete buttons (hide today-delete when unlogged, add permanent remove) — 15/15 passed
- 2026-06-19: Gym confirmation, transfer delete, DSA persistence, constellation repulsion - 20/20 code-reading QA passed; browser QA 28/30 with sandboxed external-resource failures
- 2026-06-25: Category-scoped exercise deletion (workout_type column, scoped delete/remove, history grouping, transfer) — 8/8 passed
- 2026-06-26: Transfer deduplication fix (reuse global exercise row, never insert) — 6/6 passed
- 2026-06-26: Transfer orphan cleanup — live browser investigation confirmed zero exercise inserts; purgeOrphanDuplicates heals existing DB damage — 4/4 passed
- 2026-06-26: Global graph + days-since (allLogs state, cross-category graph data, category tooltip label) — 8/8 passed
- 2026-06-26: Streak reset on per-exercise today-delete (onResetGymHabit, otherHaveToday check) — 5/5 passed
- 2026-06-27: Hide remove-from-tag for single-category exercises; streak reset on category removal — 8/8 passed
- 2026-06-27: Cross-category logging lock (viewOnly to ExerciseCard) — 10/10 passed
- 2026-07-03: Goals page CRUD and progress tracking — 12/12 code-reading QA passed; browser QA 29/30 with sandboxed Supabase network denial
- 2026-07-03: Masters research foundation — 14/14 code-reading QA passed; browser QA 29/30 with sandboxed Supabase network denial
- 2026-07-03: Visual QA selector fix for duplicate live `Japanese` text — focused visual QA 4/4 passed
- 2026-07-03: Masters research agent + report pages — code-reading QA 14 pass/1 secrets-pending; browser QA 29/30 in Codex sandbox; build passed
- 2026-07-06: Gemini grounding research agent migration — code-reading QA 10/10 passed; browser QA 30/30 passed; build passed
- 2026-07-06: Live Gemini research smoke test fixes — Japan country verified; University blocked by Gemini free-tier quota; browser QA 30/30 passed
- 2026-07-09: University of Tokyo live Gemini research verified; citation range rendering fixed; browser QA 30/30 passed
- 2026-07-09: Masters provider quota notice and refresh failure handling - code-reading QA 7/7 passed; browser QA 30/30 passed; build passed
- 2026-07-13: Navbar contrast, placeholder/default-zero styling, and cable medium plate support - code-reading QA 10/10 passed; browser QA 30/30 passed; build passed
- 2026-07-17: Masters add-country frontend diagnosis and setup-error surfacing - focused QA 38/39 passed with 1 live E2E item blocked by Supabase RLS/seed repair; browser QA 30/30 passed; build passed
- 2026-07-17: Dashboard selected-date logging and calendar picker - focused QA 20/20 passed; browser QA 30/30 passed; build passed
- 2026-07-18: Full adversarial Playwright E2E suite (10 files, 122 tests) added under tests/e2e/ - 122/122 passed after fixing 3 real app bugs (stale-fetch-clobbers-optimistic-write race in Dashboard/Goals/Masters — see qa_reports/playwright_final_report.md); build passed
- 2026-09-13: 8-bug fix pass (date-selector greeting, Sunday gym auto-rest, 404 route, stale placeholders, goal name truncation; bugs 3/7/8 confirmed not reproducible or intentionally skipped) — 122/122 e2e passed (2 consecutive clean runs, 3 tests updated for the new auto-rest behavior); build passed
- 2026-09-13: Bug 7 follow-up — verified live on deployed Vercel build via DOM inspection (not just local dev) that the streak number was present but nearly invisible: StreakDisplay's cold-tier color was a hardcoded #4A4A60 instead of the design system's --os-muted token, worst against GymCard's low-opacity .habit-card-done background — fixed to use var(--os-muted); 122/122 e2e passed (1 pre-existing DSA-reload flake confirmed unrelated, passes in isolation); build passed
- 2026-09-14: Bug 7 round 2 — prior --os-muted fix still failed WCAG 4.5:1 on measurement (dark 3.48-3.76:1, light 2.20-2.62:1, worst on Gym's .habit-card-done surface); a rest-day-counts-as-+1 streak logic change was proposed, explicitly rejected by user, and reverted; landed on a dedicated --streak-cold token (5.7-5.86:1 default, 4.79-5.43:1 worst-case) verified via measured contrast ratios and a live same-tier side-by-side screenshot — 122/122 e2e passed (1 pre-existing DSA flake on run 2, unrelated); build passed
- 2026-09-18: Phase 4 News Digest — Global/India/AI-ML tabs, Gemini-grounded `news-digest` edge function (single combined search+JSON call per feed, by explicit user choice, to conserve the shared Gemini free-tier quota vs. Masters' multi-call pattern), `news_digests` cache table, auto-generate-on-load + manual Refresh, per-feed independent loading/error state — 10/10 QA passed (7 live-verified against real Gemini calls and the real DB, 3 code-reading for failure paths); build passed
- 2026-09-18: Digest StrictMode double-fire follow-up — user caught that the initial pass only *noted* the dev-only StrictMode double-invoke of the auto-generation effect (2x Gemini calls per local dev load) instead of fixing it; added a `hasStartedLoad` ref mount guard and re-verified live (cleared one feed's cache, reloaded, confirmed exactly 1 generation call fired via network trace, DB shows one row) — build passed
- 2026-09-18: Phase 5 Weekly Review + Polish — new `/review` page: `weekly-review` edge function aggregates habit_logs/goals server-side (no Google Search grounding, single non-grounded Gemini call, week-over-week goal-progress diffing via a stored `goal_snapshot`), `weekly_reviews` cache table, auto-generate-on-load with StrictMode guard + manual Regenerate, insufficient-data empty state (<3 logged days); shared `getWeekBounds()` extracted to dateUtils.js and reused by GymCard; fixed a real mobile bug where the navbar's dark-mode toggle became unreachable at narrow widths once a 5th nav link was added; stale "Phase 3"/"Phase 3b" user-facing text removed from Goals/Masters — 12/12 QA passed (live edge-function + DB verification plus code-reading for failure paths); build passed
- 2026-09-18: Bug 8 closure follow-up — user caught that the Phase 5 bug-sweep closed "lingering Select workout text" via code reading only and overstated it as agreeing with "three prior sessions," when only one (2026-09-13, local dev only) had actually gone live, and two GymCard.jsx commits since then were never re-checked — same category of mistake as Bug 7 being wrongly dismissed on inspection alone earlier in the project. Re-verified live against the actual production deployment (confirmed current via the Vercel API first): clicked "Rest day" on a real past date with no existing log, inspected the full accessibility tree immediately after the click and again after a hard page reload from the DB — exactly one status node in both cases, reading "Rest day — streak saved," no lingering "Select workout" text anywhere. Test data deleted from production afterward, confirmed via a follow-up query that real data (Sep 13/14 rest days, today's rest-limit count) was untouched. Bug 8 is genuinely fixed — this time with live evidence, not inference.
