import { chromium } from 'playwright';
import { existsSync, mkdirSync } from 'fs';

const SHOTS_DIR = 'C:/Temp/qa_r2b';
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

// ─── Determine active gym workout type ───────────────────────────────────────
const gymCard = page.locator('.relative.overflow-hidden.rounded-xl').filter({ hasText: 'Gym' }).first();
const gymStatusText = await gymCard.locator('span').filter({ hasText: /Done|Select/ }).first().textContent().catch(() => '?');
console.log('Gym card status: "' + gymStatusText + '"');

// Extract active type from status (e.g. "Done — Legs" → "Legs")
const activeMatch = gymStatusText.match(/Done — (\w+)/)
const activeType = activeMatch ? activeMatch[1] : null;
console.log('Active workout type: ' + (activeType || '(none)'));

// ─── FIX 3+4 PART A: Open active drawer → Add should be ENABLED ─────────────
console.log('\n=== FIX 3+4 Part A: Active drawer Add exercise is ENABLED ===');
if (activeType) {
  const activeBtn = gymCard.locator('button').filter({ hasText: new RegExp('^' + activeType) });
  await activeBtn.click();
  await page.waitForTimeout(2500);
  await shot('01_active_drawer_' + activeType.toLowerCase());

  const addBtnActive = page.locator('.fixed.bottom-0 button').filter({ hasText: 'Add exercise' });
  const addDisabled = await addBtnActive.evaluate(el => el.disabled).catch(() => '?');
  const addOpacity = await addBtnActive.evaluate(el => getComputedStyle(el).opacity).catch(() => '?');
  const addCursor = await addBtnActive.evaluate(el => getComputedStyle(el).cursor).catch(() => '?');
  console.log('Active drawer (' + activeType + ') Add exercise:');
  console.log('  disabled=' + addDisabled + ' (expected false)');
  console.log('  opacity=' + addOpacity + ' (expected ~1)');
  console.log('  cursor=' + addCursor + ' (expected pointer)');
  const addEnabledOK = addDisabled === false && parseFloat(addOpacity) > 0.9;
  console.log('  ✅/❌ Add enabled in active drawer: ' + addEnabledOK);

  // ─── FIX 2+6+7+8: Open graph for an exercise ───────────────────────────
  console.log('\n=== FIX 2+6+7+8: Graph in active drawer ===');
  const graphBtns = page.locator('.fixed.bottom-0 button').filter({ has: page.locator('.ti-chart-line') });
  const graphBtnCount = await graphBtns.count();
  console.log('Graph buttons in ' + activeType + ' drawer: ' + graphBtnCount);

  if (graphBtnCount > 0) {
    await graphBtns.first().click();
    await page.waitForTimeout(1200);
    await shot('02_graph_modal');

    // Y-axis label (p tag below exercise name)
    const yLabel = await page.locator('.fixed.top-1\\/2 p').first().textContent().catch(() => '?');
    console.log('Graph y-axis label: "' + yLabel + '"');
    console.log('  No "mini×0.5": ' + !yLabel.includes('mini×0.5') + ' (FIX 2)');

    // PR markers
    const animCount = await page.locator('svg animate').count();
    const polygonCount = await page.locator('svg polygon').count();
    const goldCircles = await page.locator('svg circle[fill="#FFD700"]').count();
    console.log('SVG animate elements (pulse rings): ' + animCount);
    console.log('SVG polygon elements (earlier PR diamonds): ' + polygonCount);
    console.log('Gold circles (latest PR dot): ' + goldCircles);

    // Check PR dot radii
    const prDots = await page.locator('svg circle[fill="#FFD700"]').all();
    for (const dot of prDots) {
      const r = await dot.getAttribute('r').catch(() => '?');
      console.log('  PR dot r=' + r + ' (expected 5)');
    }

    // Y-axis includes 0?
    const svgTexts = await page.locator('svg text').allTextContents();
    const hasZero = svgTexts.some(t => t.trim() === '0');
    console.log('Y-axis starts from 0: ' + hasZero);
    console.log('SVG text labels: ' + JSON.stringify(svgTexts.slice(0, 12)));

    await shot('03_graph_detail');

    // FIX 6: Enable compare mode → PR dots should still appear
    const compareArea = page.locator('text=Compare sets').locator('..').first();
    const toggleDiv = compareArea.locator('div').filter({ has: page.locator('div[style*="position: absolute"]') }).first();
    await toggleDiv.click().catch(async () => {
      // Try clicking the toggle area differently
      const compareRow = page.locator('span:text("Compare sets")').locator('..').first();
      const allDivs = await compareRow.locator('div').all();
      for (const d of allDivs) {
        const bg = await d.evaluate(el => getComputedStyle(el).backgroundColor).catch(() => '');
        if (bg.includes('rgb')) { await d.click(); break; }
      }
    });
    await page.waitForTimeout(600);
    await shot('04_graph_compare_mode');

    const animCompare = await page.locator('svg animate').count();
    const polyCompare = await page.locator('svg polygon').count();
    const goldCompare = await page.locator('svg circle[fill="#FFD700"]').count();
    console.log('\nCompare mode:');
    console.log('  animate: ' + animCompare + ', polygon: ' + polyCompare + ', gold circles: ' + goldCompare);
    const prDotsInCompare = animCompare > 0 || polyCompare > 0 || goldCompare > 0;
    console.log('  PR dots visible in compare mode: ' + prDotsInCompare + ' (FIX 6)');

    // Close graph
    await page.locator('.fixed.top-1\\/2 button').filter({ has: page.locator('.ti-x') }).first().click().catch(() => {});
    await page.waitForTimeout(300);
  }

  // Close active drawer
  await page.locator('.fixed.bottom-0 button').filter({ has: page.locator('.ti-x') }).last().click().catch(() => {});
  await page.waitForTimeout(500);
} else {
  console.log('⚠️ No active workout type today — skipping drawer tests');
}

// ─── FIX 3+4 PART B: Click non-active type → Add DISABLED + selection preserved
console.log('\n=== FIX 3+4 Part B: Non-active drawer Add DISABLED, selection preserved ===');
if (activeType) {
  const workoutBtns = gymCard.locator('button').filter({ hasText: /^(Push|Pull|Legs|Cardio)/ });
  const allBtnTexts = [];
  const count = await workoutBtns.count();
  for (let i = 0; i < count; i++) {
    allBtnTexts.push((await workoutBtns.nth(i).innerText()).split('\n')[0].trim());
  }
  const nonActiveType = allBtnTexts.find(t => t !== activeType);
  console.log('Clicking non-active type: ' + nonActiveType);

  if (nonActiveType) {
    const nonActiveBtn = gymCard.locator('button').filter({ hasText: new RegExp('^' + nonActiveType) });
    await nonActiveBtn.click();
    await page.waitForTimeout(2500);
    await shot('05_nonactive_drawer_' + nonActiveType.toLowerCase());

    const drawerTitle = await page.locator('.fixed.bottom-0 h2').textContent().catch(() => '?');
    console.log('Drawer title: "' + drawerTitle + '"');

    const addBtn = page.locator('.fixed.bottom-0 button').filter({ hasText: 'Add exercise' });
    const addDisabled2 = await addBtn.evaluate(el => el.disabled).catch(() => '?');
    const addOpacity2 = await addBtn.evaluate(el => getComputedStyle(el).opacity).catch(() => '?');
    const addCursor2 = await addBtn.evaluate(el => getComputedStyle(el).cursor).catch(() => '?');
    console.log('Non-active drawer Add exercise:');
    console.log('  disabled=' + addDisabled2 + ' (expected true)');
    console.log('  opacity=' + addOpacity2 + ' (expected 0.5)');
    console.log('  cursor=' + addCursor2 + ' (expected not-allowed)');

    // Check that active type is STILL selected in GymCard (selection NOT changed)
    const statusAfter = await gymCard.locator('span').filter({ hasText: /Done|Select/ }).first().textContent().catch(() => '?');
    console.log('Gym status after clicking non-active: "' + statusAfter + '" (expected "Done — ' + activeType + '")');
    console.log('  Selection preserved: ' + statusAfter.includes(activeType) + ' (FIX 4)');

    // Close
    await page.locator('.fixed.bottom-0 button').filter({ has: page.locator('.ti-x') }).last().click().catch(() => {});
    await page.waitForTimeout(300);
  }
}

// ─── Console errors ──────────────────────────────────────────────────────────
console.log('\n=== Console errors ===');
if (consoleErrors.length === 0) {
  console.log('No console errors ✓');
} else {
  consoleErrors.forEach(e => console.log('ERROR: ' + e));
}

await browser.close();
console.log('\nQA round 2b complete. Screenshots at: ' + SHOTS_DIR);
