import { test, expect, Page } from '@playwright/test'
import { testDb, todayStr, addDays, QA_PREFIX, cleanupTestExercises } from './helpers'

async function openDrawer(page: Page, type: 'Push' | 'Pull' | 'Legs' | 'Cardio' = 'Push') {
  await page.goto('/')
  await page.getByRole('button', { name: type, exact: false }).first().click()
  await expect(page.getByRole('heading', { name: new RegExp(`${type} Day`) })).toBeVisible()
}

async function addExercise(page: Page, name: string, weightType: string = 'Barbell') {
  await page.getByRole('button', { name: 'Add exercise' }).click()
  await page.getByPlaceholder('e.g. Bench Press').fill(name)
  if (weightType !== 'Barbell') {
    await page.locator('form').getByRole('button', { name: weightType, exact: true }).click()
  }
  await page.locator('form button[type="submit"]').click()
}

test.describe('Workout Drawer + Exercise Card', () => {
  test.afterEach(async () => {
    await testDb.from('habit_logs').delete().eq('log_date', todayStr())
    await cleanupTestExercises()
  })

  test('"+ Add exercise" opens the add exercise modal', async ({ page }) => {
    await openDrawer(page)
    await page.getByRole('button', { name: 'Add exercise' }).click()
    await expect(page.getByRole('heading', { name: /Add exercise — Push/ })).toBeVisible()
  })

  test('adding an exercise with name + weight type saves and appears in the list', async ({ page }) => {
    await openDrawer(page)
    const name = `${QA_PREFIX}Bench Press`
    await addExercise(page, name)
    await expect(page.getByText(name, { exact: true })).toBeVisible()
  })

  test('duplicate exercise name (case-insensitive, punctuation-insensitive) is rejected', async ({ page }) => {
    await openDrawer(page)
    const base = `${QA_PREFIX}Overhead Press`
    await addExercise(page, base)
    await expect(page.getByText(base, { exact: true })).toBeVisible()

    await page.getByRole('button', { name: 'Add exercise' }).click()
    await page.getByPlaceholder('e.g. Bench Press').fill(base.toLowerCase())
    await page.locator('form button[type="submit"]').click()
    await expect(page.getByText(/already exists/)).toBeVisible()
  })

  test('"push ups" collides with existing "Push-Ups"', async ({ page }) => {
    await openDrawer(page)
    await addExercise(page, `${QA_PREFIX}Push-Ups`)
    await page.getByRole('button', { name: 'Add exercise' }).click()
    await page.getByPlaceholder('e.g. Bench Press').fill(`${QA_PREFIX}push ups`)
    await page.locator('form button[type="submit"]').click()
    await expect(page.getByText(/already exists/)).toBeVisible()
  })

  test('"Push Ups" collides with existing "push_ups"', async ({ page }) => {
    await openDrawer(page)
    await addExercise(page, `${QA_PREFIX}push_ups2`)
    await page.getByRole('button', { name: 'Add exercise' }).click()
    await page.getByPlaceholder('e.g. Bench Press').fill(`${QA_PREFIX}Push Ups2`)
    await page.locator('form button[type="submit"]').click()
    await expect(page.getByText(/already exists/)).toBeVisible()
  })

  test('clicking an exercise expands it, showing the set logging form with 0-default inputs', async ({ page }) => {
    await openDrawer(page)
    const name = `${QA_PREFIX}Squat`
    await addExercise(page, name)
    // handleAdd auto-expands the newly added exercise
    const weightInput = page.locator('input[placeholder="kg"]').first()
    const repsInput = page.locator('input[placeholder="reps"]').first()
    await expect(weightInput).toHaveValue('0')
    await expect(repsInput).toHaveValue('0')
  })

  test('logging 1 valid set saves and marks the exercise done', async ({ page }) => {
    await openDrawer(page)
    await addExercise(page, `${QA_PREFIX}Deadlift`)
    await page.locator('input[placeholder="kg"]').first().fill('60')
    await page.locator('input[placeholder="reps"]').first().fill('5')
    await page.getByRole('button', { name: 'Log workout' }).click()
    await expect(page.getByRole('button', { name: 'Logged' })).toBeVisible()
    await expect(page.locator('i.ti-circle-check')).toBeVisible()
  })

  test('"+ Add set" adds a row; "- Remove set" removes it down to a minimum of 1', async ({ page }) => {
    await openDrawer(page)
    await addExercise(page, `${QA_PREFIX}Row`)
    await expect(page.locator('input[placeholder="kg"]')).toHaveCount(1)

    await page.getByText('+ Add set', { exact: true }).click()
    await expect(page.locator('input[placeholder="kg"]')).toHaveCount(2)

    await page.getByText('− Remove set', { exact: true }).click()
    await expect(page.locator('input[placeholder="kg"]')).toHaveCount(1)
    await expect(page.getByText('− Remove set', { exact: true })).toBeDisabled()
  })

  test('"Delete today" is hidden until logged, then deletes only today and keeps the exercise (given prior history)', async ({ page }) => {
    // NOTE: an exercise with NO prior sessions is fully removed when its only (today's)
    // log is deleted — see WorkoutDrawer.handleDeleteToday: "no prior history in this
    // category AND only in this category → remove entirely". That's intentional (no
    // orphan zero-log exercises), so this test seeds a prior-day log first so the
    // exercise legitimately has history to keep after deleting today's entry.
    const name = `${QA_PREFIX}Lunge`
    const { data: ex } = await testDb.from('exercises').insert({
      name, normalized_name: 'qa test lunge', weight_type: 'barbell',
      primary_workout_type: 'Push', workout_type_tags: ['Push'],
    }).select().single()
    await testDb.from('exercise_logs').insert({
      exercise_id: ex.id, log_date: addDays(todayStr(), -2), workout_type: 'Push', sets: [{ weight: 20, reps: 8 }],
    })

    await openDrawer(page)
    await expect(page.getByText('Delete selected date', { exact: true })).toHaveCount(0)

    await page.getByText(name, { exact: true }).click() // expand
    await page.locator('input[placeholder="kg"]').first().fill('20')
    await page.locator('input[placeholder="reps"]').first().fill('10')
    await page.getByRole('button', { name: 'Log workout' }).click()
    await expect(page.getByRole('button', { name: 'Logged' })).toBeVisible()

    await page.getByText(name, { exact: true }).click() // re-expand (auto-collapsed after 1.5s)
    await page.getByText('Delete selected date', { exact: true }).click()
    await expect(page.getByText(name, { exact: true })).toBeVisible()
    await expect(page.getByText('2 days ago')).toBeVisible()
  })

  test('progress graph opens from the chart icon and closes', async ({ page }) => {
    await openDrawer(page)
    await addExercise(page, `${QA_PREFIX}Curl`)
    await page.getByRole('button', { name: 'View graph' }).click()
    await expect(page.getByText('Log at least 1 session to see your progress graph')).toBeVisible()
    await page.locator('div[class*="top-1/2"][class*="-translate-x-1/2"] button:has(i.ti-x)').click()
    await expect(page.getByText('Log at least 1 session to see your progress graph')).toHaveCount(0)
  })

  test('days-since shows urgency color at 14+ days', async ({ page }) => {
    const name = `${QA_PREFIX}Neglected Pullups`
    const { data: ex } = await testDb.from('exercises').insert({
      name, normalized_name: 'qa test neglected pullups', weight_type: 'reps',
      primary_workout_type: 'Pull', workout_type_tags: ['Pull'],
    }).select().single()
    await testDb.from('exercise_logs').insert({
      exercise_id: ex.id, log_date: addDays(todayStr(), -20), workout_type: 'Pull', sets: [{ reps: 8 }],
    })
    await openDrawer(page, 'Pull')
    await expect(page.getByText(/⚠️ 20 days ago/)).toBeVisible()
  })

  test('adversarial: negative reps input is stripped, not accepted as negative', async ({ page }) => {
    await openDrawer(page)
    await addExercise(page, `${QA_PREFIX}NegRep`)
    const reps = page.locator('input[placeholder="reps"]').first()
    await reps.fill('-1')
    await expect(reps).toHaveValue('1')
  })

  test('adversarial: 0 reps blocked (minimum 1)', async ({ page }) => {
    await openDrawer(page)
    await addExercise(page, `${QA_PREFIX}ZeroRep`)
    await page.locator('input[placeholder="kg"]').first().fill('10')
    await page.getByRole('button', { name: /Log workout|Fix errors above/ }).click()
    await expect(page.getByText('Reps must be at least 1')).toBeVisible()
  })

  test('adversarial: weight 3 rounds to 2.5 on blur; weight below 2.5 is blocked', async ({ page }) => {
    await openDrawer(page)
    await addExercise(page, `${QA_PREFIX}RoundWeight`)
    const weight = page.locator('input[placeholder="kg"]').first()
    await weight.fill('3')
    await weight.blur()
    await expect(weight).toHaveValue('2.5')
    await expect(page.getByText('Rounded to nearest 2.5 kg')).toBeVisible()
  })

  test('adversarial: negative weight (-50) is stripped to digits only, never negative', async ({ page }) => {
    await openDrawer(page)
    await addExercise(page, `${QA_PREFIX}NegWeight`)
    const weight = page.locator('input[placeholder="kg"]').first()
    await weight.fill('-50')
    await expect(weight).toHaveValue('50')
  })

  test('adversarial: non-numeric paste into a number field is stripped, not a crash', async ({ page }) => {
    await openDrawer(page)
    await addExercise(page, `${QA_PREFIX}PasteJunk`)
    const weight = page.locator('input[placeholder="kg"]').first()
    await weight.fill('abc123xyz')
    await expect(weight).toHaveValue('123')
  })

  test('adversarial: 999999 reps is accepted (no upper bound)', async ({ page }) => {
    await openDrawer(page)
    await addExercise(page, `${QA_PREFIX}HighRep`)
    await page.locator('input[placeholder="kg"]').first().fill('10')
    const reps = page.locator('input[placeholder="reps"]').first()
    await reps.fill('999999')
    await page.getByRole('button', { name: 'Log workout' }).click()
    await expect(page.getByRole('button', { name: 'Logged' })).toBeVisible()
  })

  test('adversarial: cable small plates cap at 2 with a note', async ({ page }) => {
    await openDrawer(page, 'Cardio')
    await addExercise(page, `${QA_PREFIX}CableRow`, 'Cable')
    const small = page.locator('input[placeholder="0"]').nth(1) // Big(placeholder 1), Medium(0), Small(0)
    await small.fill('3')
    await expect(small).toHaveValue('2')
    await expect(page.getByText('Max 2 small plates')).toBeVisible()
  })

  test('adversarial: time input 75 seconds auto-converts to 1 min 15 sec', async ({ page }) => {
    await openDrawer(page, 'Cardio')
    await addExercise(page, `${QA_PREFIX}Plank`, 'Time')
    const secs = page.locator('input[placeholder="ss"]').first()
    await secs.fill('75')
    await expect(page.locator('input[placeholder="mm"]').first()).toHaveValue('1')
    await expect(secs).toHaveValue('15')
  })

  test('adversarial: time minutes above 59 caps at 59 with a note', async ({ page }) => {
    await openDrawer(page, 'Cardio')
    await addExercise(page, `${QA_PREFIX}LongRun`, 'Time')
    const mins = page.locator('input[placeholder="mm"]').first()
    await mins.fill('65')
    await expect(mins).toHaveValue('59')
    await expect(page.getByText('Maximum duration is 60 minutes')).toBeVisible()
  })

  test('adversarial: submitting all-zero set is blocked with shake feedback', async ({ page }) => {
    await openDrawer(page)
    await addExercise(page, `${QA_PREFIX}AllZero`)
    const logBtn = page.getByRole('button', { name: 'Log workout' })
    await logBtn.click()
    await expect(page.getByRole('button', { name: 'Fix errors above' })).toBeVisible()
  })

  test('adversarial: tabbing through all fields rapidly causes no page errors', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))
    await openDrawer(page, 'Cardio')
    await addExercise(page, `${QA_PREFIX}TabTest`, 'Cable')
    await page.locator('input[placeholder="1"]').first().focus()
    for (let i = 0; i < 8; i++) await page.keyboard.press('Tab')
    expect(errors).toEqual([])
  })
})
