import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

function loadEnvLocal(): Record<string, string> {
  const path = join(__dirname, '..', '..', '.env.local')
  const content = readFileSync(path, 'utf-8')
  const env: Record<string, string> = {}
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim()
  }
  return env
}

const env = loadEnvLocal()

// Direct DB access for test fixture setup/teardown — the app has no test/staging
// Supabase project, so E2E tests run against the same DB as `npm run dev`. All
// fixtures created by tests are prefixed QA_PREFIX and swept up by cleanupAll().
export const testDb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY)

export const QA_PREFIX = 'QA-Test-'

export function localDateStr(d: Date = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function todayStr(): string {
  return localDateStr(new Date())
}

export function addDays(dateStr: string, delta: number): string {
  const d = new Date(`${dateStr}T00:00:00`)
  d.setDate(d.getDate() + delta)
  return localDateStr(d)
}

export function weekday(dateStr: string): number {
  return new Date(`${dateStr}T00:00:00`).getDay()
}

export async function cleanupTestGoals() {
  await testDb.from('goals').delete().like('name', `${QA_PREFIX}%`)
}

export async function cleanupTestCountries() {
  const { data: countries } = await testDb.from('countries').select('id').like('name', `${QA_PREFIX}%`)
  const ids = (countries || []).map((c: any) => c.id)
  if (ids.length) {
    await testDb.from('research_sources').delete().in('entity_id', ids)
    await testDb.from('universities').delete().in('country_id', ids)
    await testDb.from('countries').delete().in('id', ids)
  }
}

export async function cleanupTestUniversities() {
  const { data: unis } = await testDb.from('universities').select('id').like('name', `${QA_PREFIX}%`)
  const ids = (unis || []).map((u: any) => u.id)
  if (ids.length) {
    await testDb.from('research_sources').delete().in('entity_id', ids)
    await testDb.from('universities').delete().in('id', ids)
  }
}

export async function cleanupTestExercises() {
  const { data: exs } = await testDb.from('exercises').select('id').like('name', `${QA_PREFIX}%`)
  const ids = (exs || []).map((e: any) => e.id)
  if (ids.length) {
    await testDb.from('exercise_logs').delete().in('exercise_id', ids)
    await testDb.from('exercises').delete().in('id', ids)
  }
}

export async function cleanupAll() {
  await Promise.all([cleanupTestGoals(), cleanupTestCountries(), cleanupTestUniversities(), cleanupTestExercises()])
}

// Minimal fixture so report pages (tabs, sources, personal notes) render without
// spending real Gemini quota. Shape mirrors what MastersCountryReport/mastersResearch expect.
export function fakeResearchPayload() {
  return {
    student_experience: {}, pr_pathway: {}, cost_of_living: {}, job_market: {},
    reddit_community_sentiment: {}, overall_settlement_verdict: null,
    admissions: {}, financials: {}, cs_ai_department: {}, overview: {}, verdict: null,
  }
}

// Walks up from `el`, alpha-compositing every semi-transparent background onto the
// next opaque ancestor (matches what the browser actually paints), and reads the
// element's own text color. Used to catch "white text on white background" style
// regressions across theme toggles — naively treating a translucent bg as opaque
// produces false positives on the app's many `color+'22'`-style tinted badges.
export async function readEffectiveColors(locator: import('@playwright/test').Locator) {
  return locator.evaluate((el) => {
    function parseColor(str: string) {
      const m = str.match(/rgba?\(([^)]+)\)/)
      if (!m) return null
      const parts = m[1].split(',').map((s) => parseFloat(s.trim()))
      return { r: parts[0], g: parts[1], b: parts[2], a: parts[3] ?? 1 }
    }
    function over(top: { r: number; g: number; b: number; a: number }, under: { r: number; g: number; b: number }) {
      return { r: top.r * top.a + under.r * (1 - top.a), g: top.g * top.a + under.g * (1 - top.a), b: top.b * top.a + under.b * (1 - top.a) }
    }
    // Collect background layers from `el` outward to the nearest opaque ancestor (or html).
    const layers: { r: number; g: number; b: number; a: number }[] = []
    let bgEl: Element | null = el
    while (bgEl) {
      const c = parseColor(getComputedStyle(bgEl).backgroundColor)
      if (c && c.a > 0) {
        layers.push(c)
        if (c.a >= 1) break
      }
      bgEl = bgEl.parentElement
    }
    // Composite from the outermost (last collected) layer down to the closest (first collected).
    let acc: { r: number; g: number; b: number } | null = null
    for (let i = layers.length - 1; i >= 0; i--) {
      acc = over(layers[i], acc ?? { r: 255, g: 255, b: 255 })
    }
    const fg = parseColor(getComputedStyle(el).color)
    return { fg, bg: acc }
  })
}

function relativeLuminance(c: { r: number; g: number; b: number }) {
  const [rs, gs, bs] = [c.r, c.g, c.b].map((v) => {
    const x = v / 255
    return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs
}

export function contrastRatio(c1: { r: number; g: number; b: number }, c2: { r: number; g: number; b: number }) {
  const l1 = relativeLuminance(c1) + 0.05
  const l2 = relativeLuminance(c2) + 0.05
  return l1 > l2 ? l1 / l2 : l2 / l1
}

// All centered dialogs (AddExerciseModal, DeleteConfirmModal, ProgressGraph, Masters
// Country/University/Confirm modals) share this exact Tailwind centering combo, and the
// app only ever shows one at a time — so this reliably resolves to "the open modal".
export function centeredModal(page: import('@playwright/test').Page) {
  return page.locator('div[class*="top-1/2"][class*="-translate-x-1/2"]')
}

// Sweeps visible text elements matching `selector` and flags any with a
// foreground/background contrast ratio at or below `minRatio` (near-invisible text).
// Returns the list of offending elements' text content, empty if all pass.
export async function findLowContrastText(
  page: import('@playwright/test').Page,
  selector: string,
  minRatio = 1.5,
): Promise<string[]> {
  const locator = page.locator(selector)
  const count = await locator.count()
  const offenders: string[] = []
  for (let i = 0; i < Math.min(count, 120); i++) {
    const el = locator.nth(i)
    if (!(await el.isVisible())) continue
    // Only leaf-ish elements: a wrapper's OWN `color` is often overridden by
    // differently-styled children, and its textContent is their concatenation —
    // checking it directly produces false positives unrelated to real contrast.
    const isLeaf = await el.evaluate((node) => node.childElementCount === 0)
    if (!isLeaf) continue
    const text = (await el.textContent())?.trim()
    if (!text) continue
    const { fg, bg } = await readEffectiveColors(el)
    if (!fg || !bg) continue
    if (contrastRatio(fg, bg) <= minRatio) offenders.push(text.slice(0, 40))
  }
  return offenders
}
