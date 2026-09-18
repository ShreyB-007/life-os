import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.107.0'
import { GoogleGenerativeAI } from 'npm:@google/generative-ai'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const GEMINI_MODEL = 'gemini-2.5-flash'
const FEED_TYPES = ['global', 'india', 'ai_ml']

serve(async req => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { feedType, generatedDate } = await req.json()
    if (!FEED_TYPES.includes(feedType)) throw new Error('Invalid feedType')
    if (!generatedDate) throw new Error('generatedDate is required')

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const { stories, sources } = await generateDigest(feedType)
    const content = { stories, sources }

    const { data, error } = await supabase
      .from('news_digests')
      .upsert(
        { feed_type: feedType, generated_date: generatedDate, content },
        { onConflict: 'feed_type,generated_date' },
      )
      .select()
      .single()

    if (error) throw error
    return jsonResponse({ digest: data })
  } catch (error) {
    return jsonResponse({ error: error.message ?? 'Digest generation failed' }, 500)
  }
})

async function generateDigest(feedType) {
  const apiKey = Deno.env.get('GEMINI_API_KEY')
  if (!apiKey) throw new Error('GEMINI_API_KEY is not configured')

  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({ model: GEMINI_MODEL })

  let result
  try {
    result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: buildPrompt(feedType) }] }],
      tools: [{ googleSearch: {} }],
    })
  } catch (error) {
    if (isQuotaError(error.message)) {
      throw new Error('Gemini quota exceeded. Try again after the quota resets.')
    }
    throw new Error(error.message ?? 'Gemini request failed')
  }

  const { text, citations } = extractGeminiTextAndCitations(result.response)
  const stories = extractStories(text)
  const sources = citations.map((citation, index) => ({
    citation_index: index + 1,
    source_url: citation.url,
    source_title: citation.title,
  }))
  return { stories, sources }
}

function buildPrompt(feedType) {
  const focus = {
    global: 'the most significant world news events from today or the last 24 hours, across politics, economics, conflict, and major global developments',
    india: 'the most significant India-specific news from today or the last 24 hours, across politics, economics, and major national developments',
    ai_ml: "the most notable AI/ML developments from today or the last 24 hours — model releases, research breakthroughs, industry moves, and significant product launches, relevant to a software engineer's professional field",
  }[feedType]

  return `Use Google Search grounding to find ${focus}.

Select 5-8 of the most significant, current stories. For each, write a short 2-3 sentence summary in plain, neutral language, and note which site(s) informed it if identifiable.

Return ONLY a strict JSON array (no markdown fences, no prose outside the array) matching this schema:
[{"headline": "", "summary": "", "source_hint": ""}]

"source_hint" should be a short human-readable hint like "Reuters, BBC" or "" if unclear. Do not hallucinate stories — only include what search grounding actually surfaced.`
}

function extractGeminiTextAndCitations(response) {
  const textParts = []
  const citations = []

  try {
    const text = response.text()
    if (text) textParts.push(text)
  } catch (_) {
    for (const candidate of response.candidates ?? []) {
      for (const part of candidate.content?.parts ?? []) {
        if (part.text) textParts.push(part.text)
      }
    }
  }

  for (const candidate of response.candidates ?? []) {
    const metadata = candidate.groundingMetadata ?? {}
    for (const chunk of metadata.groundingChunks ?? []) {
      const web = chunk.web
      if (web?.uri) citations.push({ url: web.uri, title: web.title ?? web.uri })
    }
  }

  return { text: textParts.join('\n'), citations: dedupeCitations(citations) }
}

function dedupeCitations(citations) {
  const seen = new Set()
  return citations.filter(citation => {
    if (seen.has(citation.url)) return false
    seen.add(citation.url)
    return true
  })
}

function extractStories(text) {
  const clean = text.replace(/```json|```/g, '').trim()
  const start = clean.indexOf('[')
  const end = clean.lastIndexOf(']')
  if (start === -1 || end === -1) throw new Error('No JSON array found in Gemini response')
  const parsed = JSON.parse(clean.slice(start, end + 1))
  if (!Array.isArray(parsed)) throw new Error('Gemini response was not a JSON array')
  return parsed.map(story => ({
    headline: String(story.headline ?? '').trim() || 'Untitled',
    summary: String(story.summary ?? '').trim(),
    source_hint: String(story.source_hint ?? '').trim(),
  }))
}

function isQuotaError(message) {
  return String(message ?? '').includes('[429 Too Many Requests]') ||
    String(message ?? '').toLowerCase().includes('quota exceeded')
}

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'content-type': 'application/json' },
  })
}
