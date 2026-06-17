import { test, expect } from '@playwright/test'

test.describe('japanese card', () => {
  test('jp-01 card renders with Japanese title', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText('Japanese', { exact: true })).toBeVisible()
  })

  test('jp-02 3 subtask rows: Anki, Duolingo, Study session', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText('Anki', { exact: false })).toBeVisible()
    await expect(page.getByText('Duolingo', { exact: false })).toBeVisible()
    await expect(page.getByText(/study session/i)).toBeVisible()
  })

  test('jp-04 progress footer shows X of 3 done', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText(/\d of 3 done/i)).toBeVisible()
  })
})
