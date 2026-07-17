# QA Report - Dashboard Date Selector

Timestamp: 2026-07-17T22:56:21+05:30
Scope: Dashboard selected-date architecture, date picker UI, selected-date habit logging, workout drawer date flow, and streak behavior.

## Focused Code-Reading QA

- PASS: Default state initializes `selectedDate` to `getLocalDate()`, loads today's habit logs, and keeps streaks computed from the full historical `logs` state.
- PASS: Left arrow moves to the previous day, triggers `loadLogsForDate(selectedDate)`, and shows the past-date banner.
- PASS: Right arrow is disabled on today and clamped in code if any future date is attempted.
- PASS: Calendar popover renders a lightweight month grid, disables future dates, highlights today, fills the selected date, closes on outside click, and closes on date selection.
- PASS: Dashboard fetches selected-date `habit_logs` separately while preserving the full 400-day log cache used by streaks.
- PASS: Optimistic `onLog` updates replace or insert the selected date in historical logs, sort by date descending, and update selected-day `todayLogs` only when the saved log matches `selectedDate`.
- PASS: GymCard saves habit rows with `log_date: selectedDate`, opens WorkoutDrawer for `selectedDate`, clears same-date exercise logs when marking rest, and computes the two-rest-days cap from the week containing `selectedDate`.
- PASS: WorkoutDrawer uses `selectedDate` for exercise log save, delete, transfer, selected-date session detection, and gym habit confirmation.
- PASS: ExerciseCard reads/writes the selected date, resets form state when switching between blank dates, and keeps optimistic exercise logs sorted so past edits do not distort most-recent status.
- PASS: JapaneseCard restores blank subtasks for empty selected dates and saves subtasks to `selectedDate`.
- PASS: DSACard restores zero counts for empty selected dates and saves counters to `selectedDate`.
- PASS: AllDoneBanner derives completion from selected-date logs and changes text for past dates.

## Focused Browser Smoke

- PASS: On today's dashboard view, the right arrow is disabled.
- PASS: Clicking previous day shows the past-date banner and enables the right arrow.
- PASS: Clicking right arrow from yesterday returns to today and removes the banner.
- PASS: Opening the date button shows the calendar grid.
- PASS: Current-month next navigation is disabled to prevent future months.
- PASS: Selecting a past date through the calendar shows the banner.
- PASS: "Back to today" returns to today and removes the banner.
- PASS: No console errors were emitted during the focused smoke test.

## Automated Browser Regression

- PASS: Production build completed with `npm run build`.
- PASS: Playwright browser QA suite completed: 30/30 passed.
- PASS: `git diff --check` completed with no whitespace errors.

## Summary

Passed: 50
Failed: 0
Unclear: 0

Pass rate: 50/50.
