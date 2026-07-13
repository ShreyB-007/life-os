# QA Report - Navbar, Placeholder, and Cable Plate Quick Fixes
Date: 2026-07-13
Feature: Navbar hover contrast, global placeholder contrast/default zero styling, and cable medium plate support.

Files read: src/index.css, src/components/Navbar.jsx, src/components/ExerciseCard.jsx, src/components/HistoryDrawer.jsx, src/components/ProgressGraph.jsx, supabase_setup.sql

---

## Scenario 1: Navbar hover contrast in dark mode

**Expected:** Default nav text is muted, hover uses an indigo tint background with bright readable text, and active text remains bright with an indigo underline.

**Observed:** `.nav-link-hover` dark text is `#B0B0C8`; hover/focus background is `rgba(99, 102, 241, 0.12)` and text is `#E8E8F0`; active `.nav-link-wash.is-active` text is `#E8E8F0`, with the existing indigo underline.

**Result: PASS**

## Scenario 2: Navbar hover contrast in light mode

**Expected:** Default nav text is zinc-500, hover background is indigo-50, hover text is indigo-700, and active text is indigo-700 with an indigo-600 underline.

**Observed:** `.nav-link-hover` light text is `#71717A`; hover/focus background is `#EEF2FF` and text is `#4338CA`; active text is `#4338CA`, and `Navbar.jsx` uses `#4F46E5` for the active underline in light mode.

**Result: PASS**

## Scenario 3: Global placeholder contrast

**Expected:** All placeholders are visibly muted compared with entered text in both themes.

**Observed:** `src/index.css` defines global placeholder color rules with `!important`, dark placeholder color `#4A4A60`, light placeholder color `#AAAABC`, and opacity `1`. User-entered drawer input text still uses `var(--os-fg)`.

**Result: PASS**

## Scenario 4: Cable default-zero styling

**Expected:** Cable zero-valid plate fields show default `0` dimmed until focused; if blurred still at `0`, the dim style returns.

**Observed:** Cable `medium` and `small` inputs use `.default-zero` when value is `0` and the field is not focused. `onFocus` tracks the field and removes the dim class; `onBlur` restores it only when the value remains `0`.

**Result: PASS**

## Scenario 5: Cable set logging medium plate field

**Expected:** Cable set logging offers Big, Medium, Small, Reps fields and persists `{ big, medium, small, reps }`.

**Observed:** `ExerciseCard` renders Big, Medium, Small inputs in order and `buildPayload()` writes `{ big, medium, small, reps }`.

**Result: PASS**

## Scenario 6: Cable validation

**Expected:** Medium plates accept integers >= 0 with no maximum; small plates remain integer 0-2; big plates remain at least 1; reps remain at least 1.

**Observed:** `validateSet()` and input handlers enforce those constraints in both the live exercise card and history inline editor. Non-digits are stripped for all cable plate inputs.

**Result: PASS**

## Scenario 7: Existing cable rows remain readable

**Expected:** Existing rows using `{ plates, mini, reps }` still render and compute correctly until the SQL migration is run.

**Observed:** Cable normalization and calculation helpers read `big ?? plates` and `small ?? mini`, with `medium` defaulting to `0`.

**Result: PASS**

## Scenario 8: PR/progressive overload/graph use updated cable formula

**Expected:** Cable comparisons use `(big * 7) + (medium * 5) + (small * 2.3)`.

**Observed:** `ExerciseCard` PR detection/progressive arrows, `HistoryDrawer` PR history, and `ProgressGraph` values all route through updated cable weight helpers.

**Result: PASS**

## Scenario 9: Progress graph tooltip

**Expected:** Cable graph tooltip includes total kg plus full plate composition.

**Observed:** Cable graph tooltips render values like `21kg (3 big + 2 medium + 1 small)`, with reps included in combined entries.

**Result: PASS**

## Scenario 10: Regression browser QA

**Expected:** Existing navigation/theme/dashboard/network/visual checks continue to pass.

**Observed:** Browser QA first produced 29/30 in sandbox due only to `ERR_NETWORK_ACCESS_DENIED`; with network approval, Playwright passed 30/30.

**Result: PASS**

---

## Summary

Code-reading QA: 10/10 passed.
Browser QA: 30/30 passed with network approval.
Build: passed via bundled Node + Vite.
