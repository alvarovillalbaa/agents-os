import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
const root = process.env.AGENTS_OS_EVAL_ROOT, nonce = process.env.AGENTS_OS_EVAL_NONCE;
const need = (value, message) => { if (!value) throw new Error(message); };
need(root && nonce && fs.readFileSync(path.join(root, '.owner'), 'utf8') === nonce, 'owned_browser_fixture_required');
const { chromium } = createRequire(path.join(process.env.AGENTS_OS_TOOLS, 'package.json'))('playwright');
const output = path.join(root, 'output'), state = JSON.parse(fs.readFileSync(path.join(root, 'crm-state.json'))), origin = 'http://127.0.0.1:4315';
const prefix = '/api/plugins/alvarovillalbaa.agents-os/api', pageUrl = origin + '/' + state.company.issuePrefix + '/crm';
const report = { sourceCommit: process.env.SOURCE_COMMIT, passed: false, cases: [], errors: [], browserClosed: false }; let browser;
const hash = body => createHash('sha256').update(body).digest('hex');
function save(name, raw) { const body = Buffer.isBuffer(raw) ? raw : Buffer.from(typeof raw === 'string' ? raw : JSON.stringify(raw, null, 2) + '\n'); need(body.length <= 2 * 1024 * 1024, 'browser_capture_bound'); fs.writeFileSync(path.join(output, name), body, { flag: 'wx' }); }
const crm = page => page.getByRole('region', { name: 'CRM', exact: true });
const editor = page => crm(page).getByRole('form', { name: 'Contact details' });
async function open(page) { await page.goto(pageUrl, { waitUntil: 'networkidle' }); await crm(page).getByRole('heading', { name: 'Relationships', exact: true }).waitFor(); }
async function select(page, name) {
  await crm(page).getByLabel('Search contacts', { exact: true }).fill(name); await crm(page).getByRole('button', { name: 'Search', exact: true }).click();
  await page.waitForLoadState('networkidle');
  await crm(page).getByRole('button', { name: new RegExp(name) }).first().click(); await editor(page).getByLabel('Name', { exact: true }).waitFor(); await page.waitForLoadState('networkidle');
}
async function fill(page, name, notes) {
  await crm(page).getByRole('button', { name: 'Add contact', exact: true }).click();
  await editor(page).getByLabel('Name', { exact: true }).fill(name); await editor(page).getByLabel('Organization', { exact: true }).fill('Authored Browser Studio');
  await editor(page).getByLabel('Email', { exact: true }).fill('browser@example.test'); await editor(page).getByLabel('Notes', { exact: true }).fill(notes);
  await editor(page).getByLabel('Next step', { exact: true }).fill('Review authored follow-up');
  await editor(page).getByLabel('Follow-up date', { exact: true }).fill('2026-12-20');
}
async function mutation(page, action, ending, status = 200) {
  const observed = page.waitForResponse(response => new URL(response.url()).pathname === prefix + ending && ['POST', 'PATCH'].includes(response.request().method()));
  await action(); const response = await observed; need(response.status() === status, 'actual_ui_mutation_status');
  const body = await response.json();
  if (status < 400) { await crm(page).getByText(/Contact saved\.|Saved operation confirmed\./).first().waitFor(); await page.waitForLoadState('networkidle'); }
  return body;
}
async function capture(row, page, label, png = false) {
  await crm(page).scrollIntoViewIfNeeded();
  await page.evaluate(() => document.querySelector('.aos-crm')?.scrollIntoView({ block: 'start' }));
  const geometry = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth, body: document.body.scrollWidth }));
  need(geometry.scroll <= row.width + 1 && geometry.body <= row.width + 1, 'crm_horizontal_overflow');
  const name = 'crm-' + row.id.toLowerCase() + '-' + label;
  save(name + '.dom.json', { url: page.url(), geometry, html: await page.content() });
  if (png) { const image = await page.screenshot({ fullPage: false }); need(image.length <= 1024 * 1024, 'png_bound'); save(name + '.png', image); }
  row.captures.push({ label, dom: name + '.dom.json', png: png ? name + '.png' : null, geometry });
}
async function context(row) {
  const context = await browser.newContext({ viewport: { width: row.width, height: 900 } });
  context.on('page', page => {
    page.on('pageerror', error => row.errors.push('page: ' + error.message));
    page.on('requestfailed', request => {
      const entry = { method: request.method(), url: request.url(), error: request.failure()?.errorText };
      if (row.expectedAbort && entry.method === 'POST' && new URL(entry.url).pathname === prefix + '/contacts') row.expectedFailures.push(entry);
      else row.errors.push('request: ' + entry.url + ': ' + entry.error);
    });
    page.on('response', response => {
      if (response.status() < 400) return;
      const entry = { status: response.status(), method: response.request().method(), url: response.url() };
      if (row.expectedConflict && entry.status === 409 && entry.method === 'PATCH' && new URL(entry.url).pathname === prefix + '/contacts/' + row.contactId) row.expectedFailures.push(entry);
      else row.errors.push('http: ' + entry.status + ': ' + entry.url);
    });
    page.on('dialog', dialog => { void dialog.accept(); });
  });
  await context.route('**/*', async route => {
    const request = route.request(); row.requests.push({ method: request.method(), url: request.url() });
    if (!request.url().startsWith(origin + '/') && !request.url().startsWith('data:')) { row.errors.push('external_origin'); await route.abort(); }
    else await route.continue();
  });
  return context;
}
function row(id, width) { const value = { id, width, captures: [], requests: [], expectedFailures: [], errors: [], contextsClosed: 0, passed: false }; report.cases.push(value); return value; }
async function run(id, width, count, fn) {
  const result = row(id, width), contexts = [];
  try { for (let n = 0; n < count; n++) contexts.push(await context(result)); await fn(result, contexts); need(result.errors.length === 0 && result.captures.length === 2, 'actual_crm_browser_profile'); result.passed = true; }
  catch (error) { result.errors.push(String(error.stack ?? error)); for (const c of contexts) for (const page of c.pages()) { try { save(`crm-${id.toLowerCase()}-failed-${contexts.indexOf(c)}.html`, await page.content()); } catch {} } throw error; }
  finally { for (const c of contexts) { await c.close(); result.contextsClosed++; } }
}
try {
  browser = await chromium.launch({ headless: true }); report.version = browser.version();
  let desktop;
  await run('B01', 1280, 1, async (row, [context]) => {
    const page = await context.newPage(); await open(page); await fill(page, 'Browser Desktop', 'Authored desktop note\nRetained second line');
    desktop = await mutation(page, () => editor(page).getByRole('button', { name: 'Save contact', exact: true }).click(), '/contacts', 201);
    const id = desktop.contact.id;
    await crm(page).getByLabel('Choose a task', { exact: true }).selectOption(state.issue.id);
    const linked = await mutation(page, () => crm(page).getByRole('button', { name: 'Link task', exact: true }).click(), '/contacts/' + id + '/tasks');
    need(linked.tasks.some(task => task.id === state.issue.id), 'actual_browser_task_link'); await capture(row, page, 'saved', true);
    await page.reload({ waitUntil: 'networkidle' }); await select(page, 'Browser Desktop');
    need(await editor(page).getByLabel('Notes', { exact: true }).inputValue() === 'Authored desktop note\nRetained second line', 'browser_reload_notes');
    const target = crm(page).getByRole('link', { name: new RegExp(state.issue.title) }); const previous = page.url();
    await target.click(); await page.waitForURL(url => url.pathname.includes('/issues/')); await page.locator('main').getByText(state.issue.title, { exact: true }).first().waitFor();
    row.navigation = { followed: page.url() }; await page.goBack({ waitUntil: 'networkidle' }); need(page.url() === previous, 'native_task_navigation_back'); row.navigation.returned = page.url();
    await select(page, 'Browser Desktop'); await capture(row, page, 'reloaded'); row.contactId = id;
  });
  await run('B02', 390, 1, async (row, [context]) => {
    const page = await context.newPage(); await open(page); await fill(page, 'Browser Narrow', 'Authored narrow note');
    let response = await mutation(page, () => editor(page).getByRole('button', { name: 'Save contact', exact: true }).click(), '/contacts', 201); const id = response.contact.id;
    await editor(page).getByLabel('Stage', { exact: true }).selectOption('customer'); await editor(page).getByLabel('Notes', { exact: true }).fill('Edited on narrow screen');
    const longName = 'Browser Narrow ' + 'N'.repeat(105); await editor(page).getByLabel('Name', { exact: true }).fill(longName);
    response = await mutation(page, () => editor(page).getByRole('button', { name: 'Save contact', exact: true }).click(), '/contacts/' + id);
    need(response.contact.stage === 'customer' && response.contact.name === longName && longName.length === 120, 'narrow_edit');
    await mutation(page, () => editor(page).getByRole('button', { name: 'Archive contact', exact: true }).click(), '/contacts/' + id + '/archive');
    await crm(page).getByRole('button', { name: 'Back to contacts', exact: true }).click(); await page.waitForLoadState('networkidle');
    await crm(page).getByLabel('Show', { exact: true }).selectOption('archived'); await page.waitForLoadState('networkidle');
    await crm(page).getByRole('button', { name: /Browser Narrow/ }).click(); await capture(row, page, 'archived', true);
    await mutation(page, () => editor(page).getByRole('button', { name: 'Restore contact', exact: true }).click(), '/contacts/' + id + '/archive');
    await page.reload({ waitUntil: 'networkidle' }); await select(page, 'Browser Narrow');
    need(await editor(page).getByLabel('Notes', { exact: true }).inputValue() === 'Edited on narrow screen'
      && await editor(page).getByLabel('Name', { exact: true }).inputValue() === longName, 'narrow_persistence');
    await capture(row, page, 'restored'); row.contactId = id;
  });
  await run('B03', 1280, 2, async (row, [first, second]) => {
    const a = await first.newPage(), b = await second.newPage(); await open(a); await open(b); await select(a, 'Browser Desktop'); await select(b, 'Browser Desktop');
    const id = desktop.contact.id; row.contactId = id;
    await editor(a).getByLabel('Notes', { exact: true }).fill('First editor keeps this draft');
    await editor(b).getByLabel('Notes', { exact: true }).fill('Second editor saved this version');
    await mutation(b, () => editor(b).getByRole('button', { name: 'Save contact', exact: true }).click(), '/contacts/' + id);
    row.expectedConflict = true;
    await mutation(a, () => editor(a).getByRole('button', { name: 'Save contact', exact: true }).click(), '/contacts/' + id, 409);
    await crm(a).getByRole('alert').filter({ hasText: /changed elsewhere/ }).waitFor();
    need(await editor(a).getByLabel('Notes', { exact: true }).inputValue() === 'First editor keeps this draft', 'stale_draft_retained');
    await capture(row, a, 'conflict', true);
    await crm(a).getByRole('button', { name: 'Load saved contact', exact: true }).click();
    await editor(a).getByLabel('Notes', { exact: true }).waitFor();
    await a.waitForFunction(() => document.querySelector('textarea')?.value === 'Second editor saved this version');
    need(row.expectedFailures.filter(entry => entry.status === 409).length === 1, 'one_expected_conflict');
    await capture(row, a, 'loaded-saved-version');
  });
  await run('B04', 1280, 1, async (row, [context]) => {
    const page = await context.newPage(); await open(page); await fill(page, 'Browser Lost Response', 'Keep this authored draft through an uncertain reply');
    const attempts = []; let committed;
    await page.route('**/api/plugins/alvarovillalbaa.agents-os/api/contacts?*', async route => {
      if (route.request().method() !== 'POST') { await route.fallback(); return; }
      const body = route.request().postData(); need(JSON.parse(body).name === 'Browser Lost Response', 'owned_lost_reply_request'); attempts.push(body);
      if (attempts.length === 1) {
        const actual = await route.fetch(); need(actual.status() === 201, 'actual_committed_contact_before_abort'); const raw = await actual.body(); committed = JSON.parse(raw);
        save('crm-b04-committed-response.json', raw); row.committedResponse = { status: actual.status(), bytes: raw.length, sha256: hash(raw) };
        row.expectedAbort = true; await route.abort('failed');
      } else await route.continue();
    });
    await editor(page).getByRole('button', { name: 'Save contact', exact: true }).click();
    await crm(page).getByRole('alert').filter({ hasText: /Could not confirm/ }).waitFor(); await capture(row, page, 'uncertain', true);
    await page.reload({ waitUntil: 'networkidle' }); await crm(page).getByText('Unsaved draft restored for this company.').waitFor();
    need(await editor(page).getByLabel('Name', { exact: true }).inputValue() === 'Browser Lost Response', 'pending_draft_survives_reload');
    const observed = page.waitForResponse(response => new URL(response.url()).pathname === prefix + '/contacts' && response.request().method() === 'POST');
    await crm(page).getByRole('button', { name: 'Retry operation', exact: true }).click(); const replay = await observed; const actual = await replay.json();
    need(replay.status() === 201 && actual.replayed && actual.contact.id === committed.contact.id && actual.contact.revision === 1 && attempts.length === 2 && attempts[0] === attempts[1], 'same_request_replay_without_duplicate');
    row.replay = { sameRequestBytes: true, attempts: attempts.length, contactId: actual.contact.id, revision: actual.contact.revision };
    row.contactId = actual.contact.id; await crm(page).getByText('Saved operation confirmed.', { exact: true }).waitFor(); await capture(row, page, 'confirmed');
    need(row.expectedFailures.filter(entry => entry.error).length === 1, 'one_authored_transport_failure');
  });
  report.passed = report.cases.length === 4 && report.cases.every(row => row.passed && row.contextsClosed === (row.id === 'B03' ? 2 : 1) && !row.errors.length);
} catch (error) { report.errors.push(String(error.stack ?? error)); }
finally { if (browser) { await browser.close(); report.browserClosed = true; } save('crm-browser.json', report); }
if (!report.passed || !report.browserClosed) process.exitCode = 1;
