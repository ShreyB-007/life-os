/**
 * QA test seed — inserts artificial exercise data to verify gym tracker UI scenarios.
 *
 * Usage (browser console):
 *   import('./testSeed.js').then(m => m.seedTestData().then(cleanup => window._testCleanup = cleanup))
 *
 * Clean up after testing:
 *   window._testCleanup()
 *
 * EXPECTED RESULTS after seeding:
 *   S1 (Bench Press — Push):  🔥 8 badge visible, "Consistent 🔥 8" shown in history
 *   S2 (Seated Row — Pull):   no streak badge, card shows orange "7 days ago" label
 *   S3 (Leg Press — Legs):    first log today → 🏆 PR! badge on save
 *   S4 (Incline DB — Push):   today's log at 70kg exceeds prior max 60kg → PR! badge on save
 *   S5 (Overhead Press — Push): 14+ days since last → red pulsing left border in history
 *   S6 (Rest day toggle):     tap Rest day → active; tap again → deselected (no popup)
 *   S7 (Timezone):            verify via browser timezone deviation — logs show today's date
 */

import { supabase } from './supabase'
import { getLocalDate, getLocalDateString } from './dateUtils'

function daysAgoLocal(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return getLocalDateString(d)
}

async function getOrCreate(name, weightType, workoutType) {
  const normalized = name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
  const { data: existing } = await supabase
    .from('exercises')
    .select('id')
    .eq('normalized_name', normalized)
    .maybeSingle()
  if (existing) return { id: existing.id, created: false }

  const { data, error } = await supabase
    .from('exercises')
    .insert({
      name,
      normalized_name: normalized,
      weight_type: weightType,
      primary_workout_type: workoutType,
      workout_type_tags: [workoutType],
    })
    .select('id')
    .single()
  if (error) { console.error('create exercise failed', name, error); return null }
  return { id: data.id, created: true }
}

async function insertLog(exerciseId, logDate, sets, logIds) {
  const { data, error } = await supabase
    .from('exercise_logs')
    .upsert({ exercise_id: exerciseId, log_date: logDate, sets, logged_at: new Date().toISOString() },
             { onConflict: 'exercise_id,log_date' })
    .select('id')
    .single()
  if (!error && data) logIds.push(data.id)
  return data
}

export async function seedTestData() {
  const createdExerciseIds = []
  const logIds = []
  const today = getLocalDate()

  console.log('[testSeed] Seeding QA data…')

  // S1: Bench Press — 8 sessions in last 30 days → streak badge + "Consistent 🔥"
  const bench = await getOrCreate('Test Bench Press', 'barbell', 'Push')
  if (bench) {
    if (bench.created) createdExerciseIds.push(bench.id)
    for (const daysAgo of [0, 2, 4, 5, 8, 12, 19, 25]) {
      await insertLog(bench.id, daysAgoLocal(daysAgo), [{ weight: 80, reps: 8 }], logIds)
    }
  }

  // S2: Seated Row — 1 session 7 days ago → orange "7 days ago" label, no streak badge
  const row = await getOrCreate('Test Seated Row', 'barbell', 'Pull')
  if (row) {
    if (row.created) createdExerciseIds.push(row.id)
    await insertLog(row.id, daysAgoLocal(7), [{ weight: 60, reps: 10 }], logIds)
  }

  // S3: Leg Press — no prior logs → first log today should trigger PR! badge
  const legPress = await getOrCreate('Test Leg Press', 'barbell', 'Legs')
  if (legPress) {
    if (legPress.created) createdExerciseIds.push(legPress.id)
    // No prior logs seeded — open exercise and log it to verify PR badge fires
  }

  // S4: Incline DB — prior logs at 60kg, today at 70kg → PR on save
  const incline = await getOrCreate('Test Incline DB', 'dumbbell', 'Push')
  if (incline) {
    if (incline.created) createdExerciseIds.push(incline.id)
    for (const daysAgo of [7, 14]) {
      await insertLog(incline.id, daysAgoLocal(daysAgo), [{ weight: 60, reps: 8 }], logIds)
    }
    // Today: log at 70kg via UI to verify PR!
  }

  // S5: Overhead Press — last session 16 days ago → red pulsing border in history
  const ohp = await getOrCreate('Test OHP', 'barbell', 'Push')
  if (ohp) {
    if (ohp.created) createdExerciseIds.push(ohp.id)
    await insertLog(ohp.id, daysAgoLocal(16), [{ weight: 50, reps: 6 }], logIds)
    await insertLog(ohp.id, daysAgoLocal(23), [{ weight: 47.5, reps: 8 }], logIds)
  }

  console.log(`[testSeed] Done. Created ${createdExerciseIds.length} exercises, ${logIds.length} logs.`)
  console.log('[testSeed] Now test scenarios S1–S5 in the UI, then call window._testCleanup()')
  console.log('[testSeed] S6: manually tap Rest day twice to verify deselect without popup')
  console.log('[testSeed] S7: change system clock to 12:30 AM, log a session, verify date is local')

  return async function cleanup() {
    console.log('[testSeed] Cleaning up…')
    if (logIds.length) {
      await supabase.from('exercise_logs').delete().in('id', logIds)
    }
    for (const id of createdExerciseIds) {
      await supabase.from('exercise_logs').delete().eq('exercise_id', id)
      await supabase.from('exercises').delete().eq('id', id)
    }
    console.log('[testSeed] Cleanup complete.')
  }
}
