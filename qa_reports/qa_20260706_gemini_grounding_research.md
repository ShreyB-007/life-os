# QA Report - Gemini Grounding Masters Research
Date: 2026-07-06
Feature: Replace Claude web_search research path with Gemini 2.5 Flash Google Search grounding and grouped prompts.

Files read: supabase/functions/masters-research/index.ts, src/lib/mastersResearch.js, src/pages/Masters.jsx, .env.example, package.json

---

## Scenario 1: Provider boundary

**Expected:** Masters research provider calls remain server-side and no AI provider secret is exposed in the Vite browser bundle.

**Observed:** Browser code still calls `supabase.functions.invoke('masters-research')`. `GEMINI_API_KEY` is referenced only by the Supabase Edge Function and `.env.example`.

**Result: PASS**

## Scenario 2: Gemini model and tool config

**Expected:** Gemini calls use `gemini-2.5-flash` with `tools: [{ googleSearch: {} }]` in `generateContent`.

**Observed:** `LLMService.generateContent()` creates a `GoogleGenerativeAI` client, uses `GEMINI_MODEL = 'gemini-2.5-flash'`, and passes the Google Search grounding tool for grounded research prompts.

**Result: PASS**

## Scenario 3: Claude web_search removal

**Expected:** Research should not use Claude's `web_search` tool or Anthropic provider secrets.

**Observed:** `supabase/functions/masters-research/index.ts` no longer contains Anthropic, Claude, `web_search_20250305`, or `AI_PROVIDER` runtime code.

**Result: PASS**

## Scenario 4: Country prompt consolidation

**Expected:** Initial country research uses three grouped grounded prompts plus one synthesis prompt.

**Observed:** `buildCountryResearchPrompts()` returns static country context, current country data, and Reddit/Quora sentiment prompts for initial mode. `synthesizeReport()` runs the final JSON synthesis after collection.

**Result: PASS**

## Scenario 5: University prompt consolidation

**Expected:** Initial university research uses three grouped grounded prompts plus one synthesis prompt.

**Observed:** `buildUniversityResearchPrompts()` returns static university context, current admissions/financials, and Reddit/Quora sentiment prompts for initial mode. `synthesizeReport()` runs the final JSON synthesis after collection.

**Result: PASS**

## Scenario 6: Refresh mode

**Expected:** Refresh should collect current/dynamic data only and preserve the existing output schema behavior.

**Observed:** Refresh mode sends only the dynamic grouped prompt before synthesis. `buildResearchPayload()` still updates only `dynamic_research` and `dynamic_refreshed_at` for refresh.

**Result: PASS**

## Scenario 7: Citation extraction

**Expected:** Research sources are populated from Gemini grounding metadata.

**Observed:** `extractGeminiTextAndCitations()` reads `groundingMetadata.webSearchQueries` and `groundingMetadata.groundingChunks`. Search queries become Google Search URLs; grounded chunks become direct source URLs. `buildSources()` writes those URLs to `research_sources`.

**Result: PASS**

## Scenario 8: Progress UI

**Expected:** User-facing research progress should match the grouped prompt flow.

**Observed:** `getResearchSteps(entityType, mode)` now returns 3+1 initial steps and shorter dynamic refresh steps. `Masters.jsx` passes the current mode into the helper.

**Result: PASS**

## Scenario 9: Build verification

**Expected:** Production bundle compiles after dependency and UI helper changes.

**Observed:** `npm run build` passed. Vite reported only the existing large chunk warning.

**Result: PASS**

## Scenario 10: Browser QA

**Expected:** Existing app behavior is not regressed.

**Observed:** `npm run qa` passed all Playwright checks against `npm run preview`.

**Result: PASS**

---

## Summary

Code-reading feature QA: 10/10 passed.
Browser QA: 30/30 passed.
Build: passed.
