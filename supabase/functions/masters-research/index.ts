import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.107.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const countryStaticSearches = [
  { key: 'student_experience', label: 'Student experience data collected', query: country => `${country.name} Indian international students experience living working` },
  { key: 'culture', label: 'Student experience data collected', query: country => `${country.name} foreigner expat reception culture society` },
  { key: 'pr_pathway', label: 'PR pathway data collected', query: country => `${country.name} permanent residency pathway Indian nationals skilled worker` },
  { key: 'job_market_static', label: 'Job market analysis collected', query: country => `${country.name} AI ML job market tech industry outlook` },
  { key: 'reddit_students', label: 'Community sentiment collected', query: country => `site:reddit.com ${country.name} Indian student experience` },
  { key: 'reddit_pr', label: 'Community sentiment collected', query: country => `site:reddit.com ${country.name} permanent residency process Indian` },
]

const countryDynamicSearches = [
  { key: 'pr_processing', label: 'PR pathway data collected', query: country => `${country.name} PR processing time 2025 2026 Indian nationals` },
  { key: 'cost_living', label: 'Cost of living data collected', query: country => `${country.name} cost of living student budget 2025 2026` },
  { key: 'salary_jobs', label: 'Job market analysis collected', query: country => `${country.name} AI ML software engineer salary job market 2025 2026` },
  { key: 'visa_policy', label: 'PR pathway data collected', query: country => `${country.name} international student visa work permit policy 2025 2026` },
]

const universityStaticSearches = [
  { key: 'department_reputation', label: 'CS and AI department data collected', query: (university, country) => `${university.name} ${country.name} CS computer science department reputation ranking` },
  { key: 'faculty', label: 'CS and AI department data collected', query: university => `${university.name} AI machine learning research faculty specialization` },
  { key: 'student_experience', label: 'Student experience data collected', query: university => `${university.name} international student experience Indian student review` },
  { key: 'reddit_cs', label: 'Student experience data collected', query: university => `site:reddit.com ${university.name} CS masters review experience` },
  { key: 'reddit_indian', label: 'Student experience data collected', query: university => `site:reddit.com ${university.name} Indian student masters` },
  { key: 'rankings', label: 'Overview data collected', query: university => `${university.name} QS ranking 2024 2025 computer science` },
  { key: 'alumni', label: 'CS and AI department data collected', query: university => `${university.name} alumni career outcomes AI ML industry` },
]

const universityDynamicSearches = [
  { key: 'tuition', label: 'Financial data collected', query: university => `${university.name} international tuition fees 2025 2026 masters CS` },
  { key: 'requirements', label: 'Admission data collected', query: university => `${university.name} masters CS admission requirements 2025 2026 GPA IELTS` },
  { key: 'deadlines', label: 'Admission data collected', query: university => `${university.name} masters CS application deadline Fall 2027` },
  { key: 'scholarships', label: 'Financial data collected', query: university => `${university.name} scholarship financial aid international student 2025 2026` },
  { key: 'intake', label: 'Admission data collected', query: university => `${university.name} masters CS intake size acceptance rate 2025` },
]

serve(async req => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { entityType, entityId, mode = 'initial' } = await req.json()
    if (!['country', 'university'].includes(entityType)) {
      throw new Error('Invalid entityType')
    }
    if (!['initial', 'refresh'].includes(mode)) {
      throw new Error('Invalid research mode')
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const context = await loadEntityContext(supabase, entityType, entityId)
    const searchResults = await collectSearchResults(entityType, context, mode)
    const sources = buildSources(entityType, entityId, searchResults)
    const report = await synthesizeReport(entityType, context, searchResults)
    const saved = await saveResearch(supabase, entityType, entityId, mode, report, searchResults, sources)

    return jsonResponse({ entity: saved, sources, report })
  } catch (error) {
    return jsonResponse({ error: error.message ?? 'Research failed' }, 500)
  }
})

async function loadEntityContext(supabase, entityType, entityId) {
  if (entityType === 'country') {
    const { data, error } = await supabase.from('countries').select('*').eq('id', entityId).single()
    if (error) throw error
    return { country: data }
  }

  const { data, error } = await supabase
    .from('universities')
    .select('*, countries(*)')
    .eq('id', entityId)
    .single()
  if (error) throw error
  return { university: data, country: data.countries }
}

async function collectSearchResults(entityType, context, mode) {
  const searches =
    entityType === 'country'
      ? [...(mode === 'initial' ? countryStaticSearches : []), ...countryDynamicSearches]
      : [...(mode === 'initial' ? universityStaticSearches : []), ...universityDynamicSearches]

  const results = []
  for (let index = 0; index < searches.length; index += 1) {
    const search = searches[index]
    const query = entityType === 'country'
      ? search.query(context.country)
      : search.query(context.university, context.country)

    try {
      const grounded = await callProvider(
        `Search the web for this exact research topic and return concise factual findings with citations: ${query}`,
        true,
      )
      results.push({ ...search, query, citationIndex: index + 1, ok: true, ...grounded })
    } catch (error) {
      results.push({
        ...search,
        query,
        citationIndex: index + 1,
        ok: false,
        text: 'Data unavailable - search failed',
        error: error.message ?? 'Search failed',
        citations: [],
      })
    }
  }
  return results
}

async function synthesizeReport(entityType, context, searchResults) {
  const prompt = entityType === 'country'
    ? buildCountrySynthesisPrompt(context.country, searchResults)
    : buildUniversitySynthesisPrompt(context.university, context.country, searchResults)

  try {
    const response = await callProvider(prompt, false)
    return extractJson(response.text)
  } catch (error) {
    return {
      synthesis_error: true,
      raw_results: searchResults,
      error_message: error.message ?? 'Report synthesis failed',
    }
  }
}

async function saveResearch(supabase, entityType, entityId, mode, report, searchResults, sources) {
  const now = new Date().toISOString()
  const table = entityType === 'country' ? 'countries' : 'universities'
  const payload = buildResearchPayload(entityType, mode, report, searchResults, now)

  await supabase.from('research_sources').delete().eq('entity_type', entityType).eq('entity_id', entityId)
  if (sources.length > 0) {
    const { error: sourceError } = await supabase.from('research_sources').insert(sources)
    if (sourceError) throw sourceError
  }

  const { data, error } = await supabase
    .from(table)
    .update(payload)
    .eq('id', entityId)
    .select()
    .single()

  if (error) throw error
  return data
}

function buildResearchPayload(entityType, mode, report, searchResults, now) {
  if (report.synthesis_error) {
    const rawPayload = { raw_results: searchResults, synthesis_error: true, error_message: report.error_message }
    return mode === 'refresh'
      ? { dynamic_research: rawPayload, dynamic_refreshed_at: now }
      : {
          static_research: rawPayload,
          dynamic_research: rawPayload,
          static_researched_at: now,
          dynamic_refreshed_at: now,
        }
  }

  if (entityType === 'country') {
    const staticResearch = {
      student_experience: report.student_experience,
      pr_pathway: {
        route_name: report.pr_pathway?.route_name,
        typical_timeline_years: report.pr_pathway?.typical_timeline_years,
        success_rate_for_indians: report.pr_pathway?.success_rate_for_indians,
        key_requirements: report.pr_pathway?.key_requirements,
        honest_assessment: report.pr_pathway?.honest_assessment,
      },
      reddit_community_sentiment: report.reddit_community_sentiment,
      overall_settlement_verdict: report.overall_settlement_verdict,
    }
    const dynamicResearch = {
      pr_pathway: { recent_policy_changes: report.pr_pathway?.recent_policy_changes },
      cost_of_living: report.cost_of_living,
      job_market: report.job_market,
    }
    return mode === 'refresh'
      ? { dynamic_research: dynamicResearch, dynamic_refreshed_at: now }
      : {
          static_research: staticResearch,
          dynamic_research: dynamicResearch,
          static_researched_at: now,
          dynamic_refreshed_at: now,
        }
  }

  const staticResearch = {
    overview: report.overview,
    cs_ai_department: report.cs_ai_department,
    student_experience: report.student_experience,
    honest_assessment: report.honest_assessment,
  }
  const dynamicResearch = {
    admission: report.admission,
    financials: report.financials,
  }
  return mode === 'refresh'
    ? { dynamic_research: dynamicResearch, dynamic_refreshed_at: now }
    : {
        static_research: staticResearch,
        dynamic_research: dynamicResearch,
        static_researched_at: now,
        dynamic_refreshed_at: now,
      }
}

async function callProvider(prompt, useSearch) {
  const provider = (Deno.env.get('AI_PROVIDER') ?? 'claude').toLowerCase()
  if (provider === 'gemini') return callGemini(prompt, useSearch)

  try {
    return await callClaude(prompt, useSearch)
  } catch (error) {
    if (Deno.env.get('GEMINI_API_KEY')) return callGemini(prompt, useSearch)
    throw error
  }
}

async function callClaude(prompt, useSearch) {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not configured')

  const body = {
    model: Deno.env.get('CLAUDE_MODEL') ?? 'claude-sonnet-4-6',
    max_tokens: 4096,
    messages: [{ role: 'user', content: prompt }],
    ...(useSearch ? { tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 3 }] } : {}),
  }

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'anthropic-version': '2023-06-01',
      'x-api-key': apiKey,
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) throw new Error(`Claude request failed: ${res.status}`)
  const json = await res.json()
  return extractClaudeTextAndCitations(json)
}

async function callGemini(prompt, useSearch) {
  const apiKey = Deno.env.get('GEMINI_API_KEY')
  if (!apiKey) throw new Error('GEMINI_API_KEY is not configured')

  const res = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify({
      model: Deno.env.get('GEMINI_MODEL') ?? 'gemini-3.5-flash',
      input: prompt,
      ...(useSearch ? { tools: [{ type: 'google_search' }] } : {}),
    }),
  })

  if (!res.ok) throw new Error(`Gemini request failed: ${res.status}`)
  const json = await res.json()
  return extractGeminiTextAndCitations(json)
}

function extractClaudeTextAndCitations(json) {
  const textParts = []
  const citations = []
  for (const block of json.content ?? []) {
    if (block.type === 'text') {
      textParts.push(block.text)
      for (const citation of block.citations ?? []) {
        if (citation.url) citations.push({ url: citation.url, title: citation.title ?? citation.url })
      }
    }
    if (block.type === 'web_search_tool_result') {
      for (const result of block.content ?? []) {
        if (result.url) citations.push({ url: result.url, title: result.title ?? result.url })
      }
    }
  }
  return { text: textParts.join('\n'), citations: dedupeCitations(citations) }
}

function extractGeminiTextAndCitations(json) {
  const textParts = []
  const citations = []
  for (const step of json.steps ?? []) {
    if (step.type !== 'model_output') continue
    for (const block of step.content ?? []) {
      if (block.type === 'text') {
        textParts.push(block.text)
        for (const annotation of block.annotations ?? []) {
          if (annotation.type === 'url_citation' && annotation.url) {
            citations.push({ url: annotation.url, title: annotation.title ?? annotation.url })
          }
        }
      }
    }
  }
  return { text: textParts.join('\n') || json.output_text || '', citations: dedupeCitations(citations) }
}

function buildSources(entityType, entityId, searchResults) {
  const sources = []
  for (const result of searchResults) {
    const citation = result.citations?.[0]
    if (!citation) {
      sources.push({
        entity_type: entityType,
        entity_id: entityId,
        citation_index: result.citationIndex,
        source_url: `search:${result.query}`,
        source_title: result.query,
        source_type: inferSourceType(result.query),
      })
      continue
    }
    sources.push({
      entity_type: entityType,
      entity_id: entityId,
      citation_index: result.citationIndex,
      source_url: citation.url,
      source_title: citation.title,
      source_type: inferSourceType(`${citation.url} ${citation.title}`),
    })
  }
  return sources
}

function inferSourceType(text) {
  const value = text.toLowerCase()
  if (value.includes('reddit.com')) return 'reddit'
  if (value.includes('quora.com')) return 'quora'
  if (value.includes('ranking') || value.includes('qs') || value.includes('timeshighereducation')) return 'ranking'
  if (value.includes('.edu') || value.includes('.ac.') || value.includes('gov')) return 'official'
  if (value.includes('news')) return 'news'
  return 'web'
}

function buildCountrySynthesisPrompt(country, results) {
  return `${countrySystemPrompt()}

Country: ${country.name}

Search results:
${formatSearchResults(results)}

Return only strict JSON matching the requested schema.`
}

function countrySystemPrompt() {
  return `You are a research assistant helping an Indian CS student (final year, AI/ML specialization) evaluate countries for Masters study and long-term settlement. Synthesize the provided search results into a structured JSON report. Be factual, cite sources by index number [1], [2] etc, and be honest about negatives - do not only present positives. This student wants to settle permanently, so PR pathway and quality of life for a working professional matter as much as the university itself. Do not hallucinate. If a piece of information is not in the search results, say "No data found" for that field rather than guessing.

Output schema:
{
  "student_experience": {"indian_community": "", "cultural_adjustment": "", "language_barrier": "", "safety": "", "social_life": ""},
  "pr_pathway": {"route_name": "", "typical_timeline_years": "", "success_rate_for_indians": "", "key_requirements": [], "recent_policy_changes": "", "honest_assessment": ""},
  "cost_of_living": {"monthly_student_budget_usd": "", "rent_range_usd": "", "groceries_monthly_usd": "", "transport_monthly_usd": "", "source_year": "2025/2026"},
  "job_market": {"ai_ml_demand": "", "average_salary_usd": "", "top_employers": [], "job_market_honest_assessment": ""},
  "reddit_community_sentiment": {"summary": "", "common_positives": [], "common_negatives": [], "representative_quotes": []},
  "overall_settlement_verdict": ""
}`
}

function buildUniversitySynthesisPrompt(university, country, results) {
  return `${universitySystemPrompt()}

University: ${university.name}
Country: ${country.name}
City: ${university.city ?? 'No data found'}

Search results:
${formatSearchResults(results)}

Return only strict JSON matching the requested schema.`
}

function universitySystemPrompt() {
  return `You are a research assistant helping an Indian CS student with AI/ML specialization evaluate Masters programs. Synthesize the provided search results into a structured JSON report. Be factual, cite sources by index number [1], [2] etc, and be honest about negatives. Do not hallucinate. If information is not in the search results, say "No data found".

Output schema:
{
  "overview": {"founded": "", "location": "", "overall_qs_ranking": "", "cs_specific_ranking": "", "university_type": "", "campus_size": ""},
  "cs_ai_department": {"department_reputation": "", "ai_ml_faculty_highlights": [], "research_areas": [], "industry_connections": "", "reddit_consensus": ""},
  "admission": {"program_name": "", "duration_years": "", "intake": "", "gpa_requirement": "", "english_requirement": "", "gre_required": "", "work_experience_expected": "", "application_deadline_fall2027": "", "acceptance_rate_estimate": "", "intake_size_estimate": ""},
  "financials": {"annual_tuition_usd": "", "total_program_cost_usd": "", "scholarships_available": "", "scholarship_names": [], "ta_ra_opportunities": ""},
  "student_experience": {"indian_community_size": "", "campus_life": "", "housing_options": "", "reddit_honest_review": ""},
  "honest_assessment": {"strengths": [], "weaknesses": [], "fit_for_ai_ml_career": "", "overall_verdict": ""}
}`
}

function formatSearchResults(results) {
  return results
    .map(result => `[${result.citationIndex}] ${result.query}\n${result.text}`)
    .join('\n\n')
}

function extractJson(text) {
  const clean = text.replace(/```json|```/g, '').trim()
  const start = clean.indexOf('{')
  const end = clean.lastIndexOf('}')
  if (start === -1 || end === -1) throw new Error('No JSON object found in synthesis')
  return JSON.parse(clean.slice(start, end + 1))
}

function dedupeCitations(citations) {
  const seen = new Set()
  return citations.filter(citation => {
    if (seen.has(citation.url)) return false
    seen.add(citation.url)
    return true
  })
}

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'content-type': 'application/json' },
  })
}
