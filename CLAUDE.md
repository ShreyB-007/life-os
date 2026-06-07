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
- `logs` — historical logs per habit (last 400 days), used exclusively by `computeStreak()`
- `todayLogs` — today's log entry per habit, used to restore card UI on reload and to derive `allDone`

Cards receive `streak`, `todayLog`, and `onLog`. They never hold canonical state.

**Optimistic updates** — every card calls `onLog(habitKey, logEntry)` *before* `await supabase.upsert(...)`. `onLog` splices the new entry into `logs[habitKey]` and updates `todayLogs[habitKey]` immediately, so streak numbers and the AllDoneBanner react without waiting for the network.

**`allDone` is derived, not state** — it is a plain boolean computed from `todayLogs` on every render. There is no `habitsDone` state. This means the AllDoneBanner disappears automatically when a habit is un-logged.

**DSACard stale-closure guard** — `DSACard` keeps a `countsRef` that is updated synchronously in `adjust()`. This is necessary because rapid button presses would otherwise read stale `counts` from the React closure. The `countsRef` is the source of truth for computing the next count; `counts` state is for rendering only.

**Streak logic** (`src/lib/streaks.js`) — `computeStreak(logs, restDays)` walks backwards from today. It skips today-with-no-log (no penalty for not having logged yet), skips days where `is_rest_day=true`, and skips days whose day-of-week is in the `restDays` array. Any other day with no log or `done=false` stops the count. Gym passes `[0]` (Sunday) as scheduled rest days; the other habits pass `[]`.

## Database

Schema and seed data live in `supabase_setup.sql`. Run it once in the Supabase SQL editor to provision a new environment. The unique constraint on `habit_logs(habit_key, log_date)` is what makes upsert safe — all writes use `onConflict: 'habit_key,log_date'`.

**Payload shapes per habit:**
- Gym: `{ workout_type: "Push" | "Pull" | "Legs" | "Cardio" | "rest" }`
- Japanese: `{ subtasks: { anki: bool, duolingo: bool, study: bool } }`
- DSA: `{ easy: number, med: number, hard: number }`

## Dark mode

Tailwind `darkMode: 'class'` strategy. The `dark` class is toggled on `<html>` by `App.jsx` and persisted in `localStorage`. Always provide both a light and dark variant for every color utility: `text-zinc-700 dark:text-gray-300`, `bg-white dark:bg-gray-900`, `border-zinc-200 dark:border-gray-800`, etc.

## Icons

Tabler Icons outline webfont loaded via CDN in `index.html`. Usage: `<i className="ti ti-{icon-name}" />`. Icon names come from the `icon` column in the `habits` and `goals` tables.
