# QA Report - Masters Quota Notice
Date: 2026-07-09
Feature: Friendly Masters research quota and refresh failure state.

Files read: src/lib/mastersResearch.js, src/components/MastersReportComponents.jsx, src/pages/Masters.jsx, src/pages/MastersCountryReport.jsx, src/pages/MastersUniversityReport.jsx

---

## Scenario 1: Main Masters research quota failure

**Expected:** If the Edge Function returns a quota/rate-limit/resource-exhausted error, the Masters page shows a friendly message and does not imply the report was overwritten.

**Observed:** `handleResearch()` now routes caught errors through `getMastersResearchErrorMessage()`, which maps quota-style failures to: "Provider quota exceeded. Your existing report was not changed; try refreshing again after the Gemini quota resets."

**Result: PASS**

## Scenario 2: Country report refresh failure

**Expected:** A failed country refresh clears the loading state, preserves the existing country report, and displays an inline notice.

**Observed:** `refreshDynamicData()` now uses `try/catch/finally`, only updates `country` and `sources` after a successful `runMastersResearch()`, writes friendly errors to `refreshError`, and always calls `setRefreshing(false)`.

**Result: PASS**

## Scenario 3: University report refresh failure

**Expected:** A failed university refresh clears the loading state, preserves the existing university report, and displays an inline notice.

**Observed:** `refreshDynamicData()` now mirrors the country report behavior and preserves `university.countries` only after a successful result.

**Result: PASS**

## Scenario 4: Inline notice presentation

**Expected:** Refresh errors appear as a visible report-page notice without blocking report reading or navigation.

**Observed:** `ReportNotice` renders a compact amber notice below `ReportHero`; it does not replace the report content or disable tab navigation.

**Result: PASS**

## Scenario 5: University subtitle separator

**Expected:** University report subtitle should not render mojibake if the terminal or browser displays non-ASCII separators poorly.

**Observed:** University city/country subtitle now joins with ` - `.

**Result: PASS**

## Scenario 6: Current configured Masters data

**Expected:** Local `/masters` should load without runtime errors.

**Observed:** Approved Playwright inspection reached Supabase with no console errors, but the currently configured database returned `0 of 0` countries/universities, so live report pages could not be opened from local data in this session.

**Result: PASS with data caveat**

## Scenario 7: Regression browser QA

**Expected:** Existing dashboard/navigation/theme/network/visual QA should continue to pass.

**Observed:** `node .\node_modules\@playwright\test\cli.js test -c qa\playwright.config.mjs` passed 30/30 with network approval. The first sandboxed run had 29/30 because external requests were blocked by Codex sandbox policy.

**Result: PASS**

---

## Summary

Code-reading QA: 7/7 passed.
Browser QA: 30/30 passed with network approval.
Build: passed via `node .\node_modules\vite\bin\vite.js build`.
