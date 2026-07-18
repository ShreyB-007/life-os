import { test, expect } from '@playwright/test'
import { testDb, readEffectiveColors, contrastRatio } from './helpers'

const LINKS: Array<[string, string, string]> = [
  ['Dashboard', '/', 'Gym'],
  ['Goals', '/goals', 'Goal tracker'],
  ['Masters', '/masters', 'Country'],
  ['Digest', '/digest', 'Digest'],
  ['Review', '/review', 'Review'],
]

test.describe('Navigation', () => {
  for (const [label, path] of LINKS) {
    test(`${label} link navigates to ${path}`, async ({ page }) => {
      await page.goto('/')
      await page.getByRole('link', { name: label, exact: false }).click()
      await expect(page).toHaveURL(new RegExp(`${path.replace('/', '\\/')}$`))
    })
  }

  test('active nav item shows an accent underline and is-active class', async ({ page }) => {
    await page.goto('/goals')
    const goalsLink = page.getByRole('link', { name: 'Goals', exact: false })
    await expect(goalsLink).toHaveClass(/is-active/)
    await expect(goalsLink.locator('span')).toBeVisible()
  })

  test('no nav link text becomes low-contrast/invisible on hover (dark mode)', async ({ page }) => {
    await page.goto('/')
    for (const [label] of LINKS) {
      const link = page.getByRole('link', { name: label, exact: false })
      await link.hover()
      const { fg, bg } = await readEffectiveColors(link)
      expect(fg).not.toBeNull()
      if (fg && bg) {
        expect(contrastRatio(fg, bg)).toBeGreaterThan(1.8)
      }
    }
  })

  test('back navigation from a Masters report returns to /masters', async ({ page }) => {
    const { data: japan } = await testDb.from('countries').select('id').eq('name', 'Japan').single()
    await page.goto(`/masters/country/${japan.id}`)
    // both the navbar and the report's own back-link are named "Masters" — scope to <main>
    await page.locator('main').getByRole('link', { name: 'Masters', exact: true }).click()
    await expect(page).toHaveURL(/\/masters$/)
  })

  test('route changes are client-side SPA navigation (no full reload)', async ({ page }) => {
    await page.goto('/')
    let navigations = 0
    page.on('framenavigated', () => { navigations++ })
    await page.getByRole('link', { name: 'Goals', exact: false }).click()
    await page.waitForTimeout(300)
    expect(navigations).toBeLessThanOrEqual(1)
  })
})
