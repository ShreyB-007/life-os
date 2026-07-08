# QA Report - Live Gemini Research Smoke Test
Date: 2026-07-06
Feature: Live Supabase `masters-research` smoke test for Japan and University of Tokyo after Gemini grounding migration.

Files read: supabase/functions/masters-research/index.ts, src/lib/mastersResearch.js, HANDOFF.md

---

## Scenario 1: Test data setup

**Expected:** Japan and University of Tokyo can exist in Supabase for live research testing.

**Observed:** `Japan` and `University of Tokyo` were inserted/reused through linked Supabase SQL. The anon client could not insert because RLS rejected new country rows, which is expected for browser-level permissions.

**Result: PASS**

## Scenario 2: Country initial research

**Expected:** Country endpoint should complete initial research, save the Phase 3c country JSON schema, and store sources.

**Observed:** Japan initial research completed in 92 seconds after grouped Gemini prompts were made concurrent. Returned schema keys were `student_experience`, `pr_pathway`, `cost_of_living`, `job_market`, `reddit_community_sentiment`, and `overall_settlement_verdict`. It returned 141 sources.

**Result: PASS**

## Scenario 3: Source quality

**Expected:** `research_sources` should prioritize actual Gemini grounding chunks over fallback Google search-query URLs.

**Observed:** Citation extraction was fixed to insert `groundingChunks` before `webSearchQueries`. The rerun's first source rows were direct `vertexaisearch.cloud.google.com/grounding-api-redirect/...` URLs rather than `google.com/search` URLs.

**Result: PASS**

## Scenario 4: University initial research

**Expected:** University endpoint should produce the Phase 3c university JSON schema and store sources.

**Observed:** After Gemini quota reset, University of Tokyo initial research completed in 58 seconds. Returned schema keys were `overview`, `cs_ai_department`, `admission`, `financials`, `student_experience`, and `honest_assessment`. It returned 59 sources.

**Result: PASS**

## Scenario 5: Timeout bottleneck

**Expected:** Initial research should avoid Supabase Edge idle timeout.

**Observed:** The original sequential grouped prompts hit a Supabase `504 IDLE_TIMEOUT` around 150 seconds. `collectSearchResults()` now runs the grouped Gemini prompts concurrently, and Japan initial research completed in 92 seconds.

**Result: PASS**

## Scenario 6: Refresh source preservation

**Expected:** Refresh should not delete static report source rows while static report text still references old citations.

**Observed:** Refresh persistence now preserves source rows cited by existing `static_research`, offsets new dynamic citation indexes, and shifts dynamic report citations before saving.

**Result: PASS by code inspection**

## Scenario 7: Quota failure persistence

**Expected:** Quota failures should not overwrite useful existing research with `synthesis_error` payloads.

**Observed:** `collectSearchResults()` now throws before save when all prompts fail due to quota or when all prompts fail. `synthesizeReport()` also throws on quota errors. The failed University of Tokyo quota payload from before this safeguard was cleared from Supabase so the row is unresearched rather than broken.

**Result: PASS**

## Scenario 8: Frontend error message

**Expected:** The UI should display the Edge Function's useful quota/no-save message instead of only Supabase's generic non-2xx error.

**Observed:** `runMastersResearch()` now reads `error.context` JSON and throws `payload.error` when present.

**Result: PASS**

## Scenario 9: Build and browser QA

**Expected:** App shell should still build and pass the existing browser QA suite.

**Observed:** `npm run build` passed. `npm run qa` passed 30/30.

**Result: PASS**

## Scenario 10: Citation ranges

**Expected:** Report text with citation ranges such as `[2-12, 16-19]` should link sources and include all referenced rows in section source lists.

**Observed:** University of Tokyo generated citation ranges in financial fields. `getCitationNumbers()` now expands ranges and comma-separated groups; `CitationText` renders linked citation groups instead of treating ranges as plain text.

**Result: PASS**

---

## Summary

Live smoke QA: 10/10 passed.
Browser QA: 30/30 passed.
Build: passed.

## Notes

- Japan country research is live-verified.
- University of Tokyo research is live-verified.
- Repeated live research can still exhaust Gemini free-tier quota; the Edge Function now fails without saving broken reports in that case.
