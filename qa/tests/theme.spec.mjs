import { test, expect } from '@playwright/test'

test.describe('theme', () => {
  test('theme-01 page loads in dark mode by default', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('html')).toHaveClass(/dark/)
  })

  test('theme-02 toggle button exists in navbar', async ({ page }) => {
    await page.goto('/')
    const toggle = page.locator('nav button, nav [role="button"]').filter({ has: page.locator('i.ti-sun, i.ti-moon') })
    await expect(toggle.first()).toBeVisible()
  })

  test('theme-03 clicking toggle switches html.dark on/off', async ({ page }) => {
    await page.goto('/')
    const toggle = page.locator('nav button, nav [role="button"]').filter({ has: page.locator('i.ti-sun, i.ti-moon') }).first()
    const wasDark = await page.locator('html').evaluate(el => el.classList.contains('dark'))
    await toggle.click()
    await expect(page.locator('html')).toHaveClass(wasDark ? /^((?!dark).)*$/ : /dark/)
  })

  test('theme-04 theme choice persists in localStorage across reload', async ({ page }) => {
    await page.goto('/')
    const toggle = page.locator('nav button, nav [role="button"]').filter({ has: page.locator('i.ti-sun, i.ti-moon') }).first()
    await toggle.click()
    const stored = await page.evaluate(() => localStorage.getItem('theme'))
    expect(stored).toBeTruthy()
    await page.reload()
    const classAfterReload = await page.locator('html').evaluate(el => el.className)
    expect(classAfterReload.includes('dark')).toBe(stored === 'dark')
  })
})
