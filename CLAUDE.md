# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # start dev server (localhost:5173)
npm run build      # production build → dist/
npm run preview    # serve the dist/ build locally
```

No linter or test runner is configured.

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

**Gym deselect/override** — clicking an already-active workout type deselects it (`done=false`, cleared payload). Clicking any workout type while in rest-day state overrides it. The rest day button has no deselect.

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
   - PASS: scenario + observed behavior matches expected
   - FAIL: scenario + expected behavior + actual behavior + likely cause
   - UNCLEAR: scenario that needs manual verification

4. Main agent reads the report. For each FAIL:
   - Implements the fix
   - Marks the fix in the report

5. QA agent re-runs ONLY the failed scenarios from the previous iteration.

6. Repeat up to 3 total iterations. After 3 iterations, log any remaining FAILs to qa_reports/unresolved_[timestamp].md and continue.

After the loop completes, QA agent appends a one-line summary to CLAUDE.md under "## QA History": date + feature + pass rate (e.g. "2026-06-15: PR graph fixes — 11/12 passed, 1 unresolved (tooltip hover on mobile)")

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

### Session End (always do this last, after QA and code quality agents):
After all work is complete for the session, update HANDOFF.md with the current state. Overwrite the entire file with fresh content each time. Use this exact format:

```
# Life OS — Handoff Log

## Meta
Last updated: [ISO timestamp]
Last updated by: [Claude Code | Codex]
Current phase: Phase N — [Phase Name]

## Just Completed (this session)
- [one line per task completed]

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
[Issues from qa_reports/unresolved_*.md, or "None"]

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
