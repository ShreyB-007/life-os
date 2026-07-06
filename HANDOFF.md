# Life OS — Handoff Log

## Meta
Last updated: 2026-07-06T17:34:32+05:30
Last updated by: Codex
Current phase: Phase 3 — Goals Page + Masters Research Agent

## Just Completed (this session)
- Replaced the Masters research Edge Function's Claude web-search path with Gemini Google Search grounding.
- Added `@google/generative-ai` and routed research calls through `gemini-2.5-flash` with `tools: [{ googleSearch: {} }]`.
- Consolidated country research into grouped static, dynamic, and Reddit/Quora sentiment prompts followed by final JSON synthesis.
- Consolidated university research into grouped static, dynamic admissions/financials, and Reddit/Quora sentiment prompts followed by final JSON synthesis.
- Updated Gemini grounding citation extraction to read `groundingMetadata.webSearchQueries` and `groundingMetadata.groundingChunks` for `research_sources`.
- Updated Masters research progress labels to match grouped initial and refresh flows.
- Updated environment documentation to require `GEMINI_API_KEY` for the Edge Function.
- Ran code-reading QA, code-quality checks, production build, and browser QA.

## In Progress (incomplete — pick up here first)
None — see Queued Next.

## Queued Next (in priority order)
1. Configure Supabase Edge Function secret `GEMINI_API_KEY` before using live research.
2. Redeploy `masters-research` to Supabase so production uses the Gemini grounding implementation.
3. Smoke-test one country research run from `/masters`, then verify `static_research`, `dynamic_research`, timestamps, and `research_sources` rows in Supabase.
4. Phase 4 — News Feeds (Gemini), or Phase 3c polish if live research output needs UI/schema adjustments.

## Phase Completion Status
-> Phase 1 (Dashboard + Habits): ✅ Complete
-> Phase 2 (Gym Workout Tracker): ✅ Feature-complete — all known UX issues resolved
-> Phase 3 (Goals Page + Masters Research Agent): Feature implemented — Goals complete, Masters foundation complete, Gemini-grounded research agent/report pages implemented; provider secret and live smoke test still needed
-> Phase 4 (News Feeds — Gemini): ⏳ Not started
-> Phase 5 (Weekly Review + Polish): ⏳ Not started

## Known Working Features (do not regress these)
- Gym, Japanese, and DSA habit cards with streak tracking.
- Overall streak in TopBar; gym done, gym rest day, or Sunday can satisfy gym.
- AllDoneBanner appears when all three daily habits are satisfied.
- Gym workout type selection opens the workout drawer without marking gym done until an exercise set is saved.
- Rest day still writes immediately and enforces max 2 rest days per Mon-Sun week.
- WorkoutDrawer supports exercise logging, add exercise, graph view, delete today, remove-from-category (multi-tag only), session delete, and transfer.
- **Cross-category lock**: if any exercise is logged today in category X, opening any other category drawer disables both "Add exercise" and the "Log workout" button on every ExerciseCard. Button label reads "Logged in another category today".
- "Remove from {workoutType}" button ONLY shows for exercises tagged to 2+ categories. Single-tag exercises do not show the button.
- Removing a multi-tag exercise from a category deletes only that category's logs and removes the tag; if the exercise had today's log and no other exercises still have today's logs, `onResetGymHabit` fires (streak reverts, drawer stays open).
- exercise_logs scoped by workout_type for form/PR/delete: each drawer's form, todayLog, and delete operations only act on the current category.
- ProgressGraph shows sessions across ALL categories for a cross-tagged exercise. Tooltip includes (CategoryName).
- Days-since and streak badge (last30Count) reflect the most recent session across ALL categories.
- "Remove from [WorkoutType]" (Case A): removes tag + deletes only that category's logs; exercise survives in other categories.
- Transfer: moves today's source logs into the target type using the SAME exercise_id (no duplicate rows ever created). Tags updated in-place. Source tag removed if no remaining logs use it.
- purgeOrphanDuplicates: on every fetchData, same-name zero-log orphan exercises in the category are auto-deleted.
- HistoryDrawer groups sessions by workout_type sub-headers for multi-tag exercises.
- DSA counters save immediately and restore from today's `habit_logs.payload` on reload.
- NeuralConstellation cursor attraction remains active while node repulsion prevents pile-ups.
- Light/dark theme toggle, FloatingIcons, cursor spotlight, and canvas background remain active.
- Goals page lists all goals, creates new goals, edits progress/metadata/status, quick-adjusts progress by 5%, deletes goals with rollback on failure, and shows summary metrics.
- Dashboard next milestone reads active dated goals and sorts by local-safe ISO date string comparison.
- Masters page loads country/university data, shows tree status dots, notes stars, notes index, research completion counts, add/remove flows, active research/refresh actions, and step progress during research.
- Masters country and university report pages render tabbed reports from `static_research` + `dynamic_research`, citation links, source lists, notes, and dynamic refresh actions.
- Masters research now uses Gemini 2.5 Flash Google Search grounding, grouped prompts, and grounding metadata source extraction.
- Visual QA `vis-03` is scoped to the habit check-ins grid and tolerates duplicate live text elsewhere on the dashboard.

## Decisions Made (do not reverse without explicit user instruction)
- Dark mode is default, light mode is secondary.
- `getLocalDate()` / `todayStr()` local-date utilities are required for all app date comparisons; do not use UTC date slicing.
- Date-only goal targets should be formatted by splitting `YYYY-MM-DD` into local date parts, not by UTC parsing.
- Masters research provider calls live in Supabase Edge Function `masters-research`; never put Gemini/service-role secrets in Vite browser code.
- Gemini 2.5 Flash with Google Search grounding is the Masters research provider path; do not reintroduce Claude `web_search`.
- Masters static research is written only during initial research. Dynamic refresh overwrites `dynamic_research` and `dynamic_refreshed_at` only.
- Masters research status is client-derived: no `static_researched_at` means unresearched; `dynamic_refreshed_at` older than 180 days means stale; otherwise complete.
- `research_sources.entity_id` has no FK, so app code deletes related research sources before deleting countries/universities.
- Gym workout type selection is not a completed gym habit until at least one exercise set is saved.
- Rest day is the only gym path that can immediately satisfy gym without exercise logs.
- exercise_logs unique constraint is `(exercise_id, log_date, workout_type)` — three-column conflict key.
- All exercise_logs upserts must include `workout_type` and use the new three-column onConflict.
- Category-scoped delete: multi-tag removes only the current category's logs and tag; single-tag deletes everything.
- Transfer uses the source exercise's id directly — never inserts a new exercise row. Tags updated via array update.
- purgeOrphanDuplicates uses count=0 across ALL dates and types as the safe-delete criterion.
- Graph and days-since are global (allLogs): show data from all categories for cross-tagged exercises.
- Form, todayLog, PR detection, and delete operations are category-scoped (logs): never bleed across categories.
- DSA saves immediately on every counter adjustment; no debounce is currently used.
- Card surfaces use CSS classes (`habit-card`, `habit-card-done`, `drawer-card-bg`) instead of Tailwind dark surface classes.
- Every session ends with `git push origin main` to trigger Vercel auto-deploy.
- Cross-category lock applies only to the "Log workout" button and "Add exercise" button — view graph, delete today, and remove-from-category remain functional in viewOnly drawers.
- Non-local hosts load Google Fonts and Tabler Icons from CDN. Localhost uses the `html.local-assets` fallback to keep browser QA usable when external resources are blocked.

## Unresolved Issues
- DB migration must be run manually in Supabase SQL editor before the workout_type feature works. Migration SQL is in supabase_setup.sql (commented out statements at the bottom).
- Phase 3b Masters SQL must be run manually in Supabase SQL editor before `/masters` can load live country/university data in production.
- Supabase Edge Function `masters-research` must be redeployed after this commit, and `GEMINI_API_KEY` must be configured as a function secret before live research can run.

## Files Changed This Session
- `.env.example` — documented `GEMINI_API_KEY` as the required Edge Function research secret.
- `package.json` — added `@google/generative-ai`.
- `package-lock.json` — locked `@google/generative-ai`.
- `src/lib/mastersResearch.js` — updated grouped research progress labels and refresh-mode steps.
- `src/pages/Masters.jsx` — passed research mode into progress step selection.
- `supabase/functions/masters-research/index.ts` — migrated research orchestration to Gemini 2.5 Flash Google Search grounding, grouped prompts, and grounding metadata source extraction.
- `qa_reports/qa_20260706_gemini_grounding_research.md` — code-reading and browser QA report.
- `qa_reports/code_quality_20260706_gemini_grounding_research.md` — code-quality report.
- `CLAUDE.md` — appended QA history entry.
- `HANDOFF.md` — refreshed session handoff.

## QA Status
Last QA run: 2026-07-06T17:29:57+05:30
Pass rate: code-reading QA 10/10; browser QA 30/30; build passed
Report: qa_reports/qa_20260706_gemini_grounding_research.md
