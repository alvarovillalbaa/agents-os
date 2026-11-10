import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
const root = process.env.AGENTS_OS_EVAL_ROOT, nonce = process.env.AGENTS_OS_EVAL_NONCE;
const need = (value, message) => { if (!value) throw new Error(message); };
need(root && nonce && fs.readFileSync(path.join(root, '.owner'), 'utf8') === nonce, 'owned_mission_browser');
const { chromium } = createRequire(path.join(process.env.AGENTS_OS_TOOLS, 'package.json'))('playwright');
const state = JSON.parse(fs.readFileSync(path.join(root, 'missions-state.json'))), output = path.join(root, 'output'), origin = 'http://127.0.0.1:4315';
const prefix = '/api/plugins/alvarovillalbaa.agents-os/api', url = origin + '/' + state.company.issuePrefix + '/missions';
const report = { sourceCommit: process.env.SOURCE_COMMIT, passed: false, cases: [], errors: [], browserClosed: false }; let browser;
const hash = raw => createHash('sha256').update(raw).digest('hex');
const mission = page => page.getByRole('region', { name: 'Missions', exact: true });
const workspace = page => mission(page).getByRole('region', { name: 'Mission workspace', exact: true });
const plan = page => workspace(page).getByRole('form', { name: 'Mission plan', exact: true });
const checkpoint = (page, n) => workspace(page).getByRole('region', { name: 'Checkpoint ' + n, exact: true });
const activity = new WeakMap();
function save(name, value) { const raw = Buffer.isBuffer(value) ? value : Buffer.from(typeof value === 'string' ? value : JSON.stringify(value, null, 2) + '\n'); need(raw.length <= 2 * 1024 * 1024, 'mission_browser_capture_bound'); fs.writeFileSync(path.join(output, name), raw, { flag: 'wx' }); }
async function settle(page) {
  const data = activity.get(page); need(data, 'observed_mission_page'); const start = Date.now();
  while (Date.now() - start < 30_000) { if (!data.pending.size && Date.now() - Math.max(data.changedAt, start) >= 500) { data.row.settlements.push({ url: page.url(), elapsedMs: Date.now() - start, pending: 0 }); return; } await new Promise(done => setTimeout(done, 50)); }
  throw new Error('mission_page_did_not_settle');
}
async function open(page) { await page.goto(url, { waitUntil: 'domcontentloaded' }); await mission(page).getByRole('heading', { name: 'Missions', exact: true }).waitFor(); await settle(page); }
async function select(page, title) {
  await mission(page).getByLabel('Search Missions', { exact: true }).fill(title); await mission(page).getByRole('button', { name: 'Search', exact: true }).click(); await settle(page);
  await mission(page).getByRole('button', { name: new RegExp(title) }).first().click(); await workspace(page).getByRole('heading', { name: title, exact: true }).waitFor(); await settle(page);
}
async function fill(page, title, count = 1) {
  await mission(page).getByRole('button', { name: 'New Mission', exact: true }).click(); await plan(page).getByLabel('Mission title', { exact: true }).fill(title);
  await plan(page).getByLabel('Objective', { exact: true }).fill('An authored Mission objective with retained evidence.');
  for (let n = 1; n <= count; n++) {
    if (n > 1) await plan(page).getByRole('button', { name: 'Add checkpoint', exact: true }).click();
    await plan(page).getByLabel(`Checkpoint ${n} title`, { exact: true }).fill('Browser checkpoint ' + n);
    await plan(page).getByLabel(`Checkpoint ${n} criteria`, { exact: true }).fill('Review the authored Task result for checkpoint ' + n);
    await plan(page).getByLabel(`Checkpoint ${n} Task`, { exact: true }).selectOption(state.browserTasks[n - 1].id);
  }
  await settle(page);
}
async function mutate(page, action, suffix, status = 200) {
  await settle(page); const observed = page.waitForResponse(response => new URL(response.url()).pathname === prefix + suffix && response.request().method() === 'POST');
  await action(); const response = await observed; need(response.status() === status, 'mission_actual_ui_status'); const result = await response.json();
  if (status < 400) { await mission(page).getByText(/Mission saved\.|Saved Mission operation confirmed\./).first().waitFor(); await settle(page); }
  return result;
}
const note = (page, value) => workspace(page).getByLabel('Evidence or reason', { exact: true }).fill(value);
async function capture(row, page, label, png = false) {
  await settle(page); await mission(page).scrollIntoViewIfNeeded(); await page.evaluate(() => document.querySelector('.aos-missions')?.scrollIntoView({ block: 'start' }));
  const geometry = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth, body: document.body.scrollWidth })); need(geometry.scroll <= row.width + 1 && geometry.body <= row.width + 1, 'mission_overflow');
  const name = 'missions-' + row.id.toLowerCase() + '-' + label; save(name + '.dom.json', { url: page.url(), geometry, html: await page.content() });
  if (png) { const raw = await page.screenshot({ fullPage: false }); need(raw.length <= 1024 * 1024, 'mission_png_bound'); save(name + '.png', raw); }
  row.captures.push({ label, dom: name + '.dom.json', png: png ? name + '.png' : null, geometry });
}
async function context(row) {
  const ctx = await browser.newContext({ viewport: { width: row.width, height: 900 } });
  ctx.on('page', page => {
    const data = { pending: new Set(), changedAt: Date.now(), row }; activity.set(page, data);
    page.on('request', request => { data.pending.add(request); data.changedAt = Date.now(); });
    const finish = request => { data.pending.delete(request); data.changedAt = Date.now(); }; page.on('requestfinished', finish); page.on('requestfailed', finish);
    page.on('pageerror', error => row.errors.push('page: ' + error.message));
    page.on('requestfailed', request => { const entry = { method: request.method(), url: request.url(), error: request.failure()?.errorText };
      if (row.expectedAbort && entry.method === 'POST' && new URL(entry.url).pathname === prefix + '/missions') row.expectedFailures.push(entry); else row.errors.push('request: ' + entry.url + ': ' + entry.error); });
    page.on('response', response => { if (response.status() < 400) return; const entry = { status: response.status(), method: response.request().method(), url: response.url() };
      if (row.expectedConflict && entry.status === 409 && entry.method === 'POST' && new URL(entry.url).pathname === prefix + '/missions/' + row.missionId + '/commands') row.expectedFailures.push(entry); else row.errors.push('http: ' + entry.status + ': ' + entry.url); });
    page.on('dialog', dialog => { void dialog.accept(); });
  });
  await ctx.route('**/*', async route => { row.requests.push({ method: route.request().method(), url: route.request().url() }); if (!route.request().url().startsWith(origin + '/') && !route.request().url().startsWith('data:')) { row.errors.push('external_origin'); await route.abort(); } else await route.continue(); });
  return ctx;
}
async function run(id, width, count, fn) {
  const row = { id, width, passed: false, captures: [], requests: [], settlements: [], expectedFailures: [], errors: [], contextsClosed: 0 }; report.cases.push(row); const contexts = [];
  try { for (let n = 0; n < count; n++) contexts.push(await context(row)); await fn(row, contexts); need(!row.errors.length && row.captures.length === 2, 'actual_mission_browser_profile'); row.passed = true; }
  catch (error) { row.errors.push(String(error.stack ?? error)); for (const [index, ctx] of contexts.entries()) for (const page of ctx.pages()) { try { save(`missions-${id.toLowerCase()}-failed-${index}.html`, await page.content()); } catch {} } throw error; }
  finally { for (const ctx of contexts) { await ctx.close(); row.contextsClosed++; } }
}
try {
  browser = await chromium.launch({ headless: true }); report.version = browser.version();
  await run('MB01', 1280, 1, async (row, [ctx]) => {
    const page = await ctx.newPage(); await open(page); await fill(page, 'Browser Desktop Mission', 2);
    let result = await mutate(page, () => plan(page).getByRole('button', { name: 'Save Mission plan', exact: true }).click(), '/missions', 201);
    const id = result.mission.id; row.missionId = id; const suffix = '/missions/' + id + '/commands';
    await mutate(page, () => workspace(page).getByRole('button', { name: 'Start Mission', exact: true }).click(), suffix);
    for (let n = 1; n <= 2; n++) { await note(page, 'Authored browser checkpoint evidence ' + n); await mutate(page, () => checkpoint(page, n).getByRole('button', { name: 'Approve checkpoint', exact: true }).click(), suffix); }
    await note(page, 'Authored final browser Mission evidence.'); result = await mutate(page, () => workspace(page).getByRole('button', { name: 'Complete Mission', exact: true }).click(), suffix);
    need(result.mission.phase === 'completed' && result.approvedCount === 2, 'actual_ui_explicit_completion'); await capture(row, page, 'completed', true);
    await page.reload({ waitUntil: 'domcontentloaded' }); await workspace(page).getByRole('heading', { name: 'Completion evidence', exact: true }).waitFor(); await settle(page);
    need(await workspace(page).getByText('Authored final browser Mission evidence.', { exact: true }).count() >= 1, 'completed_mission_reload');
    const before = page.url(); await checkpoint(page, 1).getByRole('link').click(); await page.waitForURL(url => url.pathname.includes('/issues/')); await page.locator('main').getByText(state.browserTasks[0].title, { exact: true }).first().waitFor(); await settle(page);
    row.navigation = { followed: page.url() }; await page.goBack({ waitUntil: 'domcontentloaded' }); await workspace(page).getByRole('heading', { name: 'Browser Desktop Mission', exact: true }).waitFor(); await settle(page); need(page.url() === before, 'native_mission_task_back'); row.navigation.returned = page.url(); await capture(row, page, 'reloaded');
  });
  await run('MB02', 390, 1, async (row, [ctx]) => {
    const page = await ctx.newPage(); await open(page); const longName = 'Mission Narrow ' + 'N'.repeat(105); need(longName.length === 120, 'mission_long_name_fixture'); await fill(page, longName);
    let result = await mutate(page, () => plan(page).getByRole('button', { name: 'Save Mission plan', exact: true }).click(), '/missions', 201); row.missionId = result.mission.id; const suffix = '/missions/' + row.missionId + '/commands';
    await mutate(page, () => workspace(page).getByRole('button', { name: 'Start Mission', exact: true }).click(), suffix); await note(page, 'Hold the narrow Mission for review.');
    await mutate(page, () => workspace(page).getByRole('button', { name: 'Pause Mission', exact: true }).click(), suffix); await capture(row, page, 'paused', true);
    await page.reload({ waitUntil: 'domcontentloaded' }); await workspace(page).getByText('Hold the narrow Mission for review.', { exact: true }).first().waitFor(); await settle(page);
    await mutate(page, () => workspace(page).getByRole('button', { name: 'Resume Mission', exact: true }).click(), suffix); await note(page, 'Cancel authored narrow work.');
    result = await mutate(page, () => workspace(page).getByRole('button', { name: 'Cancel Mission', exact: true }).click(), suffix); need(result.mission.phase === 'cancelled', 'narrow_cancel');
    await note(page, 'Reopen authored narrow work.'); result = await mutate(page, () => checkpoint(page, 1).getByRole('button', { name: 'Reopen from here', exact: true }).click(), suffix);
    need(result.mission.phase === 'paused' && result.mission.title === longName, 'narrow_reopen'); await capture(row, page, 'reopened');
  });
  await run('MB03', 1280, 2, async (row, [first, second]) => {
    const a = await first.newPage(), b = await second.newPage(); await open(a); await open(b); await select(a, 'Browser Conflict Mission'); await select(b, 'Browser Conflict Mission'); row.missionId = state.conflictMissionId;
    for (const page of [a, b]) { await workspace(page).getByRole('button', { name: 'Edit plan', exact: true }).click(); await plan(page).getByLabel('Objective', { exact: true }).waitFor(); await settle(page); }
    await plan(a).getByLabel('Objective', { exact: true }).fill('First editor keeps this authored objective.'); await plan(b).getByLabel('Objective', { exact: true }).fill('Second editor saved this authored objective.');
    const suffix = '/missions/' + row.missionId + '/commands'; await mutate(b, () => plan(b).getByRole('button', { name: 'Save Mission plan', exact: true }).click(), suffix); row.expectedConflict = true;
    await mutate(a, () => plan(a).getByRole('button', { name: 'Save Mission plan', exact: true }).click(), suffix, 409); await mission(a).getByRole('alert').filter({ hasText: /changed elsewhere/ }).waitFor();
    need(await plan(a).getByLabel('Objective', { exact: true }).inputValue() === 'First editor keeps this authored objective.', 'mission_stale_draft_kept'); await capture(row, a, 'conflict', true);
    await mission(a).getByRole('button', { name: 'Load saved Mission', exact: true }).click(); await workspace(a).getByText('Second editor saved this authored objective.', { exact: true }).waitFor(); await capture(row, a, 'saved-version');
    need(row.expectedFailures.filter(entry => entry.status === 409).length === 1, 'one_expected_mission_conflict');
  });
  await run('MB04', 1280, 1, async (row, [ctx]) => {
    const page = await ctx.newPage(); await open(page); await fill(page, 'Browser Mission Lost Response'); const attempts = []; let committed;
    await page.route('**/api/plugins/alvarovillalbaa.agents-os/api/missions?*', async route => {
      if (route.request().method() !== 'POST') { await route.fallback(); return; } const body = route.request().postData(); need(JSON.parse(body).plan.title === 'Browser Mission Lost Response', 'owned_mission_lost_reply'); attempts.push(body);
      if (attempts.length === 1) { const actual = await route.fetch(); need(actual.status() === 201, 'mission_committed_before_reply_loss'); const raw = await actual.body(); committed = JSON.parse(raw); save('missions-mb04-committed-response.json', raw); row.committedResponse = { status: actual.status(), bytes: raw.length, sha256: hash(raw) }; row.expectedAbort = true; await route.abort('failed'); }
      else await route.continue();
    });
    await plan(page).getByRole('button', { name: 'Save Mission plan', exact: true }).click(); await mission(page).getByRole('alert').filter({ hasText: /Could not confirm/ }).waitFor(); await capture(row, page, 'uncertain', true);
    await page.reload({ waitUntil: 'domcontentloaded' }); await mission(page).getByText('Mission draft restored for this company.', { exact: true }).waitFor(); need(await plan(page).getByLabel('Mission title', { exact: true }).inputValue() === 'Browser Mission Lost Response', 'mission_pending_plan_reload'); await settle(page);
    const observed = page.waitForResponse(response => new URL(response.url()).pathname === prefix + '/missions' && response.request().method() === 'POST'); await mission(page).getByRole('button', { name: 'Retry Mission operation', exact: true }).click();
    const replay = await observed, actual = await replay.json(); need(replay.status() === 201 && actual.replayed && actual.mission.id === committed.mission.id && actual.mission.revision === 1 && attempts.length === 2 && attempts[0] === attempts[1], 'mission_exact_replay_without_duplicate');
    row.replay = { sameRequestBytes: true, attempts: 2, missionId: actual.mission.id, revision: actual.mission.revision }; row.missionId = actual.mission.id;
    await mission(page).getByText('Saved Mission operation confirmed.', { exact: true }).waitFor(); await capture(row, page, 'confirmed'); need(row.expectedFailures.filter(entry => entry.error).length === 1, 'one_expected_mission_reply_loss');
  });
  report.passed = report.cases.length === 4 && report.cases.every(row => row.passed && !row.errors.length && row.contextsClosed === (row.id === 'MB03' ? 2 : 1));
} catch (error) { report.errors.push(String(error.stack ?? error)); }
finally { if (browser) { await browser.close(); report.browserClosed = true; } save('missions-browser.json', report); }
if (!report.passed || !report.browserClosed) process.exitCode = 1;
