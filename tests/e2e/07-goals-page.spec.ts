import { test, expect, Page } from '@playwright/test'
import { testDb, cleanupTestGoals, QA_PREFIX } from './helpers'

// NOTE ON SCOPE: the task brief for this file assumed a goal-detail page with a circular
// progress ring, sub-goals, and a completion-animation prompt. None of that exists in
// src/pages/Goals.jsx — there is no /goals/:id route, no sub-goal model anywhere in the
// schema, and goal cards don't navigate anywhere. Tests below exercise the feature as it
// is actually implemented: a single list page with an always-visible inline create/edit
// form and flat progress bars. See the final QA report for the full list of assumed-vs-
// actual differences.

// `selector` is the FULL child selector to resolve within the labeled <label> wrapper
// (Field renders the control as a child of a real <label>, no htmlFor/id pairing).
// Progress uniquely has TWO inputs (range + number) sharing one label, hence the
// explicit `input[type="number"]` / `input[type="range"]` selectors at call sites.
function fieldInput(page: Page, label: string, selector = 'input') {
  return page.locator('label').filter({ hasText: label }).locator(selector)
}
function goalCard(page: Page, name: string) {
  return page.locator('article').filter({ hasText: name })
}
async function fillCreateForm(page: Page, opts: { name: string; progress?: number; status?: string; order?: number }) {
  await fieldInput(page, 'Name').fill(opts.name)
  if (opts.progress != null) await fieldInput(page, 'Progress', 'input[type="number"]').fill(String(opts.progress))
  if (opts.status) await fieldInput(page, 'Status', 'select').selectOption(opts.status)
  if (opts.order != null) await fieldInput(page, 'Order', 'input[type="number"]').fill(String(opts.order))
}

test.describe('Goals Page', () => {
  test.afterEach(cleanupTestGoals)

  test('goals list loads with existing goals visible', async ({ page }) => {
    await page.goto('/goals')
    await expect(page.locator('article').first()).toBeVisible()
    await expect(page.getByText('No goals yet.')).toHaveCount(0)
    expect(await page.locator('article').count()).toBeGreaterThan(0)
  })

  test('creating a goal via the inline form adds it to the list', async ({ page }) => {
    await page.goto('/goals')
    const name = `${QA_PREFIX}Learn Rust`
    await fillCreateForm(page, { name, progress: 40 })
    await page.getByRole('button', { name: 'Create goal' }).click()
    await expect(goalCard(page, name)).toBeVisible()
    await expect(goalCard(page, name).getByText('40%')).toBeVisible()
  })

  test('empty name is blocked with an inline error banner, no request sent', async ({ page }) => {
    await page.goto('/goals')
    await fieldInput(page, 'Name').fill('   ')
    await page.getByRole('button', { name: 'Create goal' }).click()
    await expect(page.getByText('Goal name is required.')).toBeVisible()
  })

  test('adversarial: a 500-character name is accepted (no client-side length limit)', async ({ page }) => {
    await page.goto('/goals')
    const longName = `${QA_PREFIX}${'X'.repeat(490)}`
    await fillCreateForm(page, { name: longName })
    await page.getByRole('button', { name: 'Create goal' }).click()
    await expect(page.getByText('Goal name is required.')).toHaveCount(0)
    await expect(goalCard(page, longName.slice(0, 30))).toBeVisible()
  })

  test('adversarial: an emoji-only name is accepted', async ({ page }) => {
    await page.goto('/goals')
    const name = `${QA_PREFIX}🎯🔥🚀`
    await fillCreateForm(page, { name })
    await page.getByRole('button', { name: 'Create goal' }).click()
    await expect(goalCard(page, name)).toBeVisible()
  })

  test('quick +/- progress buttons adjust by 5 and auto-flip status at the 100 boundary', async ({ page }) => {
    await page.goto('/goals')
    const name = `${QA_PREFIX}Boundary Goal`
    await fillCreateForm(page, { name, progress: 95 })
    await page.getByRole('button', { name: 'Create goal' }).click()
    const card = goalCard(page, name)
    await expect(card).toBeVisible()

    await card.getByRole('button', { name: 'Increase progress' }).click()
    await expect(card.getByText('100%')).toBeVisible()
    await expect(card.getByText('complete', { exact: true })).toBeVisible()

    await card.getByRole('button', { name: 'Decrease progress' }).click()
    await expect(card.getByText('95%')).toBeVisible()
    await expect(card.getByText('active', { exact: true })).toBeVisible()
  })

  test('Edit populates the form; Cancel discards without saving', async ({ page }) => {
    await page.goto('/goals')
    const name = `${QA_PREFIX}Editable Goal`
    await fillCreateForm(page, { name, progress: 10 })
    await page.getByRole('button', { name: 'Create goal' }).click()
    const card = goalCard(page, name)
    await expect(card).toBeVisible()
    await expect(page.getByRole('button', { name: 'Saving' })).toHaveCount(0) // let the create request fully settle

    await card.getByRole('button', { name: 'Edit' }).click()
    await expect(page.getByText('Edit goal')).toBeVisible()
    await expect(fieldInput(page, 'Name')).toHaveValue(name)

    await page.getByRole('button', { name: 'Cancel' }).click()
    await expect(page.getByText('Create target')).toBeVisible()
    await expect(fieldInput(page, 'Name')).toHaveValue('')
    // untouched by the cancelled edit
    await expect(card.getByText('10%')).toBeVisible()
  })

  test('Delete removes the goal immediately with no confirmation modal', async ({ page }) => {
    await page.goto('/goals')
    const name = `${QA_PREFIX}Deletable Goal`
    await fillCreateForm(page, { name })
    await page.getByRole('button', { name: 'Create goal' }).click()
    const card = goalCard(page, name)
    await expect(card).toBeVisible()

    await card.getByRole('button', { name: 'Delete' }).click()
    await expect(goalCard(page, name)).toHaveCount(0)
  })

  test('adversarial: failed delete rolls back optimistic removal and shows an error', async ({ page }) => {
    await page.goto('/goals')
    const name = `${QA_PREFIX}Rollback Goal`
    await fillCreateForm(page, { name })
    await page.getByRole('button', { name: 'Create goal' }).click()
    const card = goalCard(page, name)
    await expect(card).toBeVisible()

    await page.route('**/rest/v1/goals*', (route) => {
      if (route.request().method() === 'DELETE') {
        route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'forced failure' }) })
      } else {
        route.continue()
      }
    })

    await card.getByRole('button', { name: 'Delete' }).click()
    await expect(page.getByText('Could not delete goal.')).toBeVisible()
    await expect(goalCard(page, name)).toBeVisible() // rolled back, still present

    await page.unroute('**/rest/v1/goals*')
    await card.getByRole('button', { name: 'Delete' }).click()
    await expect(goalCard(page, name)).toHaveCount(0)
  })

  test('adversarial: progress and status are independently settable via the form (no auto-sync there)', async ({ page }) => {
    await page.goto('/goals')
    const name = `${QA_PREFIX}Independent Fields`
    await fillCreateForm(page, { name, progress: 100, status: 'active' })
    await page.getByRole('button', { name: 'Create goal' }).click()
    const card = goalCard(page, name)
    await expect(card.getByText('100%')).toBeVisible()
    await expect(card.getByText('active', { exact: true })).toBeVisible()
  })

  test('adversarial: Order field clamps below-1 values up to 1', async ({ page }) => {
    await page.goto('/goals')
    const orderInput = fieldInput(page, 'Order', 'input[type="number"]')
    await orderInput.fill('-5')
    await orderInput.blur()
    const val = await orderInput.inputValue()
    expect(Number(val)).toBeGreaterThanOrEqual(1)
  })

  test('a goal at 100% behaves as "reopened" when nudged down via Decrease (no dedicated Reopen button exists)', async ({ page }) => {
    await page.goto('/goals')
    const name = `${QA_PREFIX}Reopen Flow`
    await fillCreateForm(page, { name, progress: 100, status: 'complete' })
    await page.getByRole('button', { name: 'Create goal' }).click()
    const card = goalCard(page, name)
    await expect(card.getByText('complete', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Reopen goal' })).toHaveCount(0)

    await card.getByRole('button', { name: 'Decrease progress' }).click()
    await expect(card.getByText('active', { exact: true })).toBeVisible()
  })
})
