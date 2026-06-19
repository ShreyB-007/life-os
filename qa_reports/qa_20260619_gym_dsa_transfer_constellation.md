# QA Report - Gym Confirmation, Transfer Move, DSA Persistence, Constellation Repulsion (2026-06-19)

## Feature
Four fixes:
1. Gym workout selection is visual-only until a first exercise set is saved.
2. Transfer copies into the target and explicitly deletes source `exercise_logs`.
3. DSA saves immediately and restores today's counts from `todayLogs`.
4. Neural constellation keeps cursor attraction but adds inter-node repulsion.

## Code-Reading QA Scenarios

### Gym selection confirmation

**S1 - Click Push with no exercise logged**
- Expected: Push button highlights, status says "Push selected - log an exercise to confirm", no `habit_logs` write, streak unchanged.
- Actual: `doSelect()` only sets `selected`, opens `WorkoutDrawer`, and does not call `save()`. `isDone` is based on `confirmedWorkoutType` or rest day, so streak/done styling do not update. PASS

**S2 - Save first exercise set**
- Expected: First successful `exercise_logs` upsert writes gym `habit_logs` with `done=true`.
- Actual: `ExerciseCard.handleLog()` awaits the Supabase upsert before calling `onLogSave`; `WorkoutDrawer.handleLogSave()` calls `onFirstExerciseLogged` only when there was no existing today session; `GymCard.handleExerciseLogged()` calls `save(workoutType, false, true)`. PASS

**S3 - Open drawer and close without logging**
- Expected: Selected workout reverts; no habit log write occurs.
- Actual: `handleDrawerClose()` clears pending `selected` when it differs from `confirmedWorkoutType`. Since `doSelect()` never calls `save()`, no DB write occurs. PASS

**S4 - Rest day unchanged**
- Expected: Rest day still immediately writes `habit_logs` and counts for streak/all-done.
- Actual: `markRest()` still calls `save('rest', true, true)` immediately and clears any selected workout. PASS

**S5 - Existing confirmed workout, open alternate type view-only**
- Expected: Prior active session remains confirmed; closing alternate drawer restores active type.
- Actual: confirmed type remains from `todayLog`; pending `selected` is restored to `confirmedWorkoutType` on close. PASS

### Transfer flow

**S6 - Transfer fetches source logs by local date**
- Expected: Source logs are fetched for `fromType` and today's local date.
- Actual: `handleTransfer()` uses `getLocalDate()` and fetches `exercise_logs` for source exercise IDs. PASS

**S7 - Transfer copies before deleting**
- Expected: Each source log is upserted into a target exercise before source deletion.
- Actual: loop creates or finds target exercise, then awaits target `exercise_logs.upsert()` before Step 3. PASS

**S8 - Transfer explicitly deletes source rows**
- Expected: Direct awaited delete call removes rows where `exercise_id in sourceExerciseIds` and `log_date = getLocalDate()`.
- Actual: code calls `supabase.from('exercise_logs').delete().in('exercise_id', sourceExerciseIds).eq('log_date', getLocalDate())` and awaits it before cleanup. PASS

**S9 - Delete failure does not continue cleanup**
- Expected: Delete error is logged and transfer returns before cleanup/habit update.
- Actual: delete error logs `Transfer source delete failed:` and returns immediately after toast. PASS

**S10 - No-prior-history cleanup**
- Expected: Source exercises with zero remaining logs are removed from the library.
- Actual: after source delete, each source exercise is queried for remaining logs and deleted if none remain. PASS

**S11 - Habit payload updates target type**
- Expected: `habit_logs` is upserted to target workout type after source delete succeeds.
- Actual: Step 5 upserts gym `done=true`, `is_rest_day=false`, payload `{ workout_type: workoutType }`. PASS

**S12 - Local target drawer updates**
- Expected: Source no longer shows today's logs, target shows transferred logs, target selected on GymCard.
- Actual: `fetchData()` refreshes target drawer after delete/copy, and `onTransferComplete` updates GymCard's selected/confirmed target type. PASS

### DSA persistence

**S13 - Counter increment saves immediately**
- Expected: No debounce; every + press saves a Supabase upsert.
- Actual: `adjust()` updates `countsRef`, renders state, and calls `saveCounts(next)` immediately. PASS

**S14 - Counter decrement saves immediately and cannot go below zero**
- Expected: Every - press saves; values clamp at 0.
- Actual: `Math.max(0, prev[key] + delta)` clamps, then `saveCounts()` persists. PASS

**S15 - DSA payload shape is correct**
- Expected: `habit_key='dsa'`, `log_date=getLocalDate()`, `done=totalQuestions>0`, payload counts, `onConflict`.
- Actual: `saveCounts()` builds exactly that payload and uses `{ onConflict: 'habit_key,log_date' }`. PASS

**S16 - DSA upsert error is visible**
- Expected: Explicit error handling logs failed upsert.
- Actual: `if (error) console.error('DSA save failed:', error)`. PASS

**S17 - Reload restores today counts**
- Expected: Counts initialize from `todayLogs.dsa.payload`.
- Actual: `useEffect([todayLog])` loads `{ easy, med, hard }` from payload and updates `countsRef`; absent payload resets to zero. PASS

**S18 - Dashboard fetch uses local date**
- Expected: `todayLogs` lookup uses local date, not UTC date.
- Actual: `Dashboard.fetchAll()` uses `todayStr()`, which delegates to local date utility. PASS

### Neural constellation

**S19 - Cursor attraction reduced**
- Expected: Same attraction range with 30% reduced pull.
- Actual: attraction uses `theme.pullStrength * CURSOR_PULL_SCALE`, where scale is `0.7`. PASS

**S20 - Nodes repel and velocity is clamped**
- Expected: Pairwise repulsion applies below 90px and velocity is clamped to +/-1.5.
- Actual: nested pair loop applies `REPULSION_STRENGTH * (MIN_DISTANCE - distance) / MIN_DISTANCE`, then per-axis clamp uses `MAX_VELOCITY = 1.5`. PASS

## Browser QA

Command run with bundled Node and preview job:
`PREVIEW_URL=http://127.0.0.1:4173 node node_modules/@playwright/test/cli.js test -c qa/playwright.config.mjs`

Result: 28/30 passed.

Non-code failures:
- `network net-04`: external resource loads were blocked by the sandbox (`ERR_NETWORK_ACCESS_DENIED`), producing console errors.
- `topbar top-04`: Tabler icon font was blocked, so the `i.ti-flame` element existed but the icon rendered hidden.

## Summary

20/20 code-reading scenarios passed. Build passed. Browser suite reached 28/30 with two environment-dependent failures unrelated to the implemented fixes.
