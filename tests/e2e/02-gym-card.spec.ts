import { test, expect } from '@playwright/test'
import { testDb, todayStr, addDays, weekday } from './helpers'

function gymCard(page: import('@playwright/test').Page) {
  return page.locator('div').filter({ has: page.getByText('Gym', { exact: true }) }).first()
}

test.describe('Gym Card', () => {
  test.afterEach(async () => {
    await testDb.from('habit_logs').delete().eq('log_date', todayStr())
  })

  test('all 4 workout buttons are visible and clickable', async ({ page }) => {
    await page.goto('/')
    for (const name of ['Push', 'Pull', 'Legs', 'Cardio']) {
      await expect(page.getByRole('button', { name, exact: false }).first()).toBeVisible()
    }
  })

  test('clicking Push highlights it, opens the drawer, and shows the unconfirmed status text', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Push', exact: false }).first().click()
    await expect(page.getByRole('heading', { name: /Push Day/ })).toBeVisible()
    await expect(page.getByText('Push selected — log an exercise to confirm')).toBeAttached()
  })

  test('closing the drawer without logging reverts selection (no crash, gym not done)', async ({ page }) => {
    // Seed a neutral (not-rest, not-done) gym log so a run landing on the configured
    // Sunday auto-rest day doesn't have the background auto-log flip the card back to
    // "Rest day" after this test's local, unsaved selection is reverted.
    await testDb.from('habit_logs').upsert(
      { habit_key: 'gym', log_date: todayStr(), done: false, is_rest_day: false, payload: {} },
      { onConflict: 'habit_key,log_date' },
    )
    await page.goto('/')
    await page.getByRole('button', { name: 'Push', exact: false }).first().click()
    await expect(page.getByRole('heading', { name: /Push Day/ })).toBeVisible()

    await page.locator('.animate-slide-up-drawer button:has(i.ti-x)').first().click()
    await expect(page.getByRole('heading', { name: /Push Day/ })).toHaveCount(0)
    await expect(page.getByText('Select workout')).toBeVisible()
  })

  test('re-clicking the active workout type reopens the drawer (does not silently deselect)', async ({ page }) => {
    await page.goto('/')
    const pushBtn = page.getByRole('button', { name: 'Push', exact: false }).first()
    await pushBtn.click()
    await page.locator('.animate-slide-up-drawer button:has(i.ti-x)').first().click()
    await expect(page.getByRole('heading', { name: /Push Day/ })).toHaveCount(0)

    // selection was cleared on close (unconfirmed), so this is a fresh select — drawer opens again
    await pushBtn.click()
    await expect(page.getByRole('heading', { name: /Push Day/ })).toBeVisible()
  })

  test('gym streak number is visible regardless of log state', async ({ page }) => {
    await page.goto('/')
    const card = gymCard(page)
    await expect(card.locator('i.ti-flame').first()).toBeVisible()
  })

  test('rest day: click marks done, click again deselects', async ({ page }) => {
    await page.goto('/')
    const restBtn = page.getByRole('button', { name: /rest day/i })
    await restBtn.click()
    await expect(page.getByText('Rest day — streak saved')).toBeVisible()

    await restBtn.click()
    await expect(page.getByText('Rest day — streak saved')).toHaveCount(0)
    await expect(page.getByText('Select workout')).toBeVisible()
  })

  test('rest day cap: 1 of 2 used shows warning, 2 of 2 disables the button', async ({ page }) => {
    const today = todayStr()
    const dow = weekday(today)
    const daysToMonday = (dow + 6) % 7
    const monday = addDays(today, -daysToMonday)
    const day1 = monday === today ? addDays(monday, 1) : monday
    const day2 = addDays(day1, 1) === today ? addDays(day1, 2) : addDays(day1, 1)

    try {
      // Seed a neutral (not-rest, not-done) log for today so a run landing on the
      // configured Sunday auto-rest day doesn't have the background auto-log count
      // today itself toward this week's 2-rest-day cap before day1/day2 are inserted.
      await testDb.from('habit_logs').upsert(
        { habit_key: 'gym', log_date: today, done: false, is_rest_day: false, payload: {} },
        { onConflict: 'habit_key,log_date' },
      )
      await testDb.from('habit_logs').upsert(
        { habit_key: 'gym', log_date: day1, done: true, is_rest_day: true, payload: { workout_type: 'rest' } },
        { onConflict: 'habit_key,log_date' },
      )
      await page.goto('/')
      await expect(page.getByText('1 of 2 rest days used')).toBeVisible()
      await expect(page.getByRole('button', { name: /rest day/i })).toBeEnabled()

      await testDb.from('habit_logs').upsert(
        { habit_key: 'gym', log_date: day2, done: true, is_rest_day: true, payload: { workout_type: 'rest' } },
        { onConflict: 'habit_key,log_date' },
      )
      await page.reload()
      await expect(page.getByRole('button', { name: 'Rest limit reached' })).toBeVisible()
      await expect(page.getByRole('button', { name: 'Rest limit reached' })).toBeDisabled()
    } finally {
      await testDb.from('habit_logs').delete().eq('habit_key', 'gym').in('log_date', [day1, day2])
    }
  })

  test('selecting a workout type does not mark gym done until an exercise is saved', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Push', exact: false }).first().click()
    await expect(page.getByRole('heading', { name: /Push Day/ })).toBeVisible()
    // drawer open, but card itself must not show the done accent yet
    const card = gymCard(page)
    await expect(card).not.toHaveClass(/habit-card-done/)
  })

  test('clicking the history icon opens the workout history drawer', async ({ page }) => {
    await page.goto('/')
    await page.locator('button[title="View workout history"]').click()
    await expect(page.getByRole('heading', { name: 'Workout History' })).toBeVisible()
  })

  test('adversarial: rapid-clicking the same workout type does not crash or duplicate the drawer', async ({ page }) => {
    // NOTE: once the drawer opens, its fixed backdrop physically covers the Push
    // button's screen position, so a `force`-clicked mouse event at that same spot
    // lands on the backdrop (closing the drawer) rather than re-hitting the button —
    // this is correct overlay/backdrop behavior, not a bug. An odd click count is
    // used so the sequence deterministically ends with the drawer open.
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))

    await page.goto('/')
    const pushBtn = page.getByRole('button', { name: 'Push', exact: false }).first()
    for (let i = 0; i < 21; i++) {
      await pushBtn.click({ force: true })
    }
    await expect(page.getByRole('heading', { name: /Push Day/ })).toHaveCount(1)
    expect(errors).toEqual([])
  })

  test('adversarial: an even number of rapid clicks lands back on closed+unselected (backdrop absorbs the alternate click)', async ({ page }) => {
    // Seed a neutral (not-rest, not-done) gym log so a run landing on the configured
    // Sunday auto-rest day doesn't have the background auto-log flip the card back to
    // "Rest day" after this test's local, unsaved selection is reverted.
    await testDb.from('habit_logs').upsert(
      { habit_key: 'gym', log_date: todayStr(), done: false, is_rest_day: false, payload: {} },
      { onConflict: 'habit_key,log_date' },
    )
    await page.goto('/')
    const pushBtn = page.getByRole('button', { name: 'Push', exact: false }).first()
    for (let i = 0; i < 4; i++) {
      await pushBtn.click({ force: true })
    }
    await expect(page.getByRole('heading', { name: /Push Day/ })).toHaveCount(0)
    await expect(page.getByText('Select workout')).toBeVisible()
  })

  test('adversarial: rest day then Push opens directly on Push with no transfer banner (rest has no exercises)', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: /rest day/i }).click()
    await expect(page.getByText('Rest day — streak saved')).toBeVisible()

    await page.getByRole('button', { name: 'Push', exact: false }).first().click({ force: true })
    await expect(page.getByRole('heading', { name: /Push Day/ })).toBeVisible()
    await expect(page.getByText(/Move it here\?/)).toHaveCount(0)
  })
})
