// Browser test for the VDP33 editor and manual (Playwright + system Chrome).
//   node tests/web_test.mjs [--shots]
// Needs: playwright, google-chrome, and /tmp/vdp33_preset_states.json (written by scripts/test.sh).
import { createRequire } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SHOTS = process.argv.includes('--shots');
const STATES = process.env.VDP_STATES || '/tmp/vdp33_preset_states.json';
let fails = 0;
const ok = (c, m) => { console.log((c ? '  [ok] ' : '  [FAIL] ') + m); if (!c) fails++; };
const browser = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', args: ['--no-sandbox'] });

async function open(file, { mock, query = '', w = 1280, h = 900 } = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error' && !/net::|fonts\.g|schwung-remote-api/.test(m.text())) errs.push(m.text()); });
  if (mock) await page.addInitScript(() => {
    window.__sent = []; window.__cb = null; window.__resub = 0;
    window.schwungRemote = { component: 'synth', setParam: (k, v) => window.__sent.push([k, v]),
      onParamChange: (f) => { window.__cb = f; }, resubscribe: () => { window.__resub++; } };
  });
  await page.route('**/*', (r) => { const u = r.request().url(); return /^(file|data|blob):/.test(u) ? r.continue() : r.abort(); });
  await page.goto(pathToFileURL(path.join(ROOT, file)).href + query);
  await page.waitForTimeout(400);
  return { page, ctx, errs };
}

console.log('1. Demo mode');
{
  const { page, ctx, errs } = await open('src/web/web_ui.html');
  ok(await page.evaluate(() => window.vdpEditor.mode) === 'demo', 'no schwungRemote: demo mode');
  const n = await page.evaluate(() => Object.keys(window.vdpEditor.D).length);
  ok(n === 51, '51 parameters in the page (' + n + ')');
  ok(await page.locator('#preset option').count() === 24, '24 presets in the list');
  ok(await page.locator('#where').getAttribute('data-state') === 'demo', 'demo badge');
  ok(await page.locator('.knob,.fader,.tabl button,.seg,.step').count() >= 40, 'controls rendered');
  ok(errs.length === 0, 'no JavaScript errors ' + JSON.stringify(errs));
  // interaction: tablet, segmented, stepper, fader keyboard
  await page.locator('#p-vocoder .tabl button').click();
  ok(await page.evaluate(() => window.vdpEditor.P.ens_voc) === 1, 'tablet toggles ens_voc');
  await page.locator('#p-organ .seg').nth(1).locator('button', { hasText: 'II Bright' }).click();
  ok(await page.evaluate(() => window.vdpEditor.P.org_tone) === 1, 'segmented: organ tone II');
  await page.locator('#p-keys .step button').nth(1).click();
  ok(await page.evaluate(() => window.vdpEditor.P.split) === 61, 'stepper raises split to 61');
  const f = page.locator('#p-balance .fader').first();
  await f.focus(); for (let i = 0; i < 5; i++) await page.keyboard.press('ArrowUp');
  ok(Math.abs(await page.evaluate(() => window.vdpEditor.P.lvl_str) - 0.05) < 1e-6, 'fader arrow keys: +5%');
  await f.dblclick();
  ok(await page.evaluate(() => window.vdpEditor.P.lvl_str) === 0, 'double-click resets to default');
  const kn = page.locator('#p-vibrato .knob').first();
  await kn.scrollIntoViewIfNeeded();
  const bb = await kn.boundingBox();
  await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2); await page.mouse.down();
  await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2 - 40, { steps: 5 }); await page.mouse.up();
  ok(await page.evaluate(() => window.vdpEditor.P.vib_rate) > 0.5, 'dragging a knob up raises it');
  await page.locator('#pNext').click();
  ok(await page.evaluate(() => window.vdpEditor.preset) === 1, 'next preset');
  await page.locator('#pPrev').click(); await page.locator('#pPrev').click();
  ok(await page.evaluate(() => window.vdpEditor.preset) === 23, 'previous wraps to 23');
  // envelope picture follows the mode
  await page.locator('#p-envelope .seg button', { hasText: 'II Hold' }).click();
  await page.waitForTimeout(150);
  ok((await page.locator('#envNote').textContent()).startsWith('II Hold'), 'envelope note follows Release mode');
  if (SHOTS) { fs.mkdirSync(path.join(ROOT, 'docs/screens'), { recursive: true }); await page.goto(pathToFileURL(path.join(ROOT, 'src/web/web_ui.html')).href); await page.waitForTimeout(500); await page.screenshot({ path: path.join(ROOT, 'docs/screens/editor.png'), fullPage: true }); }
  await ctx.close();
}

console.log('2. Preset parity with the C engine');
{
  const { page, ctx } = await open('src/web/web_ui.html');
  if (!fs.existsSync(STATES)) ok(false, STATES + ' missing: run scripts/test.sh first');
  else {
    const states = JSON.parse(fs.readFileSync(STATES, 'utf8'));
    let bad = [];
    for (const s of states) {
      const r = await page.evaluate((s) => {
        const E = window.vdpEditor, out = [];
        for (const k in E.P) E.P[k] = E.D[k].default;
        E.applyPreset(s.preset);
        for (const k in s) { if (k === 'preset') continue; if (!E.D[k]) { out.push('unknown ' + k); continue; }
          if (Math.abs(E.P[k] - s[k]) > 1e-3) out.push(k + ' js=' + E.P[k] + ' c=' + s[k]); }
        return out;
      }, s);
      if (r.length) bad.push('#' + s.preset + ': ' + r.slice(0, 3).join('; '));
    }
    ok(states.length === 24, states.length + ' preset states from the engine');
    ok(bad.length === 0, 'editor applyPreset equals apply_preset() for every preset ' + bad.slice(0, 3).join(' | '));
  }
  await ctx.close();
}

console.log('3. Chain mode (mocked Schwung remote)');
{
  const { page, ctx, errs } = await open('src/web/web_ui.html', { mock: true });
  ok(await page.evaluate(() => window.vdpEditor.mode) === 'chain', 'chain mode');
  ok(await page.locator('#where').getAttribute('data-state') === 'wait', 'waits for data');
  await page.evaluate(() => window.__cb({ 'synth:volume': '0.5', 'synth:lvl_org': '0.7', 'synth:preset': '19', 'other:volume': '0.1', 'synth:zone_org': '3' }));
  await page.waitForTimeout(200);
  const st = await page.evaluate(() => ({ v: window.vdpEditor.P.volume, o: window.vdpEditor.P.lvl_org, p: window.vdpEditor.preset, z: window.vdpEditor.P.zone_org }));
  ok(st.v === 0.5 && st.o === 0.7 && st.p === 19 && st.z === 3, 'incoming parameters applied, other components ignored');
  ok(await page.locator('#where').getAttribute('data-state') === 'live', 'badge turns live');
  ok(await page.locator('#preset').inputValue() === '19', 'preset select follows the Move');
  await page.locator('#p-vocoder .tabl button').click();
  await page.locator('#p-organ .seg').nth(1).locator('button', { hasText: 'II Bright' }).click();
  await page.locator('#pNext').click();
  await page.waitForTimeout(100);
  const sent = await page.evaluate(() => window.__sent);
  ok(sent.some(([k, v]) => k === 'synth:ens_voc' && v === '1'), 'tablet sends synth:ens_voc=1');
  ok(sent.some(([k, v]) => k === 'synth:org_tone' && v === '1'), 'segmented sends synth:org_tone=1');
  ok(sent.some(([k, v]) => k === 'synth:preset' && v === '20'), 'preset change sends synth:preset=20');
  ok(sent.every(([k]) => k.startsWith('synth:')), 'every message carries the component prefix');
  // a value from the Move right after a local edit must not fight the user
  await page.evaluate(() => { window.vdpEditor.send('volume', 0.9); window.__cb({ 'synth:volume': '0.1' }); });
  ok(await page.evaluate(() => window.vdpEditor.P.volume) === 0.9, 'echo right after an edit is ignored');
  await page.waitForTimeout(600);
  await page.evaluate(() => window.__cb({ 'synth:volume': '0.1' }));
  ok(await page.evaluate(() => window.vdpEditor.P.volume) === 0.1, 'later Move change is applied');
  // drag rate limiting: many moves, few messages
  await page.evaluate(() => { window.__sent.length = 0; for (let i = 0; i < 100; i++) window.vdpEditor.send('tone', i / 100); });
  ok(await page.evaluate(() => window.__sent.length) < 10, 'rapid edits are rate limited');
  ok(errs.length === 0, 'no JavaScript errors ' + JSON.stringify(errs));
  await ctx.close();
}

console.log('4. Chain mode: resubscribe when silent');
{
  const { page, ctx } = await open('src/web/web_ui.html', { mock: true });
  await page.waitForTimeout(1800);
  ok(await page.evaluate(() => window.__resub) >= 1, 'asks again for values after 1.5 s');
  await ctx.close();
}

console.log('5. Small screen');
{
  const { page, ctx, errs } = await open('src/web/web_ui.html', { w: 390, h: 800 });
  const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  ok(over <= 2, 'no horizontal overflow at 390 px (' + over + ')');
  ok(errs.length === 0, 'no JavaScript errors');
  await ctx.close();
}

console.log('6. Manual and demo copy');
{
  const { page, ctx, errs } = await open('docs/index.html');
  ok(await page.locator('.presets li').count() === 24, 'manual lists 24 presets');
  ok(await page.locator('#reference tbody tr:not(.tr-grp)').count() >= 51, 'reference table has every parameter');
  ok(await page.locator('#reference tbody tr').count() >= 51, 'reference rows present');
  const links = await page.$$eval('a[href^="#"]', (as) => as.map((a) => a.getAttribute('href')));
  let miss = []; for (const l of links) if (!(await page.locator(l).count())) miss.push(l);
  ok(miss.length === 0, 'anchor links resolve ' + miss);
  ok(errs.length === 0, 'no JavaScript errors ' + JSON.stringify(errs));
  if (SHOTS) await page.screenshot({ path: path.join(ROOT, 'docs/screens/manual.png'), fullPage: false });
  await ctx.close();
  const a = fs.readFileSync(path.join(ROOT, 'src/web/web_ui.html'), 'utf8'), b = fs.readFileSync(path.join(ROOT, 'docs/editor.html'), 'utf8');
  ok(a === b, 'docs/editor.html is identical to src/web/web_ui.html');
}
await browser.close();
console.log(fails ? '\nFAILED: ' + fails : '\nALL OK');
process.exit(fails ? 1 : 0);
