import { chromium } from 'playwright'
import { existsSync, mkdirSync } from 'fs'

const SHOTS_DIR = 'C:/Temp/qa_r3'
if (!existsSync(SHOTS_DIR)) mkdirSync(SHOTS_DIR, { recursive: true })

const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
const page = await ctx.newPage()

const consoleErrors = []
page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()) })

const shot = async name => {
  await page.screenshot({ path: `${SHOTS_DIR}/${name}.png` })
  console.log('📸 ' + name)
}

await page.goto('http://localhost:5174', { waitUntil: 'networkidle', timeout: 30000 })
await page.waitForTimeout(2000)
await shot('00_load')

// ─── Helper: get Japanese streaks ───────────────────────────────────────────
async function getJapaneseStreaks() {
  const japCard = page.locator('.relative.overflow-hidden.rounded-xl').filter({ hasText: 'Japanese' }).first()
  const nums = await japCard.locator('.font-mono').allTextContents()
  return nums.map(n => n.trim())
}

// ─── FIX 1: Check Anki subtask, verify streaks don't flash 0 ────────────────
console.log('\n=== FIX 1: Japanese subtask check — streaks must not flash 0 ===')

const streaksBefore = await getJapaneseStreaks()
console.log('Streaks before toggle:', JSON.stringify(streaksBefore))

const japCard = page.locator('.relative.overflow-hidden.rounded-xl').filter({ hasText: 'Japanese' }).first()
const ankiRow = japCard.locator('.flex.items-center.justify-between').filter({ has: page.locator('input[type="checkbox"]') }).first()
const ankiCheckbox = ankiRow.locator('input[type="checkbox"]')
const ankiChecked = await ankiCheckbox.isChecked()

// Toggle Anki
await ankiCheckbox.click()
// Capture immediately after click (before any re-renders settle)
await page.waitForTimeout(100)
const streaksImmediate = await getJapaneseStreaks()
console.log('Streaks immediately after toggle:', JSON.stringify(streaksImmediate))

await page.waitForTimeout(1000)
const streaksAfter = await getJapaneseStreaks()
console.log('Streaks 1s after toggle:', JSON.stringify(streaksAfter))

// None should be '0' unless they were actually 0 before
const hadZero = streaksBefore.some(s => s === '0')
const gotZero = streaksImmediate.some(s => s === '0')
const fix1Pass = hadZero || !gotZero
console.log('Streaks had 0 before:', hadZero)
console.log('Streaks got 0 after toggle:', gotZero)
console.log('FIX 1 PASS (no unexpected 0 flash):', fix1Pass)
await shot('01_japanese_after_toggle')

// Restore Anki to original state
await ankiCheckbox.click()
await page.waitForTimeout(500)

// ─── FIX 2: Gym rest day deselect — streak must not flash 0 ─────────────────
console.log('\n=== FIX 2: Gym rest day deselect — streak must not flash 0 ===')

const gymCard = page.locator('.relative.overflow-hidden.rounded-xl').filter({ hasText: 'Gym' }).first()
const gymStreakBefore = await gymCard.locator('.font-mono').first().textContent().catch(() => '?')
console.log('Gym streak before:', gymStreakBefore)

// Check if rest day is currently active
const gymStatus = await gymCard.locator('span').filter({ hasText: /Done|Select|Rest/ }).first().textContent().catch(() => '?')
console.log('Gym status:', gymStatus)

if (gymStatus.includes('Rest day')) {
  const restBtn = gymCard.locator('button').filter({ hasText: /^Rest day/ })
  await restBtn.click()
  await page.waitForTimeout(100)
  const gymStreakImmediate = await gymCard.locator('.font-mono').first().textContent().catch(() => '?')
  console.log('Gym streak immediately after deselect:', gymStreakImmediate)
  await page.waitForTimeout(500)
  const gymStreakAfter = await gymCard.locator('.font-mono').first().textContent().catch(() => '?')
  console.log('Gym streak 0.5s after deselect:', gymStreakAfter)
  const fix2Pass = gymStreakImmediate !== '0' || gymStreakBefore === '0'
  console.log('FIX 2 PASS (no 0 flash):', fix2Pass)
  await shot('02_gym_after_rest_deselect')
} else {
  console.log('⚠️ Rest day not active today — cannot test deselect. SKIP FIX 2')
  await shot('02_gym_skip')
}

// ─── FIX 3: Graph tooltip on dot center ─────────────────────────────────────
console.log('\n=== FIX 3: Graph tooltip activates on dot center ===')

// Open the active gym drawer to find a graph
const activeMatch = gymStatus.match(/Done — (\w+)/)
const activeType = activeMatch ? activeMatch[1] : null
console.log('Active gym type:', activeType)

if (activeType) {
  const activeBtn = gymCard.locator('button').filter({ hasText: new RegExp('^' + activeType) })
  await activeBtn.click()
  await page.waitForTimeout(2000)

  const graphBtns = page.locator('.fixed.bottom-0 button').filter({ has: page.locator('.ti-chart-line') })
  const graphCount = await graphBtns.count()
  console.log('Graph buttons:', graphCount)

  if (graphCount > 0) {
    await graphBtns.first().click()
    await page.waitForTimeout(1000)
    await shot('03a_graph_open')

    // Find dots via SVG circles with fill="#FFD700" or generic dots
    const svgEl = page.locator('.fixed.top-1\\/2 svg').first()
    const allCircles = await svgEl.locator('circle[fill="transparent"]').all()
    console.log('Transparent hit-target circles:', allCircles.length)

    if (allCircles.length > 0) {
      // Hover the center of the first hit target
      const firstCircle = allCircles[0]
      const box = await firstCircle.boundingBox().catch(() => null)
      if (box) {
        const cx = box.x + box.width / 2
        const cy = box.y + box.height / 2
        await page.mouse.move(cx, cy)
        await page.waitForTimeout(300)
        await shot('03b_hover_dot_center')

        // Check if tooltip text is visible
        const tooltipTexts = await svgEl.locator('text').allTextContents()
        const hasTooltip = tooltipTexts.some(t => t.includes('·') || t.includes('/'))
        console.log('SVG texts after hover:', JSON.stringify(tooltipTexts.slice(0, 8)))
        console.log('FIX 3 PASS (tooltip on dot center):', hasTooltip)
      } else {
        console.log('⚠️ Could not get bounding box of hit target circle')
      }
    } else {
      console.log('⚠️ No transparent hit-target circles found')
    }

    // Verify PR dot pointerEvents="none"
    const prDotsNoPE = await svgEl.locator('circle[fill="#FFD700"]').evaluate(el => el.getAttribute('pointerEvents') || el.style.pointerEvents || 'not set').catch(() => '?')
    console.log('PR dot pointerEvents attribute:', prDotsNoPE)

    // Close graph
    await page.locator('.fixed.top-1\\/2 button').filter({ has: page.locator('.ti-x') }).first().click().catch(() => {})
    await page.waitForTimeout(300)
  }

  // Close drawer
  await page.locator('.fixed.bottom-0 button').filter({ has: page.locator('.ti-x') }).last().click().catch(() => {})
  await page.waitForTimeout(300)
} else {
  console.log('⚠️ No active gym session — skipping FIX 3 graph test')
}

// ─── FIX 5: Transfer test (check state after transfer attempt) ──────────────
console.log('\n=== FIX 5: Transfer — verify state after completion ===')
console.log('(Transfer test requires manual setup — logging behavioral smoke test)')

// Re-check gym card state
const gymStatusFinal = await gymCard.locator('span').filter({ hasText: /Done|Select|Rest/ }).first().textContent().catch(() => '?')
console.log('Final gym status:', gymStatusFinal)

// Verify all 4 gym type buttons are not broken
const wbtns = gymCard.locator('button').filter({ hasText: /^(Push|Pull|Legs|Cardio)/ })
const wbCount = await wbtns.count()
for (let i = 0; i < wbCount; i++) {
  const btn = wbtns.nth(i)
  const text = (await btn.innerText()).split('\n')[0].trim()
  const disabled = await btn.isDisabled()
  console.log(`  ${text}: disabled=${disabled}`)
}
await shot('05_gym_card_state')

// ─── Console errors ──────────────────────────────────────────────────────────
console.log('\n=== Console errors ===')
if (consoleErrors.length === 0) {
  console.log('No console errors ✓')
} else {
  consoleErrors.forEach(e => console.log('ERROR: ' + e))
}

await browser.close()
console.log('\nQA round 3 complete. Screenshots:', SHOTS_DIR)
