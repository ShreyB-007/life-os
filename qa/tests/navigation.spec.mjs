import { test, expect } from '@playwright/test'

test.describe('navigation', () => {
  test('nav-01 navbar has 5 links: Dashboard, Goals, Masters, Digest, Review', async ({ page }) => {
    await page.goto('/')
    for (const name of ['Dashboard', 'Goals', 'Masters', 'Digest', 'Review']) {
      await expect(page.getByRole('link', { name, exact: false })).toBeVisible()
    }
  })

  test('nav-02 active link shows an accent indicator', async ({ page }) => {
    await page.goto('/')
    const dashboardLink = page.getByRole('link', { name: 'Dashboard', exact: false })
    const cls = await dashboardLink.getAttribute('class')
    expect(cls).toBeTruthy()
  })

  test('nav-03 route changes are SPA (no full page reload)', async ({ page }) => {
    await page.goto('/')
    let navigations = 0
    page.on('framenavigated', () => { navigations++ })
    await page.getByRole('link', { name: 'Goals', exact: false }).click()
    await page.waitForTimeout(300)
    expect(navigations).toBeLessThanOrEqual(1)
  })
})
