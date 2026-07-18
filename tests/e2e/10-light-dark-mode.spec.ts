import { test, expect } from '@playwright/test'
import { testDb, todayStr, findLowContrastText, readEffectiveColors, contrastRatio } from './helpers'

async function toggleTo(page: import('@playwright/test').Page, mode: 'dark' | 'light') {
  const isDark = await page.locator('html').evaluate((el) => el.classList.contains('dark'))
  if ((mode === 'dark') !== isDark) {
    await page.getByRole('button', { name: 'Toggle dark mode' }).click()
  }
}

test.describe('Light / Dark Mode', () => {
  test.afterEach(async () => {
    await testDb.from('habit_logs').delete().eq('log_date', todayStr())
  })

  test('dark mode is the default on first load', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('html')).toHaveClass(/dark/)
  })

  test('light mode toggle switches correctly', async ({ page }) => {
    await page.goto('/')
    await toggleTo(page, 'light')
    await expect(page.locator('html')).not.toHaveClass(/dark/)
  })

  test('preference persists across reload', async ({ page }) => {
    await page.goto('/')
    await toggleTo(page, 'light')
    await page.reload()
    await expect(page.locator('html')).not.toHaveClass(/dark/)
    expect(await page.evaluate(() => localStorage.getItem('theme'))).toBe('light')
  })

  test('dashboard: no low-contrast text in dark mode', async ({ page }) => {
    await page.goto('/')
    const offenders = await findLowContrastText(page, 'h1, h2, h3, p, span, button, label')
    expect(offenders).toEqual([])
  })

  test('dashboard: no low-contrast text in light mode', async ({ page }) => {
    await page.goto('/')
    await toggleTo(page, 'light')
    const offenders = await findLowContrastText(page, 'h1, h2, h3, p, span, button, label')
    expect(offenders).toEqual([])
  })

  test('navbar hover contrast holds in both themes', async ({ page }) => {
    await page.goto('/')
    for (const mode of ['dark', 'light'] as const) {
      await toggleTo(page, mode)
      for (const label of ['Dashboard', 'Goals', 'Masters', 'Digest', 'Review']) {
        const link = page.getByRole('link', { name: label, exact: false })
        await link.hover()
        const { fg, bg } = await readEffectiveColors(link)
        if (fg && bg) expect(contrastRatio(fg, bg), `${label} in ${mode}`).toBeGreaterThan(1.8)
      }
    }
  })

  test('habit cards: all text readable in both modes', async ({ page }) => {
    await page.goto('/')
    for (const mode of ['dark', 'light'] as const) {
      await toggleTo(page, mode)
      const offenders = await findLowContrastText(page, '.habit-card, .habit-card-done, .habit-card *')
      expect(offenders, mode).toEqual([])
    }
  })

  test('workout drawer: all text readable in both modes', async ({ page }) => {
    await page.goto('/')
    for (const mode of ['dark', 'light'] as const) {
      // toggle BEFORE opening the drawer — its fixed backdrop covers the whole
      // viewport (including the navbar toggle button) while open
      await toggleTo(page, mode)
      await page.getByRole('button', { name: 'Push', exact: false }).first().click()
      await expect(page.getByRole('heading', { name: /Push Day/ })).toBeVisible()
      const offenders = await findLowContrastText(page, '.animate-slide-up-drawer h2, .animate-slide-up-drawer button, .animate-slide-up-drawer span')
      expect(offenders, mode).toEqual([])
      await page.locator('.animate-slide-up-drawer button:has(i.ti-x)').first().click()
      await expect(page.getByRole('heading', { name: /Push Day/ })).toHaveCount(0)
    }
  })

  test('goals page: readable in both modes', async ({ page }) => {
    await page.goto('/goals')
    for (const mode of ['dark', 'light'] as const) {
      await toggleTo(page, mode)
      const offenders = await findLowContrastText(page, 'article, article *, h1, aside label')
      expect(offenders, mode).toEqual([])
    }
  })

  test('masters page: readable in both modes', async ({ page }) => {
    await page.goto('/masters')
    for (const mode of ['dark', 'light'] as const) {
      await toggleTo(page, mode)
      const offenders = await findLowContrastText(page, '.masters-tree-row, .masters-tree-row *, h1')
      expect(offenders, mode).toEqual([])
    }
  })
})
