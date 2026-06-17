import { chromium } from 'playwright';
import { existsSync, mkdirSync } from 'fs';

const SHOTS_DIR = 'C:/Temp/qa_r2';
if (!existsSync(SHOTS_DIR)) mkdirSync(SHOTS_DIR, { recursive: true });

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();

const consoleErrors = [];
page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });

const shot = async name => {
  await page.screenshot({ path: `${SHOTS_DIR}/${name}.png` });
  console.log('📸 ' + name);
};

await page.goto('http://localhost:5174', { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(2000);
await shot('00_page_load');

// ─── FIX 1: Japanese subtask streaks always show ────────────────────────────
console.log('\n=== FIX 1: Japanese subtask streak display ===');
// Find the Japanese card (has "Japanese" title text)
const japCard = page.locator('.relative.overflow-hidden.rounded-xl').filter({ hasText: 'Japanese' });
const subtaskRows = japCard.locator('.flex.items-center.justify-between').filter({ has: page.locator('input[type="checkbox"]') });
const rowCount = await subtaskRows.count();
console.log('Subtask rows found: ' + rowCount + ' (expected 3)');

let dashCount = 0, flameCount = 0;
for (let i = 0; i < rowCount; i++) {
  const row = subtaskRows.nth(i);
  const label = await row.locator('span').first().textContent().catch(() => '?');
  const hasDash = await row.locator('span:text("—")').isVisible().catch(() => false);
  const hasFlame = await row.locator('.ti-flame').isVisible().catch(() => false);
  const streakNum = await row.locator('.font-mono').textContent().catch(() => '?');
  if (hasDash) dashCount++;
  if (hasFlame) flameCount++;
  console.log(`  Row "${label.trim()}": dash=${hasDash}, flame=${hasFlame}, streak="${streakNum}"`);
}
console.log('Dash ("—") count: ' + dashCount + ' (expected 0)');
console.log('Flame icon count: ' + flameCount + ' (expected ' + rowCount + ')');
await shot('01_japanese_subtask_streaks');

// ─── FIX 3+4: Gym view-only drawer when exercises logged ────────────────────
console.log('\n=== FIX 3+4: Gym view-only drawer ===');
// Open Push drawer first
const gymCard = page.locator('.relative.overflow-hidden.rounded-xl').filter({ hasText: 'Gym' }).first();
const pushBtn = gymCard.locator('button').filter({ hasText: /^Push/ });
await pushBtn.click();
await page.waitForTimeout(2500);
await shot('02_push_drawer_open');

const drawerVisible = await page.locator('.fixed.bottom-0').isVisible().catch(() => false);
console.log('Push drawer opened: ' + drawerVisible);

// Check if there are exercises in this drawer
const exerciseCards = page.locator('.fixed.bottom-0 div').filter({ has: page.locator('button:has(.ti-chart-line)') });
const exCount = await exerciseCards.count();
console.log('Exercise cards in Push drawer: ' + exCount);

// Check Add exercise button state
const addExBtn = page.locator('.fixed.bottom-0 button').filter({ hasText: 'Add exercise' });
const addDisabledInPush = await addExBtn.evaluate(el => el.disabled || el.style.opacity === '0.5').catch(() => false);
const addOpacity = await addExBtn.evaluate(el => getComputedStyle(el).opacity).catch(() => '?');
console.log('Add exercise in Push drawer: disabled=' + addDisabledInPush + ', opacity=' + addOpacity + ' (should be ~1 — active drawer)');

// Close drawer
await page.locator('.fixed.bottom-0 button').filter({ has: page.locator('.ti-x') }).click().catch(() => {});
await page.waitForTimeout(500);

// Now: Push was selected. Click Pull — if Push has exercise logs, should open Pull in view-only
// (If Push has no logs, it will change selection normally)
const pullBtn = gymCard.locator('button').filter({ hasText: /^Pull/ });
await pullBtn.click();
await page.waitForTimeout(2500);
await shot('03_pull_drawer_after_push_selected');

const pullDrawerVisible = await page.locator('.fixed.bottom-0').isVisible().catch(() => false);
console.log('Pull drawer opened: ' + pullDrawerVisible);

// Check GymCard selected state (is Push still shown as active in card?)
const gymStatusText = await gymCard.locator('span').filter({ hasText: /Done|Select/ }).first().textContent().catch(() => '?');
console.log('Gym card status text: "' + gymStatusText + '"');

if (pullDrawerVisible) {
  const addExInPull = page.locator('.fixed.bottom-0 button').filter({ hasText: 'Add exercise' });
  const addOpacityPull = await addExInPull.evaluate(el => getComputedStyle(el).opacity).catch(() => '?');
  const addDisabledPull = await addExInPull.evaluate(el => el.disabled).catch(() => false);
  const addCursorPull = await addExInPull.evaluate(el => getComputedStyle(el).cursor).catch(() => '?');
  console.log('Add exercise in Pull drawer: disabled=' + addDisabledPull + ', opacity=' + addOpacityPull + ', cursor=' + addCursorPull);
  console.log('(If Push had exercise logs: disabled=true, opacity=0.5, cursor=not-allowed)');
  console.log('(If Push had no exercise logs: disabled=false, opacity=1 — normal type switch)');
  await shot('04_pull_drawer_add_exercise_state');
}

// Close
await page.locator('.fixed.bottom-0 button').filter({ has: page.locator('.ti-x') }).click().catch(() => {});
await page.waitForTimeout(500);

// ─── FIX 2: Cable weight formula + FIX 6/7/8: PR dots ──────────────────────
console.log('\n=== FIX 2+6+7+8: Graph — cable kg + PR dots ===');
// Re-open Push drawer to find a barbell/cable exercise with graph
const pushBtn2 = gymCard.locator('button').filter({ hasText: /^Push/ });
await pushBtn2.click();
await page.waitForTimeout(2500);

const graphBtns = page.locator('.fixed.bottom-0 button').filter({ has: page.locator('.ti-chart-line') });
const graphBtnCount = await graphBtns.count();
console.log('Graph buttons in drawer: ' + graphBtnCount);

if (graphBtnCount > 0) {
  await graphBtns.first().click();
  await page.waitForTimeout(1200);
  await shot('05_graph_modal');

  // Y-axis label
  const yLabel = await page.locator('.fixed.top-1\\/2 p').first().textContent().catch(() => '?');
  console.log('Y-axis label: "' + yLabel + '"');
  const isCableKgLabel = yLabel.includes('Resistance (kg)') || !yLabel.includes('mini×0.5');
  console.log('Cable label correct (no "mini×0.5"): ' + isCableKgLabel);

  // SVG <animate> elements (PR pulse rings)
  const animElems = await page.locator('svg animate').count();
  console.log('SVG <animate> elements (PR pulse rings): ' + animElems);

  // All SVG <polygon> elements (earlier PR diamonds)
  const polygonCount = await page.locator('svg polygon').count();
  console.log('SVG <polygon> elements (earlier PR diamonds): ' + polygonCount);

  // Count gold circles (latest PR pulsing dot)
  const goldCircles = await page.locator('svg circle[fill="#FFD700"]').count();
  console.log('Gold circles (latest PR dot): ' + goldCircles);

  // Check PR dot radius — should be 5, not 8
  const prCircles = await page.locator('svg circle[fill="#FFD700"]').all();
  for (const c of prCircles) {
    const r = await c.getAttribute('r').catch(() => '?');
    console.log('  PR circle r=' + r + ' (expected 5 or 6 on hover)');
  }

  // Toggle compare mode and check PR dots still exist
  const compareToggle = page.locator('svg + div, div:has(> span:text("Compare sets"))').first();
  const compareArea = page.locator('text=Compare sets').locator('..');
  const toggleBtn = compareArea.locator('div[style*="border-radius: 12px"]').first();
  await toggleBtn.click().catch(() => {});
  await page.waitForTimeout(600);
  await shot('06_graph_compare_mode');

  const animElemsCompare = await page.locator('svg animate').count();
  const polygonCountCompare = await page.locator('svg polygon').count();
  const goldCirclesCompare = await page.locator('svg circle[fill="#FFD700"]').count();
  console.log('\nCompare mode ON:');
  console.log('  <animate> elements: ' + animElemsCompare + ' (PR pulse rings)');
  console.log('  <polygon> elements: ' + polygonCountCompare + ' (earlier PR diamonds)');
  console.log('  Gold circles: ' + goldCirclesCompare + ' (latest PR dot)');
  console.log('  PR dots visible in compare mode: ' + (animElemsCompare > 0 || goldCirclesCompare > 0 || polygonCountCompare > 0));

  // X-axis and y-axis labels
  const svgTexts = await page.locator('svg text').allTextContents();
  const hasZero = svgTexts.some(t => t.trim() === '0');
  console.log('\nSVG text labels (first 15): ' + JSON.stringify(svgTexts.slice(0, 15)));
  console.log('Y-axis includes 0: ' + hasZero);

  await page.locator('.fixed.top-1\\/2 button').filter({ has: page.locator('.ti-x') }).click().catch(() => {});
  await page.waitForTimeout(300);
}

// Close drawer
await page.locator('.fixed.bottom-0 button').filter({ has: page.locator('.ti-x') }).last().click().catch(() => {});
await page.waitForTimeout(300);

// ─── FIX 1 probe: Japanese streak before logging (historical values) ────────
console.log('\n=== Probe: Japanese streaks show historical non-zero values ===');
const japCardAgain = page.locator('.relative.overflow-hidden.rounded-xl').filter({ hasText: 'Japanese' });
const streakNums = await japCardAgain.locator('.font-mono').allTextContents();
console.log('All font-mono values in Japanese card: ' + JSON.stringify(streakNums));
const subtaskStreakNums = streakNums.filter(t => !isNaN(parseInt(t)));
console.log('Streak numbers: ' + JSON.stringify(subtaskStreakNums));
const anyNonZeroSubstreak = subtaskStreakNums.some(n => parseInt(n) > 0);
console.log('At least one non-zero subtask streak: ' + anyNonZeroSubstreak + ' (shows historical data)');

// ─── Probe: all 4 gym buttons clickable ─────────────────────────────────────
console.log('\n=== Probe: All 4 gym workout buttons enabled ===');
const gymCard2 = page.locator('.relative.overflow-hidden.rounded-xl').filter({ hasText: 'Gym' }).first();
const workoutBtns = gymCard2.locator('button').filter({ hasText: /^(Push|Pull|Legs|Cardio)/ });
const wbCount = await workoutBtns.count();
console.log('Workout type buttons: ' + wbCount + ' (expected 4)');
for (let i = 0; i < wbCount; i++) {
  const btn = workoutBtns.nth(i);
  const text = (await btn.innerText()).split('\n')[0].trim();
  const disabled = await btn.isDisabled();
  const opacity = await btn.evaluate(el => getComputedStyle(el).opacity);
  console.log('  "' + text + '": disabled=' + disabled + ', opacity=' + opacity);
}

// ─── Console errors ──────────────────────────────────────────────────────────
console.log('\n=== Console errors ===');
if (consoleErrors.length === 0) {
  console.log('No console errors ✓');
} else {
  consoleErrors.forEach(e => console.log('ERROR: ' + e));
}

await browser.close();
console.log('\nQA round 2 complete. Screenshots at: ' + SHOTS_DIR);
