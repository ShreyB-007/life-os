import { test, expect, Page } from '@playwright/test'
import { testDb, cleanupTestCountries, cleanupTestUniversities, QA_PREFIX } from './helpers'

const SEEDED_COUNTRIES = ['United Kingdom', 'United States', 'Japan', 'Singapore', 'Germany', 'Canada', 'Austria', 'Netherlands']

// `.masters-tree-row` scoping matters: a country's own right panel also renders its
// universities as separate "habit-card"-styled buttons, whose accessible name can
// also match a plain text search for the same name — scoping to the tree specifically
// disambiguates "the row in the sidebar" from "the card in the right panel".
function countryRow(page: Page, name: string) {
  return page.locator('.masters-tree-row').filter({ hasText: name })
}
function universityRow(page: Page, name: string) {
  return page.locator('.masters-tree-row').filter({ hasText: name })
}
function modal(page: Page) {
  return page.locator('div[class*="top-1/2"][class*="-translate-x-1/2"]')
}

test.describe('Masters Page', () => {
  test.afterEach(async () => {
    await cleanupTestCountries()
    await cleanupTestUniversities()
  })

  test('tree loads with the 8 seeded countries', async ({ page }) => {
    await page.goto('/masters')
    await expect(page.getByText('Loading research tree')).toHaveCount(0, { timeout: 10000 })
    for (const name of SEEDED_COUNTRIES) {
      await expect(countryRow(page, name)).toBeVisible()
    }
  })

  test('unresearched countries show a gray status dot; Japan (pre-researched) shows green', async ({ page }) => {
    await page.goto('/masters')
    const singaporeDot = countryRow(page, 'Singapore').locator('span.rounded-full').first()
    await expect(singaporeDot).toHaveCSS('background-color', 'rgb(74, 74, 96)')

    const japanDot = countryRow(page, 'Japan').locator('span.rounded-full').first()
    await expect(japanDot).toHaveCSS('background-color', 'rgb(16, 185, 129)')
  })

  test('clicking a country expands it and shows the right panel with "Research this country"', async ({ page }) => {
    await page.goto('/masters')
    await countryRow(page, 'Singapore').click()
    await expect(page.getByRole('button', { name: 'Research this country' })).toBeVisible()
    await expect(page.getByText('Add university here')).toBeVisible()
  })

  test('a researched country (Japan) shows Open Report + Refresh instead', async ({ page }) => {
    await page.goto('/masters')
    await countryRow(page, 'Japan').click()
    await expect(page.getByRole('button', { name: 'Open Report' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Refresh current data' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Research this country' })).toHaveCount(0)
  })

  test('"+ Country" opens the add-country modal; both fields are required', async ({ page }) => {
    await page.goto('/masters')
    await page.getByRole('button', { name: 'Country', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Add country' })).toBeVisible()
    await modal(page).getByRole('button', { name: 'Add country' }).click()
    await expect(page.getByText('Country name and flag emoji are required.')).toBeVisible()
  })

  test('adding a country succeeds and appears in the tree', async ({ page }) => {
    await page.goto('/masters')
    const name = `${QA_PREFIX}Wonderland`
    await page.getByRole('button', { name: 'Country', exact: true }).click()
    await page.getByPlaceholder('France').fill(name)
    await page.getByPlaceholder('🇫🇷').fill('🏳️')
    await modal(page).getByRole('button', { name: 'Add country' }).click()
    await expect(countryRow(page, name)).toBeVisible()
  })

  test('adversarial: re-adding a country with a name that already exists is NOT blocked', async ({ page }) => {
    const name = `${QA_PREFIX}DupCountry`
    await page.goto('/masters')
    for (let i = 0; i < 2; i++) {
      await page.getByRole('button', { name: 'Country', exact: true }).click()
      await page.getByPlaceholder('France').fill(name)
      await page.getByPlaceholder('🇫🇷').fill('🏁')
      await modal(page).getByRole('button', { name: 'Add country' }).click()
    }
    await expect(countryRow(page, name)).toHaveCount(2)
  })

  test('"+ Add university" saves and appears under the country', async ({ page }) => {
    await page.goto('/masters')
    await countryRow(page, 'Singapore').click()
    await page.getByRole('button', { name: 'Add university', exact: true }).click()
    const name = `${QA_PREFIX}NUS`
    await modal(page).getByPlaceholder('University of Oxford').fill(name)
    await modal(page).getByPlaceholder('Oxford', { exact: true }).fill('Singapore City')
    await modal(page).getByRole('button', { name: 'Add university' }).click()
    await expect(universityRow(page, name)).toBeVisible()
  })

  test('duplicate university name (case-insensitive) within the same country is blocked', async ({ page }) => {
    await page.goto('/masters')
    await countryRow(page, 'Canada').click()
    const name = `${QA_PREFIX}Waterloo`
    await page.getByRole('button', { name: 'Add university', exact: true }).click()
    await modal(page).getByPlaceholder('University of Oxford').fill(name)
    await modal(page).getByRole('button', { name: 'Add university' }).click()
    await expect(universityRow(page, name)).toBeVisible()

    // adding a university auto-selects it (right panel switches to UniversityPanel),
    // so the country must be reselected to get back to CountryPanel's "Add university"
    await countryRow(page, 'Canada').click()
    await page.getByRole('button', { name: 'Add university', exact: true }).click()
    await modal(page).getByPlaceholder('University of Oxford').fill(name.toLowerCase())
    await modal(page).getByRole('button', { name: 'Add university' }).click()
    await expect(page.getByText(/already added under/)).toBeVisible()
  })

  test('empty university name is rejected', async ({ page }) => {
    await page.goto('/masters')
    await countryRow(page, 'Austria').click()
    await page.getByRole('button', { name: 'Add university', exact: true }).click()
    await modal(page).getByRole('button', { name: 'Add university' }).click()
    await expect(page.getByText('University name is required.')).toBeVisible()
  })

  test('the legend shows all 4 status rows with exact copy', async ({ page }) => {
    await page.goto('/masters')
    await expect(page.getByText('Not researched', { exact: true })).toBeVisible()
    await expect(page.getByText('Data stale (>6 months)', { exact: true })).toBeVisible()
    await expect(page.getByText('Up to date', { exact: true })).toBeVisible()
    await expect(page.getByText('Has personal notes', { exact: true })).toBeVisible()
  })

  test('notes index shows the empty state when no personal notes exist yet', async ({ page }) => {
    await page.goto('/masters')
    await expect(page.getByText('No notes yet. Open a country or university report and add your thoughts.')).toBeVisible()
  })

  test('personal notes save on blur and then appear in the notes index', async ({ page }) => {
    const { data: japan } = await testDb.from('countries').select('id, personal_notes').eq('name', 'Japan').single()
    try {
      await page.goto(`/masters/country/${japan.id}`)
      await expect(page.getByRole('heading', { name: /Japan/ })).toBeVisible()
      await page.getByRole('button', { name: /Add your personal thoughts/ }).click()
      const noteText = `${QA_PREFIX}note ${Date.now()}`
      await page.locator('textarea').fill(noteText)
      // save() flips `editing` false synchronously and renders the local value
      // immediately, ahead of the PATCH actually landing — wait for the real
      // network round-trip so the /masters refetch below sees committed data.
      const updateResponse = page.waitForResponse((r) => r.url().includes('/rest/v1/countries') && r.request().method() === 'PATCH')
      await page.locator('textarea').blur()
      await updateResponse
      await expect(page.getByText(noteText)).toBeVisible()

      await page.goto('/masters')
      await expect(page.getByText('No notes yet.', { exact: false })).toHaveCount(0)
      await expect(page.getByText(noteText.slice(0, 40), { exact: false })).toBeVisible()
    } finally {
      await testDb.from('countries').update({ personal_notes: japan.personal_notes ?? '' }).eq('id', japan.id)
    }
  })

  test('removing a university shows a confirm modal with exact copy, then deletes it', async ({ page }) => {
    await page.goto('/masters')
    await countryRow(page, 'Netherlands').click()
    const name = `${QA_PREFIX}Delft`
    await page.getByRole('button', { name: 'Add university', exact: true }).click()
    await modal(page).getByPlaceholder('University of Oxford').fill(name)
    await modal(page).getByRole('button', { name: 'Add university' }).click()
    await universityRow(page, name).click()

    await page.getByRole('button', { name: 'Remove university' }).click()
    await expect(page.getByText(`Remove ${name}?`)).toBeVisible()
    await expect(page.getByText('All research and notes for this university will be deleted.')).toBeVisible()

    await modal(page).getByRole('button', { name: 'Remove university' }).click()
    await expect(universityRow(page, name)).toHaveCount(0)
  })

  test('removing a country with universities shows the correct warning and cascades', async ({ page }) => {
    await page.goto('/masters')
    const countryName = `${QA_PREFIX}CascadeLand`
    await page.getByRole('button', { name: 'Country', exact: true }).click()
    await page.getByPlaceholder('France').fill(countryName)
    await page.getByPlaceholder('🇫🇷').fill('🏴')
    await modal(page).getByRole('button', { name: 'Add country' }).click()
    await countryRow(page, countryName).click()

    const uniName = `${QA_PREFIX}CascadeU`
    await page.getByRole('button', { name: 'Add university', exact: true }).click()
    await modal(page).getByPlaceholder('University of Oxford').fill(uniName)
    await modal(page).getByRole('button', { name: 'Add university' }).click()

    await countryRow(page, countryName).click() // reselect country (adding a uni auto-selects it instead)
    await page.getByRole('button', { name: 'Remove country' }).click()
    await expect(page.getByText('This will also remove 1 universities and all their research data. This cannot be undone.')).toBeVisible()
    await modal(page).getByRole('button', { name: 'Remove country' }).click()

    await expect(countryRow(page, countryName)).toHaveCount(0)
    await expect(universityRow(page, uniName)).toHaveCount(0)
  })

  test('removing a country with 0 universities still shows the warning (not conditionally hidden)', async ({ page }) => {
    await page.goto('/masters')
    const countryName = `${QA_PREFIX}EmptyLand`
    await page.getByRole('button', { name: 'Country', exact: true }).click()
    await page.getByPlaceholder('France').fill(countryName)
    await page.getByPlaceholder('🇫🇷').fill('🏴')
    await modal(page).getByRole('button', { name: 'Add country' }).click()
    await countryRow(page, countryName).click()

    await page.getByRole('button', { name: 'Remove country' }).click()
    await expect(page.getByText('This will also remove 0 universities and all their research data. This cannot be undone.')).toBeVisible()
    await modal(page).getByRole('button', { name: 'Remove country' }).click()
    await expect(countryRow(page, countryName)).toHaveCount(0)
  })

  test('research button shows a loading state, and a quota failure renders the friendly message without corrupting existing data', async ({ page }) => {
    await page.route('**/functions/v1/masters-research', async (route) => {
      await new Promise((r) => setTimeout(r, 700))
      await route.fulfill({
        status: 500, contentType: 'application/json',
        body: JSON.stringify({ error: 'Gemini quota exceeded. Research was not saved; retry after quota resets or billing is enabled.' }),
      })
    })

    await page.goto('/masters')
    await countryRow(page, 'Netherlands').click()
    await page.getByRole('button', { name: 'Research this country' }).click()
    // both the button and the ResearchProgress panel heading read "Researching X..." — scope to the button
    await expect(page.getByRole('button', { name: 'Researching Netherlands...' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Researching Netherlands...' })).toBeDisabled()

    await expect(page.getByText('Provider quota exceeded. Your existing report was not changed; try refreshing again after the Gemini quota resets.')).toBeVisible({ timeout: 5000 })
    // still unresearched afterwards — failure did not fabricate data
    await expect(page.getByRole('button', { name: 'Research this country' })).toBeVisible()
  })

  test('adding 20 universities to one country renders without crashing', async ({ page }) => {
    const { data: country } = await testDb.from('countries').select('id').eq('name', 'Germany').single()
    const rows = Array.from({ length: 20 }, (_, i) => ({
      country_id: country.id, name: `${QA_PREFIX}Uni-${i}-${Date.now()}`,
    }))
    await testDb.from('universities').insert(rows)

    await page.goto('/masters')
    await countryRow(page, 'Germany').click()
    for (const row of rows) {
      await expect(universityRow(page, row.name)).toBeVisible()
    }
  })
})
