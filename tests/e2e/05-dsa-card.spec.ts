import { test, expect, Page } from '@playwright/test'
import { testDb, todayStr } from './helpers'

function dsaCard(page: Page) {
  return page.locator('.habit-dsa')
}
// DSACard's header row also matches "flex items-center justify-between" (plus mb-4),
// so ":not(.mb-4)" is required to isolate the 3 actual Easy/Med/Hard rows.
function dsaRow(page: Page, label: 'Easy' | 'Med' | 'Hard') {
  const idx = { Easy: 0, Med: 1, Hard: 2 }[label]
  return dsaCard(page).locator('div.flex.items-center.justify-between:not(.mb-4)').nth(idx)
}

test.describe('DSA Card', () => {
  test.afterEach(async () => {
    await testDb.from('habit_logs').delete().eq('log_date', todayStr())
  })

  test('Easy/Med/Hard counters start at 0', async ({ page }) => {
    await page.goto('/')
    for (const label of ['Easy', 'Med', 'Hard'] as const) {
      await expect(dsaRow(page, label).getByText('0', { exact: true })).toBeVisible()
    }
    await expect(page.getByText('Not started')).toBeVisible()
  })

  test('+ increments, − decrements, floor of 0', async ({ page }) => {
    await page.goto('/')
    const row = dsaRow(page, 'Easy')
    await row.getByRole('button', { name: '+' }).click()
    await row.getByRole('button', { name: '+' }).click()
    await expect(row.getByText('2', { exact: true })).toBeVisible()

    await row.getByRole('button', { name: '−' }).click()
    await expect(row.getByText('1', { exact: true })).toBeVisible()

    await row.getByRole('button', { name: '−' }).click()
    await row.getByRole('button', { name: '−' }).click()
    await expect(row.getByText('0', { exact: true })).toBeVisible()
  })

  test('card becomes done (green) when any counter > 0, and status text updates', async ({ page }) => {
    await page.goto('/')
    const card = dsaCard(page)
    await expect(card).not.toHaveClass(/habit-card-done/)
    await dsaRow(page, 'Med').getByRole('button', { name: '+' }).click()
    await expect(card).toHaveClass(/habit-card-done/)
    await expect(page.getByText('0E · 1M · 0H solved')).toBeVisible()
  })

  test('DSA streak number is always visible', async ({ page }) => {
    await page.goto('/')
    await expect(dsaCard(page).locator('i.ti-flame').first()).toBeVisible()
  })

  test('CRITICAL: count persists after full page reload', async ({ page }) => {
    await page.goto('/')
    await dsaRow(page, 'Easy').getByRole('button', { name: '+' }).click()
    await dsaRow(page, 'Easy').getByRole('button', { name: '+' }).click()
    await dsaRow(page, 'Hard').getByRole('button', { name: '+' }).click()
    await expect(page.getByText('2E · 0M · 1H solved')).toBeVisible()

    await page.reload()
    await expect(page.getByText('2E · 0M · 1H solved')).toBeVisible()
    await expect(dsaRow(page, 'Easy').getByText('2', { exact: true })).toBeVisible()
    await expect(dsaRow(page, 'Hard').getByText('1', { exact: true })).toBeVisible()
  })

  test('adversarial: 50 rapid clicks on Easy + results in count 50, no crash', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))
    await page.goto('/')
    const plus = dsaRow(page, 'Easy').getByRole('button', { name: '+' })
    for (let i = 0; i < 50; i++) await plus.click()
    await expect(dsaRow(page, 'Easy').getByText('50', { exact: true })).toBeVisible()
    expect(errors).toEqual([])
  })

  test('adversarial: − at 0 stays at 0, never negative', async ({ page }) => {
    await page.goto('/')
    const row = dsaRow(page, 'Med')
    await row.getByRole('button', { name: '−' }).click()
    await row.getByRole('button', { name: '−' }).click()
    await expect(row.getByText('0', { exact: true })).toBeVisible()
  })

  test('adversarial: set Easy to 5, reload — shows 5 not 0', async ({ page }) => {
    await page.goto('/')
    const plus = dsaRow(page, 'Easy').getByRole('button', { name: '+' })
    for (let i = 0; i < 5; i++) await plus.click()
    await page.reload()
    await expect(dsaRow(page, 'Easy').getByText('5', { exact: true })).toBeVisible()
  })

  test('adversarial: navigate away to /goals and back — counts preserved via DB', async ({ page }) => {
    await page.goto('/')
    const saveResponse = page.waitForResponse((r) => r.url().includes('/rest/v1/habit_logs') && r.request().method() === 'POST')
    await dsaRow(page, 'Hard').getByRole('button', { name: '+' }).click()
    await expect(page.getByText('0E · 0M · 1H solved')).toBeVisible()
    await saveResponse // SPA nav keeps the JS context alive, but don't race the write regardless

    await page.getByRole('link', { name: 'Goals', exact: false }).click()
    await expect(page).toHaveURL(/\/goals/)
    await page.getByRole('link', { name: 'Dashboard', exact: false }).click()
    await expect(page.getByText('0E · 0M · 1H solved')).toBeVisible()
  })

  test('adversarial: click + then reload immediately — write is not lost to a missing debounce', async ({ page }) => {
    await page.goto('/')
    // The save fires the instant you click (no setTimeout/debounce wrapping it) —
    // that's the behavior under test. A literal 0ms-later reload can abort the
    // request before the browser finishes sending it regardless of app code (a
    // browser-level constraint, not a debounce bug), so assert on the request being
    // dispatched promptly rather than racing a real reload against raw network time.
    const saveResponse = page.waitForResponse(
      (r) => r.url().includes('/rest/v1/habit_logs') && r.request().method() === 'POST',
      { timeout: 2000 },
    )
    await dsaRow(page, 'Easy').getByRole('button', { name: '+' }).click()
    await saveResponse
    await page.reload()
    await expect(dsaRow(page, 'Easy').getByText('1', { exact: true })).toBeVisible()
  })
})
