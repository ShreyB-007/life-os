import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.107.0'
import { GoogleGenerativeAI } from 'npm:@google/generative-ai'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const GEMINI_MODEL = 'gemini-2.5-flash'
const LOOKBACK_DAYS = 120
const SUBTASK_KEYS = ['anki', 'duolingo', 'study']

serve(async req => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { weekStartDate, today } = await req.json()
    if (!weekStartDate) throw new Error('weekStartDate is required')
    if (!today) throw new Error('today is required')

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const sundayStr = addDays(weekStartDate, 6)
    const lookbackStart = addDays(weekStartDate, -LOOKBACK_DAYS)

    const [logsRes, goalsRes, prevReviewRes] = await Promise.all([
      supabase
        .from('habit_logs')
        .select('*')
        .in('habit_key', ['gym', 'japanese', 'dsa'])
        .gte('log_date', lookbackStart)
        .order('log_date', { ascending: false }),
      supabase.from('goals').select('*').order('sort_order', { ascending: true }),
      supabase
        .from('weekly_reviews')
        .select('content')
        .eq('week_start_date', addDays(weekStartDate, -7))
        .maybeSingle(),
    ])

    if (logsRes.error) throw logsRes.error
    if (goalsRes.error) throw goalsRes.error

    const allLogs = logsRes.data ?? []
    const gymLogs = allLogs.filter(l => l.habit_key === 'gym')
    const japaneseLogs = allLogs.filter(l => l.habit_key === 'japanese')
    const dsaLogs = allLogs.filter(l => l.habit_key === 'dsa')
    const goals = goalsRes.data ?? []
    const previousSnapshot = prevReviewRes.data?.content?.goal_snapshot ?? []

    const weekDates = datesInRange(weekStartDate, sundayStr).filter(d => d <= today)
    const stats = buildStats(weekDates, gymLogs, japaneseLogs, dsaLogs, today)
    const goalDiffs = buildGoalDiffs(goals, previousSnapshot)
    const goalSnapshot = goals.map(g => ({ id: g.id, name: g.name, progress_pct: g.progress_pct ?? 0 }))

    const narrative = await generateNarrative({ weekStartDate, stats, goalDiffs })
    const content = { ...narrative, stats, goals: goalDiffs, goal_snapshot: goalSnapshot }

    const { data, error } = await supabase
      .from('weekly_reviews')
      .upsert({ week_start_date: weekStartDate, content }, { onConflict: 'week_start_date' })
      .select()
      .single()

    if (error) throw error
    return jsonResponse({ review: data })
  } catch (error) {
    return jsonResponse({ error: error.message ?? 'Weekly review generation failed' }, 500)
  }
})

function buildStats(weekDates, gymLogs, japaneseLogs, dsaLogs, today) {
  const gymMap = mapByDate(gymLogs)
  const japMap = mapByDate(japaneseLogs)
  const dsaMap = mapByDate(dsaLogs)

  let workouts = 0, restDays = 0, missed = 0
  const byType = {}
  const subtaskCounts = { anki: 0, duolingo: 0, study: 0 }
  let dsaEasy = 0, dsaMed = 0, dsaHard = 0, dsaDaysLogged = 0
  let allDoneDays = 0

  for (const date of weekDates) {
    const gymLog = gymMap[date]
    const japLog = japMap[date]
    const dsaLog = dsaMap[date]
    const dayOfWeek = new Date(`${date}T00:00:00`).getDay()

    if (gymLog?.is_rest_day) {
      restDays++
    } else if (gymLog?.done && gymLog.payload?.workout_type && gymLog.payload.workout_type !== 'rest') {
      workouts++
      byType[gymLog.payload.workout_type] = (byType[gymLog.payload.workout_type] ?? 0) + 1
    } else if (dayOfWeek !== 0) {
      missed++
    }

    const subtasks = japLog?.payload?.subtasks ?? {}
    for (const key of SUBTASK_KEYS) {
      if (subtasks[key] === true) subtaskCounts[key]++
    }

    if (dsaLog) {
      dsaEasy += Number(dsaLog.payload?.easy ?? 0)
      dsaMed += Number(dsaLog.payload?.med ?? 0)
      dsaHard += Number(dsaLog.payload?.hard ?? 0)
      if (dsaLog.done) dsaDaysLogged++
    }

    const gymOk = gymLog?.done === true || gymLog?.is_rest_day === true || dayOfWeek === 0
    const japOk = japLog?.done === true
    const dsaOk = dsaLog?.done === true
    if (gymOk && japOk && dsaOk) allDoneDays++
  }

  const daysElapsed = weekDates.length
  const totalSubtaskSlots = daysElapsed * SUBTASK_KEYS.length
  const totalSubtaskDone = SUBTASK_KEYS.reduce((sum, key) => sum + subtaskCounts[key], 0)

  return {
    week_start_date: weekDates[0] ?? null,
    days_elapsed: daysElapsed,
    gym: { workouts, rest_days: restDays, missed, by_type: byType },
    japanese: {
      completion_rate: totalSubtaskSlots > 0 ? Number((totalSubtaskDone / totalSubtaskSlots).toFixed(2)) : 0,
      subtask_streaks: {
        anki: computeSubtaskStreak(japaneseLogs, 'anki', today),
        duolingo: computeSubtaskStreak(japaneseLogs, 'duolingo', today),
        study: computeSubtaskStreak(japaneseLogs, 'study', today),
      },
    },
    dsa: { easy: dsaEasy, med: dsaMed, hard: dsaHard, days_logged: dsaDaysLogged },
    overall_streak: computeOverallStreak(gymLogs, japaneseLogs, dsaLogs, today),
    all_done_days: allDoneDays,
  }
}

function buildGoalDiffs(goals, previousSnapshot) {
  const prevMap = {}
  for (const entry of previousSnapshot) prevMap[entry.id] = entry

  return goals.map(goal => {
    const prev = prevMap[goal.id]
    const progress = goal.progress_pct ?? 0
    const delta = prev ? progress - (prev.progress_pct ?? 0) : null
    const status =
      delta === null ? 'new' : delta > 0 ? 'moved_forward' : delta < 0 ? 'regressed' : 'stalled'

    return {
      id: goal.id,
      name: goal.name,
      progress_pct: progress,
      target_date: goal.target_date,
      goal_status: goal.status,
      delta,
      status,
    }
  })
}

async function generateNarrative({ weekStartDate, stats, goalDiffs }) {
  const apiKey = Deno.env.get('GEMINI_API_KEY')
  if (!apiKey) throw new Error('GEMINI_API_KEY is not configured')

  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({ model: GEMINI_MODEL })

  let result
  try {
    result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: buildPrompt(weekStartDate, stats, goalDiffs) }] }],
    })
  } catch (error) {
    if (isQuotaError(error.message)) {
      throw new Error('Gemini quota exceeded. Try again after the quota resets.')
    }
    throw new Error(error.message ?? 'Gemini request failed')
  }

  const text = result.response.text()
  return extractJsonObject(text)
}

function buildPrompt(weekStartDate, stats, goalDiffs) {
  return `You are reviewing one person's habit-tracking and goal data for the week starting ${weekStartDate}. This is their own private data, already computed for you below — do not invent numbers.

Habit stats for the week so far (${stats.days_elapsed} day(s) elapsed):
${JSON.stringify(stats, null, 2)}

Goal progress this week (delta is change vs last week's snapshot; null delta means no prior snapshot exists yet):
${JSON.stringify(goalDiffs, null, 2)}

Write a direct, honest weekly review. Not generic cheerleading. Be specific and reference actual numbers above.

Return ONLY a strict JSON object (no markdown fences, no prose outside the object) matching this schema:
{"summary": "2-4 sentence honest summary of the week", "wins": ["specific thing that went well", "..."], "slips": ["specific thing that slipped, named plainly", "..."], "next_week_priorities": ["concrete actionable priority, e.g. 'log DSA at least 4 of 7 days', not vague advice", "..."]}

wins and slips should each have 2-3 items (fewer is fine if the week's data genuinely doesn't support more). next_week_priorities should have 2-3 items.`
}

function extractJsonObject(text) {
  const clean = text.replace(/```json|```/g, '').trim()
  const start = clean.indexOf('{')
  const end = clean.lastIndexOf('}')
  if (start === -1 || end === -1) throw new Error('No JSON object found in Gemini response')
  return JSON.parse(clean.slice(start, end + 1))
}

function computeSubtaskStreak(logs, subtaskKey, today) {
  const logMap = mapByDate(logs)
  let streak = 0
  let cursor = today

  while (true) {
    const log = logMap[cursor]
    const done = log?.payload?.subtasks?.[subtaskKey] === true

    if (cursor === today && !done) {
      cursor = prevDayStr(cursor)
      continue
    }
    if (done) {
      streak++
      cursor = prevDayStr(cursor)
      continue
    }
    break
  }

  return streak
}

function computeOverallStreak(gymLogs, japaneseLogs, dsaLogs, today) {
  const gymMap = mapByDate(gymLogs)
  const japMap = mapByDate(japaneseLogs)
  const dsaMap = mapByDate(dsaLogs)
  let streak = 0
  let cursor = today

  while (true) {
    const dayOfWeek = new Date(`${cursor}T00:00:00`).getDay()
    const gymOk = gymMap[cursor]?.done === true || gymMap[cursor]?.is_rest_day === true || dayOfWeek === 0
    const japOk = japMap[cursor]?.done === true
    const dsaOk = dsaMap[cursor]?.done === true
    const allOk = gymOk && japOk && dsaOk

    if (cursor === today && !allOk) {
      cursor = prevDayStr(cursor)
      continue
    }
    if (allOk) {
      streak++
      cursor = prevDayStr(cursor)
      continue
    }
    break
  }

  return streak
}

function mapByDate(logs) {
  const map = {}
  for (const log of logs) map[log.log_date] = log
  return map
}

function datesInRange(startStr, endStr) {
  const dates = []
  let cursor = startStr
  while (cursor <= endStr) {
    dates.push(cursor)
    cursor = addDays(cursor, 1)
  }
  return dates
}

function addDays(dateStr, days) {
  const d = new Date(`${dateStr}T00:00:00`)
  d.setDate(d.getDate() + days)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function prevDayStr(dateStr) {
  return addDays(dateStr, -1)
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
