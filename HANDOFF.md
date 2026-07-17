# Life OS - Handoff Log

## Meta
Last updated: 2026-07-17T22:56:21+05:30
Last updated by: Codex
Current phase: Phase 1 - Dashboard + Habits

## Just Completed (this session)
- Read AGENTS.md, HANDOFF.md, latest QA reports, recent commits, and the attached date-selector request before implementation.
- Added Dashboard-owned `selectedDate` state that defaults to `getLocalDate()` and silently clamps future dates back to today.
- Added selected-date habit-log loading so switching dates loads that day's Gym, Japanese, and DSA state without refetching the historical streak cache.
- Added the TopBar date selector with previous/next day controls, disabled future navigation, and a lightweight calendar popover.
- Added a past-date banner with a "Back to today" action and selected-date AllDoneBanner text.
- Threaded `selectedDate` through GymCard, JapaneseCard, DSACard, WorkoutDrawer, and ExerciseCard save/delete flows.
- Updated Gym rest-day weekly cap and workout drawer session operations to use the week/date being viewed.
- Preserved streak behavior as current-running status computed from full historical logs and real today.
- Ran production build, focused browser smoke, code-reading QA, code-quality review, and the full Playwright browser QA suite.

## In Progress (incomplete - pick up here first)
None - see Queued Next.

## Queued Next (in priority order)
1. Run the `Repair: Masters RLS policies + seed countries` block in supabase_setup.sql in the Supabase SQL editor, reload `/masters`, then run the full Add Country -> Add University -> Research -> Report -> Notes -> Delete live flow.
2. Run the cable payload migration at the bottom of supabase_setup.sql in the Supabase SQL editor to convert existing `{ plates, mini, reps }` rows to `{ big, medium, small, reps }`.
3. Manually verify selected-date logging against live Supabase rows for a past Gym workout, past Japanese subtasks, past DSA counts, and past rest-day cap behavior.
4. Phase 4 - News Feeds (Gemini), or Phase 3c polish if research output needs UI/schema adjustments.
5. Consider cleaning up pre-existing `logged_at: new Date().toISOString()` timestamp usage if the project wants to enforce the "no toISOString anywhere" code-quality rule literally.

## Phase Completion Status
-> Phase 1 (Dashboard + Habits): Complete - selected-date backlogging added
-> Phase 2 (Gym Workout Tracker): Feature-complete - selected-date workout logging added; existing DB rows need cable migration
-> Phase 3 (Goals Page + Masters Research Agent): Feature implemented - current live Supabase project needs Masters RLS/seed repair before add/research E2E can pass
-> Phase 4 (News Feeds - Gemini): Not started
-> Phase 5 (Weekly Review + Polish): Not started

## Known Working Features (do not regress these)
- Dashboard owns canonical `logs`, selected-day `todayLogs`, and `selectedDate`.
- Dashboard date selector defaults to today, prevents future dates, supports previous/next day navigation, and opens a lightweight calendar popover.
- Switching Dashboard dates loads that date's Gym, Japanese, and DSA logs, or blank state if none exist.
- Past-date banner appears only when viewing a non-today date and can reset back to today.
- AllDoneBanner is derived from the selected date and uses past-date-specific text when applicable.
- Streaks in TopBar and cards remain current-running streaks computed from historical logs and real today.
- Optimistic habit saves replace or insert the selected date in historical logs so streaks can recompute after past backfills.
- Gym, Japanese, and DSA habit cards with streak tracking.
- Overall streak in TopBar; gym done, gym rest day, or Sunday can satisfy gym.
- Gym workout type selection opens the workout drawer without marking gym done until an exercise set is saved.
- Rest day writes to the selected date and enforces max 2 rest days for the week containing the selected date.
- WorkoutDrawer supports selected-date exercise logging, add exercise, graph view, selected-date delete, remove-from-category (multi-tag only), session delete, and transfer.
- Cable exercises support Big 7kg, Medium 5kg, and Small 2.3kg plates with `{ big, medium, small, reps }` payloads.
- Old cable rows using `{ plates, mini, reps }` still render and calculate correctly in the frontend until migrated.
- Cross-category lock disables "Add exercise" and "Log workout" in other category drawers when the selected date's session exists in another category.
- "Remove from [WorkoutType]" only shows for exercises tagged to 2+ categories.
- Removing a multi-tag exercise from a category deletes only that category's logs and removes the tag; habit reset fires if that removal leaves no gym logs on the selected date.
- `exercise_logs` operations are scoped by `workout_type`.
- ProgressGraph and days-since can use all category logs for cross-tagged exercises.
- DSA counters save immediately to the selected date and restore from selected-date `habit_logs.payload`.
- Japanese subtasks save immediately to the selected date and restore from selected-date `habit_logs.payload`.
- NeuralConstellation cursor attraction, node repulsion, and completion pulse remain active.
- Light/dark theme toggle, FloatingIcons, cursor spotlight, and canvas background remain active.
- Goals page lists goals, creates goals, edits progress/metadata/status, quick-adjusts progress, deletes goals with rollback, and shows summary metrics.
- Dashboard next milestone reads active dated goals and sorts by local-safe ISO date string comparison.
- Masters page opens the Add Country modal and sends insert requests; current failure is surfaced as a real Supabase RLS/setup error.
- Masters page loads country/university data through `countries` joined with nested `universities` when the DB is seeded and readable.
- Masters tree status dots, notes stars, notes index, completion counts, add/remove flows, research/refresh actions, and step progress remain wired for environments with data.
- Masters report pages render tabbed reports from `static_research` + `dynamic_research`, citation links, source lists, notes, and dynamic refresh actions.
- Masters research uses Gemini 2.5 Flash Google Search grounding, grouped prompts, grounding metadata source extraction, concurrent prompt collection, refresh source preservation, and quota-safe no-save behavior.
- Report citation parsing supports single citations, comma-separated citations, and citation ranges.
- Masters refresh failures show a friendly inline notice and preserve existing report data.
- Browser QA passed 30/30 on 2026-07-17 after the dashboard date selector change.

## Decisions Made (do not reverse without explicit user instruction)
- Dashboard is the single source of truth for selected-date habit state.
- `selectedDate` is page-local and resets to `getLocalDate()` on page load/navigation.
- Future dates are blocked in both UI controls and Dashboard state.
- Streaks are current status indicators and always compute from real today, not the selected historical date.
- Selected-date habit writes use `log_date: selectedDate`; the unique constraint on `(habit_key, log_date)` handles insert/update.
- Workout drawer exercise writes, transfers, and deletes use `selectedDate` for `exercise_logs`.
- Optimistic logs are sorted descending after insertion so backfilled past sessions do not become most-recent entries.
- Dark mode is default, light mode is secondary.
- Navbar readable states are explicit: dark hover uses `rgba(99,102,241,0.12)` with `#E8E8F0`; light hover uses `#EEF2FF` with `#4338CA`.
- Global placeholder styling lives in src/index.css and uses muted theme-specific colors with `opacity: 1`.
- Cable medium plates are 5kg each; cable total weight is `(big * 7) + (medium * 5) + (small * 2.3)`.
- New cable payload shape is `{ big, medium, small, reps }`; compatibility helpers should remain until old rows have been migrated.
- `getLocalDate()` / `todayStr()` local-date utilities are required for app date comparisons; do not use UTC date slicing for local-date behavior.
- Date-only goal targets should be formatted by splitting `YYYY-MM-DD` into local date parts, not by UTC parsing.
- Masters research provider calls live in Supabase Edge Function `masters-research`; never put Gemini/service-role secrets in Vite browser code.
- Gemini 2.5 Flash with Google Search grounding is the Masters research provider path; do not reintroduce Claude `web_search`.
- Masters initial research writes static and dynamic research together; refresh overwrites only `dynamic_research` and `dynamic_refreshed_at`.
- Masters refresh must preserve source rows cited by static research and offset new dynamic citations.
- Research runs must not save `synthesis_error` payloads when all grouped prompts fail or Gemini quota is exceeded.
- Report citation parsing must support single citations, comma-separated citations, and citation ranges.
- Masters research status is client-derived: no `static_researched_at` means unresearched; `dynamic_refreshed_at` older than 180 days means stale; otherwise complete.
- `research_sources.entity_id` has no FK, so app code deletes related research sources before deleting countries/universities.
- Masters frontend should surface real Supabase setup/RLS errors instead of generic add/load/delete failures.
- Gym workout type selection is not a completed gym habit until at least one exercise set is saved.
- Rest day is the only gym path that can immediately satisfy gym without exercise logs.
- `exercise_logs` unique constraint is `(exercise_id, log_date, workout_type)`.
- All exercise log upserts must include `workout_type` and use the three-column onConflict.
- Category-scoped delete: multi-tag removes only the current category's logs and tag; single-tag deletes everything.
- Transfer uses the source exercise's id directly - never inserts a new exercise row.
- Graph and days-since are global across category logs; forms, selected-day exercise logs, PR detection, and delete operations are category-scoped.
- DSA saves immediately on every counter adjustment; no debounce is currently used.
- Card surfaces use CSS classes (`habit-card`, `habit-card-done`, `drawer-card-bg`) instead of Tailwind dark surface classes.
- Every implementation session ends with QA, code quality, handoff update, commit, and `git push origin main`.
- Non-local hosts load Google Fonts and Tabler Icons from CDN. Localhost uses the `html.local-assets` fallback to keep browser QA usable when external resources are blocked.

## Unresolved Issues
- The configured Supabase project recently had 0 Masters countries/universities and blocked anon `countries` inserts with RLS error 42501. Run the `Repair: Masters RLS policies + seed countries` block in supabase_setup.sql before live Masters Add Country/Research E2E can pass.
- Cable payload migration must be run manually in Supabase SQL editor. Migration SQL is at the bottom of supabase_setup.sql.
- DB migration for workout_type may still need to be run manually in Supabase SQL editor in environments that have not applied it yet. Migration SQL is in supabase_setup.sql (commented statements near the bottom).
- Repeated live research can exhaust Gemini free-tier quota (`GenerateRequestsPerDayPerProjectPerModel-FreeTier`, limit 20 for `gemini-2.5-flash` on the tested key). The UI surfaces a friendly quota message and keeps existing reports unchanged.
- Pre-existing `logged_at: new Date().toISOString()` usage remains in some files despite the current code-quality preference for local date utilities.

## Files Changed This Session
- `src/pages/Dashboard.jsx` - selectedDate state, selected-date loading, optimistic selected-date log updates, past-date banner, card prop threading.
- `src/components/TopBar.jsx` - date selector controls and lightweight calendar popover.
- `src/components/AllDoneBanner.jsx` - selected-date banner text.
- `src/components/GymCard.jsx` - selected-date gym saves, rest cap, workout session cleanup, and drawer prop threading.
- `src/components/WorkoutDrawer.jsx` - selected-date exercise log save/delete/transfer/session handling.
- `src/components/ExerciseCard.jsx` - selected-date form state, exercise log writes, and selected-date labels.
- `src/components/JapaneseCard.jsx` - selected-date subtask restore/save.
- `src/components/DSACard.jsx` - selected-date counter restore/save.
- `src/index.css` - date selector light/dark surface styles.
- `qa_reports/qa_20260717_dashboard_date_selector.md` - QA report.
- `qa_reports/code_quality_20260717_dashboard_date_selector.md` - code-quality report.
- `CLAUDE.md` - appended QA history entry.
- `HANDOFF.md` - refreshed session handoff.

## QA Status
Last QA run: 2026-07-17T22:56:21+05:30
Pass rate: focused QA 20/20; browser QA 30/30; build passed
Report: qa_reports/qa_20260717_dashboard_date_selector.md
