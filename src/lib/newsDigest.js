import { supabase } from './supabase'

export const FEED_TYPES = ['global', 'india', 'ai_ml']

export const FEED_LABELS = {
  global: 'Global',
  india: 'India',
  ai_ml: 'AI/ML',
}

export const FEED_ACCENT_COLORS = {
  global: '#6366F1',
  india: '#F97316',
  ai_ml: '#06B6D4',
}

export const FEED_SEARCHING_LABELS = {
  global: 'Searching the web for today’s global news...',
  india: 'Searching the web for today’s India news...',
  ai_ml: 'Searching the web for today’s AI/ML news...',
}

export async function fetchDigest(feedType, generatedDate) {
  const { data, error } = await supabase
    .from('news_digests')
    .select('*')
    .eq('feed_type', feedType)
    .eq('generated_date', generatedDate)
    .maybeSingle()

  if (error) throw error
  return data
}

export async function runNewsDigest({ feedType, generatedDate }) {
  const { data, error } = await supabase.functions.invoke('news-digest', {
    body: { feedType, generatedDate },
  })

  if (error) {
    const response = error.context
    if (response?.json) {
      let edgeError = ''
      try {
        const payload = await response.clone().json()
        edgeError = payload?.error ?? ''
      } catch (_) {}
      if (edgeError) throw new Error(edgeError)
    }
    throw error
  }
  if (data?.error) throw new Error(data.error)
  return data.digest
}

export function getNewsDigestErrorMessage(error) {
  const message = error?.message || 'Digest generation failed.'
  const lower = message.toLowerCase()

  if (lower.includes('quota') || lower.includes('rate limit') || lower.includes('resource_exhausted')) {
    return 'Gemini quota reached for today. Try refreshing again after the quota resets.'
  }

  return message
}

export function formatDigestTime(dateString) {
  if (!dateString) return null
  const date = new Date(dateString)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}
