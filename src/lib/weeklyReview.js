import { supabase } from './supabase'

export const MIN_LOGGED_DAYS_FOR_REVIEW = 3

export async function fetchReview(weekStartDate) {
  const { data, error } = await supabase
    .from('weekly_reviews')
    .select('*')
    .eq('week_start_date', weekStartDate)
    .maybeSingle()

  if (error) throw error
  return data
}

// Distinct days within [weekStartDate, today] that have any habit activity
// (a completed habit or a logged rest day). Used to gate auto-generation so a
// near-empty first week doesn't produce a thin, low-quality review.
export async function countLoggedDaysInWeek(weekStartDate, today) {
  const { data, error } = await supabase
    .from('habit_logs')
    .select('log_date')
    .in('habit_key', ['gym', 'japanese', 'dsa'])
    .gte('log_date', weekStartDate)
    .lte('log_date', today)
    .or('done.eq.true,is_rest_day.eq.true')

  if (error) throw error
  return new Set((data ?? []).map(row => row.log_date)).size
}

export async function runWeeklyReview({ weekStartDate, today }) {
  const { data, error } = await supabase.functions.invoke('weekly-review', {
    body: { weekStartDate, today },
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
  return data.review
}

export function getWeeklyReviewErrorMessage(error) {
  const message = error?.message || 'Review generation failed.'
  const lower = message.toLowerCase()

  if (lower.includes('quota') || lower.includes('rate limit') || lower.includes('resource_exhausted')) {
    return 'Gemini quota reached for today. Try refreshing again after the quota resets.'
  }

  return message
}

export function formatReviewTime(dateString) {
  if (!dateString) return null
  const date = new Date(dateString)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

export function formatWeekRange(weekStartDate) {
  const monday = new Date(`${weekStartDate}T00:00:00`)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  const fmt = date => date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  return `${fmt(monday)} - ${fmt(sunday)}`
}
