import { test, expect } from '@playwright/test'
import { testDb, todayStr } from './helpers'

test.describe('Dashboard', () => {
  test.afterEach(async () => {
    await testDb.from('habit_logs').delete().eq('log_date', todayStr())
  })

  test('loads in dark mode by default', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('html')).toHaveClass(/dark/)
    await expect(page.getByText('Gym', { exact: true })).toBeVisible()
  })

  test('greeting reflects time of day (morning/afternoon/evening)', async ({ page }) => {
    await page.clock.install({ time: new Date(2030, 0, 1, 9, 0, 0) })
    await page.goto('/')
    await expect(page.getByRole('heading', { name: /Good morning, Shrey/ })).toBeVisible()

    await page.clock.setFixedTime(new Date(2030, 0, 1, 14, 0, 0))
    await page.reload()
    await expect(page.getByRole('heading', { name: /Good afternoon, Shrey/ })).toBeVisible()

    await page.clock.setFixedTime(new Date(2030, 0, 1, 19, 0, 0))
    await page.reload()
    await expect(page.getByRole('heading', { name: /Good evening, Shrey/ })).toBeVisible()

    await page.clock.setFixedTime(new Date(2030, 0, 1, 23, 30, 0))
    await page.reload()
    await expect(page.getByRole('heading', { name: /Good evening, Shrey/ })).toBeVisible()
  })

  test("date display shows today's date in full human-readable format", async ({ page }) => {
    await page.goto('/')
    const expected = new Date().toLocaleDateString('en-US', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    })
    await expect(page.getByText(expected, { exact: true })).toBeVisible()
  })

  test('streak pill is visible even before any habits are logged', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText('day streak')).toBeVisible()
    const streakNumber = await page.locator('text=day streak').locator('..').locator('span').first().textContent()
    expect(streakNumber).not.toBeNull()
  })

  test('AllDoneBanner is NOT visible on load with no habits logged', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText("All habits done", { exact: false })).toHaveCount(0)
  })

  test('AllDoneBanner appears when all 3 habits are marked done, disappears when one is un-done', async ({ page }) => {
    await page.goto('/')

    // Gym: rest day is the fastest legitimate "done" path
    await page.getByRole('button', { name: /rest day/i }).click()

    // Japanese: 2 of 3 subtasks
    await page.getByText('Anki', { exact: true }).click()
    await page.getByText('Duolingo', { exact: true }).click()

    // DSA: any count > 0
    const dsaCard = page.locator('div').filter({ hasText: /^DSA/ }).first()
    await dsaCard.getByRole('button', { name: '+' }).first().click()

    await expect(page.getByText("All habits done - you're locked in")).toBeVisible()

    // Un-done: uncheck one Japanese subtask, drops to 1 of 3
    await page.getByText('Anki', { exact: true }).click()
    await expect(page.getByText("All habits done - you're locked in")).toHaveCount(0)
  })

  test('dark/light mode toggle works and persists on reload', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('html')).toHaveClass(/dark/)

    const toggle = page.getByRole('button', { name: 'Toggle dark mode' })
    await toggle.click()
    await expect(page.locator('html')).not.toHaveClass(/dark/)
    expect(await page.evaluate(() => localStorage.getItem('theme'))).toBe('light')

    await page.reload()
    await expect(page.locator('html')).not.toHaveClass(/dark/)

    await toggle.click()
    expect(await page.evaluate(() => localStorage.getItem('theme'))).toBe('dark')
  })

  test('overall streak renders a valid non-negative number, not hidden or NaN', async ({ page }) => {
    await page.goto('/')
    const label = page.getByText('day streak')
    await expect(label).toBeVisible()
    const container = label.locator('xpath=preceding-sibling::div[1]')
    const text = (await container.textContent()) || ''
    const match = text.match(/-?\d+/)
    expect(match).not.toBeNull()
    expect(Number(match![0])).toBeGreaterThanOrEqual(0)
  })

  test('cursor spotlight glow element exists in the DOM in dark mode', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('html')).toHaveClass(/dark/)
    await expect(page.locator('div[style*="--cursor-x"]')).toBeAttached()
  })

  test('background atmosphere elements exist (floating icons + constellation canvas)', async ({ page }) => {
    await page.goto('/')
    const floatingIcons = page.locator('div.pointer-events-none.overflow-hidden i.ti')
    await expect(floatingIcons.first()).toBeAttached()
    expect(await floatingIcons.count()).toBeGreaterThanOrEqual(8)
    await expect(page.locator('canvas')).toBeAttached()
  })
})
