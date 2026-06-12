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

**Dark mode color palette** (exact hex values — use inline styles, not Tailwind approximations):
- Page background: `#070712`
- Card background: `#0F0F1A`
- Card border: `#1C1C2E`
- Elevated / hover: `#141428`
- Text primary: `#E8E8F0` (Tailwind token: `text-os-fg`)
- Text secondary: `#8888A0` (Tailwind token: `text-os-secondary`)
- Text muted: `#4A4A60` (Tailwind token: `text-os-muted`)
- Primary accent (indigo): `#6366F1` (Tailwind token: `os-indigo`)
- Done / success: `#10B981` (emerald)

Light mode uses standard Tailwind (`bg-white`, `text-zinc-*`, `border-zinc-*`, `bg-surface-50`).

**Card pattern** — all habit cards, goal rows, and info cards:
```jsx
// Undone: className="card-interactive rounded-xl" + inline style { background: '#0F0F1A', border: '1px solid #1C1C2E' }
// Done:   inline style — bg rgba(16,185,129,0.06), border rgba(16,185,129,0.25),
//         borderTop rgba(16,185,129,0.5), boxShadow '0 0 20px rgba(16,185,129,0.06) inset'
```
`.card-interactive` (in `index.css`) applies the indigo hover glow in dark mode. Do not use `dark:bg-*` / `dark:border-*` Tailwind classes for card surfaces — the exact palette values won't match.

**Streak tiers and filters** (applied to both number and flame icon):
| Tier | Color | Filter |
|------|-------|--------|
| cold | `#4A4A60` | none |
| warm (1–6) | `#F59E0B` | `drop-shadow(0 0 8px rgba(245,158,11,0.6))` |
| hot (7–29) | `#F97316` | `drop-shadow(0 0 10px rgba(249,115,22,0.7))` |
| legendary (30+) | `#8B5CF6` | `drop-shadow(0 0 12px rgba(139,92,246,0.8))` |

`StreakDisplay` takes `flash={booped}` — when true it briefly plays `animate-streak-flash` (scale 1→1.3→1, 400ms) to celebrate a habit completion.

**Named animations** (defined in `tailwind.config.js`, usable as `animate-*` classes):
- `boop` — card scale pop on done transition
- `slide-down` — AllDoneBanner entrance
- `streak-flash` — StreakDisplay scale flash on completion
- `bar-shine` — one-shot progress bar shine sweep (staggered per row via `animationDelay`)
- `pulse-warm` / `pulse-hot` / `pulse-legendary` — continuous streak tier pulse
- `legendary-ring` / `float` — legendary tier halo and flame effects

**Background effects** (`App.jsx`, dark mode only):
- `.blob-1/2/3` CSS elements with `blob-drift-*` keyframes — barely-visible radial gradients (indigo/violet/cyan) that slowly drift. Defined in `index.css`, hidden via `html:not(.dark)`.
- Cursor spotlight: `mousemove` sets `--cursor-x`/`--cursor-y` on `document.documentElement`. A fixed `pointer-events:none` div renders `radial-gradient(500px circle at var(--cursor-x), rgba(99,102,241,0.07))`.

All content sits in a `<div style={{ zIndex: 2 }}>` wrapper inside `App.jsx`, above the blob layer (z-index 0) and cursor glow (z-index 1).

## Icons

Tabler Icons outline webfont loaded via CDN in `index.html`. Usage: `<i className="ti ti-{icon-name}" />`. Icon names come from the `icon` column in the `habits` and `goals` tables.
