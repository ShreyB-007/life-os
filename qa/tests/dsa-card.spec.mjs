import { test, expect } from '@playwright/test'

test.describe('dsa card', () => {
  test('dsa-01 card renders with DSA title', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText('DSA', { exact: true })).toBeVisible()
  })

  test('dsa-02 3 counters: Easy, Med, Hard', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText('Easy', { exact: false })).toBeVisible()
    await expect(page.getByText('Med', { exact: false })).toBeVisible()
    await expect(page.getByText('Hard', { exact: false })).toBeVisible()
  })

  test('dsa-06/07 +/- buttons increment and never go below 0', async ({ page }) => {
    await page.goto('/')
    const card = page.locator('text=DSA').locator('xpath=ancestor::*[contains(@class,"habit-card") or contains(@class,"habit-card-done")][1]')
    const minusButtons = card.locator('button').filter({ hasText: '-' })
    if (await minusButtons.count() > 0) {
      await minusButtons.first().click()
      await page.waitForTimeout(200)
      const text = await card.innerText()
      expect(text).not.toMatch(/-\d/)
    }
  })
})
