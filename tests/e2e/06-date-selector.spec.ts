import { test, expect } from '@playwright/test'
import { testDb, todayStr, addDays } from './helpers'

test.describe('Date Selector', () => {
  const past3 = addDays(todayStr(), -3)
  const past5 = addDays(todayStr(), -5)
  const past7 = addDays(todayStr(), -7)

  test.afterEach(async () => {
    await testDb.from('habit_logs').delete().in('log_date', [todayStr(), past3, past5, past7])
  })

  test('today shows as "Today"', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('button', { name: 'Today', exact: true })).toBeVisible()
  })

  test('left arrow goes to the previous day', async ({ page }) => {
    await page.goto('/')
    await page.locator('button[title="Previous day"]').click()
    await expect(page.getByRole('button', { name: 'Today', exact: true })).toHaveCount(0)
    await expect(page.getByText('Viewing', { exact: false })).toBeVisible()
  })

  test('right arrow is disabled on today and clicking it is a no-op', async ({ page }) => {
    await page.goto('/')
    const next = page.locator('button[title="Next day"]')
    await expect(next).toBeDisabled()
    await expect(page.getByRole('button', { name: 'Today', exact: true })).toBeVisible()
  })

  test('past-date banner appears when off today and "Back to today" returns', async ({ page }) => {
    await page.goto('/')
    await page.locator('button[title="Previous day"]').click()
    await expect(page.getByText('changes will be saved for that date')).toBeVisible()

    await page.getByText('Back to today', { exact: false }).click()
    await expect(page.getByText('changes will be saved for that date')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Today', exact: true })).toBeVisible()
  })

  test('calendar opens on date-pill click, future dates are disabled', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Today', exact: true }).click()
    await expect(page.locator('button[title="Next month"]')).toBeDisabled()
    const disabledDays = page.locator('.dashboard-date-popover button[disabled]')
    expect(await disabledDays.count()).toBeGreaterThan(0)
  })

  test('selecting a past date via calendar loads that date\'s data (blank if none logged)', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Today', exact: true }).click()
    const today = new Date()
    const targetDay = today.getDate() > 3 ? today.getDate() - 3 : today.getDate()
    if (targetDay !== today.getDate()) {
      await page.locator('.dashboard-date-popover button', { hasText: new RegExp(`^${targetDay}$`) }).first().click()
      await expect(page.getByText('changes will be saved for that date')).toBeVisible()
      await expect(page.getByText('0 of 3 done')).toBeVisible() // clean past day
    }
  })

  test('logging on a past date writes that log_date to Supabase, and today stays unaffected', async ({ page }) => {
    await page.goto('/')
    await page.getByText('Anki', { exact: true }).click() // log today first
    await expect(page.getByText('1 of 3 done')).toBeVisible()

    await page.locator('button[title="Previous day"]').click()
    await page.locator('button[title="Previous day"]').click()
    await page.locator('button[title="Previous day"]').click()
    await expect(page.getByText('0 of 3 done')).toBeVisible()
    const saveResponse = page.waitForResponse((r) => r.url().includes('/rest/v1/habit_logs') && r.request().method() === 'POST')
    await page.getByText('Duolingo', { exact: true }).click()
    await expect(page.getByText('1 of 3 done')).toBeVisible()
    await saveResponse // optimistic UI updates before the network write lands; wait before reading the DB directly

    const { data } = await testDb.from('habit_logs').select('*').eq('habit_key', 'japanese').eq('log_date', past3).maybeSingle()
    expect(data).not.toBeNull()
    expect(data!.payload.subtasks.duolingo).toBe(true)

    await page.getByText('Back to today', { exact: false }).click()
    await expect(page.getByText('1 of 3 done')).toBeVisible()
    const checkbox = page.locator('label').filter({ hasText: 'Anki' }).locator('input[type=checkbox]')
    await expect(checkbox).toBeChecked()
  })

  test('streak display does not change when viewing a past date', async ({ page }) => {
    await page.goto('/')
    const streakBefore = await page.locator('text=day streak').locator('xpath=preceding-sibling::div[1]').textContent()
    await page.locator('button[title="Previous day"]').click()
    const streakAfter = await page.locator('text=day streak').locator('xpath=preceding-sibling::div[1]').textContent()
    expect(streakAfter).toBe(streakBefore)
  })

  test('adversarial: unknown ?date= query param is ignored, still shows Today', async ({ page }) => {
    await page.goto('/?date=2099-12-31')
    await expect(page.getByRole('button', { name: 'Today', exact: true })).toBeVisible()
  })

  test('adversarial: rapidly clicking left arrow 7x lands exactly 7 days back, no crash', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))

    // Seed before navigating — `selectedDate` is component state, not persisted across
    // a reload, so this must be verified in the same session that navigated there.
    await testDb.from('habit_logs').upsert(
      { habit_key: 'dsa', log_date: past7, done: true, is_rest_day: false, payload: { easy: 3, med: 0, hard: 0 } },
      { onConflict: 'habit_key,log_date' },
    )
    await page.goto('/')
    const prev = page.locator('button[title="Previous day"]')
    for (let i = 0; i < 7; i++) await prev.click()
    expect(errors).toEqual([])

    const expectedLabel = new Date(`${past7}T00:00:00`).toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric',
    })
    await expect(page.locator('.dashboard-date-selector button').nth(1)).toHaveText(expectedLabel)
    // independently confirm it's really that date's data being shown, not a miscount
    await expect(page.getByText('3E · 0M · 0H solved')).toBeVisible()
  })

  test('adversarial: logging gym on a past date that already has data overwrites, no duplicate row', async ({ page }) => {
    await testDb.from('habit_logs').upsert(
      { habit_key: 'gym', log_date: past5, done: true, is_rest_day: false, payload: { workout_type: 'Push' } },
      { onConflict: 'habit_key,log_date' },
    )
    await page.goto('/')
    for (let i = 0; i < 5; i++) await page.locator('button[title="Previous day"]').click()
    // wait for GymCard to finish syncing to the seeded Push session before interacting
    await expect(page.getByText('Done — Push')).toBeVisible()

    const saveResponse = page.waitForResponse((r) => r.url().includes('/rest/v1/habit_logs') && r.request().method() === 'POST')
    await page.getByRole('button', { name: /rest day/i }).click()
    await expect(page.getByText('Rest day — streak saved')).toBeVisible()
    await saveResponse // the UI update is optimistic; wait for the real write before reading the DB directly

    const { data, error } = await testDb.from('habit_logs').select('*').eq('habit_key', 'gym').eq('log_date', past5)
    expect(error).toBeNull()
    expect(data!.length).toBe(1)
    expect(data![0].is_rest_day).toBe(true)
  })
})
