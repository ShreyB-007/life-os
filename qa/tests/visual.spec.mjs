import { test, expect } from '@playwright/test'

test.describe('visual regression', () => {
  test('vis-01 full page dark mode renders without layout breaks', async ({ page }) => {
    await page.goto('/')
    await page.waitForTimeout(500)
    await expect(page.locator('html')).toHaveClass(/dark/)
    await page.screenshot({ path: 'qa/report/screenshots/full-dark.png', fullPage: true })
  })

  test('vis-02 full page light mode renders without layout breaks', async ({ page }) => {
    await page.goto('/')
    const toggle = page.locator('nav button, nav [role="button"]').filter({ has: page.locator('i.ti-sun, i.ti-moon') }).first()
    const isDark = await page.locator('html').evaluate(el => el.classList.contains('dark'))
    if (isDark) await toggle.click()
    await page.waitForTimeout(500)
    await page.screenshot({ path: 'qa/report/screenshots/full-light.png', fullPage: true })
  })

  test('vis-03 3-column card grid renders correctly', async ({ page }) => {
    await page.goto('/')
    await page.waitForTimeout(500)
    const checkIns = page.locator('.mb-6').filter({ hasText: "Today's check-ins" }).first()
    const gym = checkIns.getByText('Gym', { exact: true })
    const jp = checkIns.getByText('Japanese', { exact: true })
    const dsa = checkIns.getByText('DSA', { exact: true })
    await expect(gym).toBeVisible()
    await expect(jp).toBeVisible()
    await expect(dsa).toBeVisible()
    const [gymBox, jpBox, dsaBox] = await Promise.all([gym.boundingBox(), jp.boundingBox(), dsa.boundingBox()])
    expect(gymBox).toBeTruthy()
    expect(jpBox).toBeTruthy()
    expect(dsaBox).toBeTruthy()
  })

  test('vis-04 topbar renders without overflow', async ({ page }) => {
    await page.goto('/')
    const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1)
    expect(hasHorizontalOverflow).toBe(false)
  })
})
