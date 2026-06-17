import { test, expect } from '@playwright/test'

test.describe('topbar', () => {
  test('top-01 time-appropriate greeting is shown', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText(/Good (morning|afternoon|evening)/i)).toBeVisible()
  })

  test('top-02 today date is shown in readable format', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText(/\w+day,\s+\w+\s+\d{1,2},\s+\d{4}/)).toBeVisible()
  })

  test('top-03 overall streak number is visible', async ({ page }) => {
    await page.goto('/')
    const streakRegion = page.locator('text=/^\\d+$/').first()
    await expect(streakRegion).toBeVisible()
  })

  test('top-04 flame icon present next to streak number', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('i.ti-flame').first()).toBeVisible()
  })
})
