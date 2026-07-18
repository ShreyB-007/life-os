import { test, expect } from '@playwright/test'
import { testDb, todayStr } from './helpers'

function japaneseCard(page: import('@playwright/test').Page) {
  return page.locator('.habit-japanese')
}

test.describe('Japanese Card', () => {
  test.afterEach(async () => {
    await testDb.from('habit_logs').delete().eq('log_date', todayStr())
  })

  test('streak is visible before any logging', async ({ page }) => {
    await page.goto('/')
    await expect(japaneseCard(page).locator('i.ti-flame').first()).toBeVisible()
  })

  test('each of the 3 subtasks has its own mini streak counter', async ({ page }) => {
    await page.goto('/')
    for (const label of ['Anki', 'Duolingo', 'Study session']) {
      const row = page.locator('label').filter({ hasText: label })
      await expect(row).toBeVisible()
    }
    // 3 subtask rows + 1 header streak = 4 flame icons total on the card
    await expect(japaneseCard(page).locator('i.ti-flame')).toHaveCount(4)
  })

  test('checking Anki updates the "X of 3 done" footer', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText('0 of 3 done')).toBeVisible()
    await page.getByText('Anki', { exact: true }).click()
    await expect(page.getByText('1 of 3 done')).toBeVisible()
  })

  test('checking 2 subtasks marks the card done (green state)', async ({ page }) => {
    await page.goto('/')
    const card = japaneseCard(page)
    await page.getByText('Anki', { exact: true }).click()
    await page.getByText('Duolingo', { exact: true }).click()
    await expect(page.getByText('2 of 3 done')).toBeVisible()
    await expect(card).toHaveClass(/habit-card-done/)
  })

  test('checking then unchecking updates the footer correctly, and drops the done state', async ({ page }) => {
    await page.goto('/')
    const card = japaneseCard(page)
    await page.getByText('Anki', { exact: true }).click()
    await page.getByText('Duolingo', { exact: true }).click()
    await expect(card).toHaveClass(/habit-card-done/)

    await page.getByText('Anki', { exact: true }).click()
    await expect(page.getByText('1 of 3 done')).toBeVisible()
    await expect(card).not.toHaveClass(/habit-card-done/)
  })

  test('card state restores correctly on page reload', async ({ page }) => {
    await page.goto('/')
    // save() isn't awaited by the click handler, so the optimistic UI can render
    // before the upsert lands — wait for the real network write before reloading,
    // or the reload can race ahead of persistence.
    const saveResponse = page.waitForResponse((r) => r.url().includes('/rest/v1/habit_logs') && r.request().method() === 'POST')
    await page.getByText('Study session', { exact: true }).click()
    await expect(page.getByText('1 of 3 done')).toBeVisible()
    await saveResponse

    await page.reload()
    const checkbox = page.locator('label').filter({ hasText: 'Study session' }).locator('input[type=checkbox]')
    await expect(checkbox).toBeChecked()
    await expect(page.getByText('1 of 3 done')).toBeVisible()
  })

  test('adversarial: rapidly check/uncheck all 3 — footer stays consistent throughout', async ({ page }) => {
    await page.goto('/')
    for (const label of ['Anki', 'Duolingo', 'Study session']) {
      await page.getByText(label, { exact: true }).click()
    }
    await expect(page.getByText('3 of 3 done')).toBeVisible()
    for (const label of ['Anki', 'Duolingo', 'Study session']) {
      await page.getByText(label, { exact: true }).click()
    }
    await expect(page.getByText('0 of 3 done')).toBeVisible()
  })

  test('adversarial: check subtask, switch to a past date and back — today state preserved', async ({ page }) => {
    await page.goto('/')
    await page.getByText('Anki', { exact: true }).click()
    await expect(page.getByText('1 of 3 done')).toBeVisible()

    await page.locator('button[title="Previous day"]').click()
    await expect(page.getByText('0 of 3 done')).toBeVisible() // clean past day, no logs

    await page.getByText('Back to today', { exact: false }).click()
    await expect(page.getByText('1 of 3 done')).toBeVisible()
    const checkbox = page.locator('label').filter({ hasText: 'Anki' }).locator('input[type=checkbox]')
    await expect(checkbox).toBeChecked()
  })
})
