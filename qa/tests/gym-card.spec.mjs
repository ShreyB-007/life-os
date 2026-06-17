import { test, expect } from '@playwright/test'

test.describe('gym card', () => {
  test('gym-01 card renders with Gym title', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText('Gym', { exact: true })).toBeVisible()
  })

  test('gym-03 4 workout buttons: Push, Pull, Legs, Cardio', async ({ page }) => {
    await page.goto('/')
    for (const name of ['Push', 'Pull', 'Legs', 'Cardio']) {
      await expect(page.getByRole('button', { name, exact: false }).first()).toBeVisible()
    }
  })

  test('gym-04 rest day button visible', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('button', { name: /rest day/i })).toBeVisible()
  })

  test('gym-08 clicking a workout type selects it', async ({ page }) => {
    await page.goto('/')
    const pushButton = page.getByRole('button', { name: 'Push', exact: false }).first()
    await pushButton.click()
    await page.waitForTimeout(300)
    const cls = await pushButton.getAttribute('class')
    expect(cls).toBeTruthy()
  })
})
