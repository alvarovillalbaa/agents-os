import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fixtureClient, need, hash } from './api-client.mjs';
const { root, api, scoped, save, pluginKey, report: setupReport } = fixtureClient('browser-setup');
const { chromium } = createRequire(path.join(process.env.AGENTS_OS_TOOLS, 'package.json'))('playwright');
const state = JSON.parse(fs.readFileSync(path.join(root, 'harness-state.json'))), origin = 'http://127.0.0.1:4315';
const prefix = '/api/plugins/' + pluginKey + '/api', pack = { packVersion: '0.1.0' };
const report = { sourceCommit: process.env.SOURCE_COMMIT, passed: false, cases: [], errors: [], browserClosed: false }; let browser;
const harness = page => page.getByRole('region', { name: 'Shared Harness', exact: true });
const activity = new WeakMap();
async function settle(page) {
  const data = activity.get(page); need(data, 'observed_harness_page'); const start = Date.now();
  while (Date.now() - start < 30_000) {
    if (!data.pending.size && Date.now() - Math.max(data.changedAt, start) >= 500) { data.row.settlements.push({ url: page.url(), elapsedMs: Date.now() - start, pending: 0 }); return; }
    await new Promise(done => setTimeout(done, 50));
  }
  throw new Error('harness_page_did_not_settle');
}
async function open(page, company) { await page.goto(origin + '/' + company.issuePrefix + '/harness', { waitUntil: 'domcontentloaded' }); await harness(page).getByRole('heading', { name: 'Shared Harness', exact: true }).waitFor(); await settle(page); }
async function setup(page, name = 'Create missing resources') {
  const response = page.waitForResponse(value => new URL(value.url()).pathname === prefix + '/setup' && value.request().method() === 'POST');
  await harness(page).getByRole('button', { name, exact: true }).click(); const actual = await response; need(actual.status() === 200, 'actual_harness_ui_setup'); const body = await actual.json();
  await harness(page).getByText(/Setup saved\./).waitFor(); await settle(page); return body;
}
async function capture(row, page, label, png = false) {
  await settle(page); await harness(page).scrollIntoViewIfNeeded(); await page.evaluate(() => document.querySelector('.aos-harness')?.scrollIntoView({ block: 'start' }));
  const geometry = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth, body: document.body.scrollWidth }));
  need(geometry.scroll <= row.width + 1 && geometry.body <= row.width + 1, 'harness_overflow');
  const name = 'harness-' + row.id.toLowerCase() + '-' + label; save(name + '.dom.json', { url: page.url(), geometry, html: await page.content() });
  if (png) { const raw = await page.screenshot({ fullPage: false }); need(raw.length <= 1024 * 1024, 'harness_png_bound'); save(name + '.png', raw); }
  row.captures.push({ label, dom: name + '.dom.json', png: png ? name + '.png' : null, geometry });
}
async function context(row) {
  const ctx = await browser.newContext({ viewport: { width: row.width, height: 900 } });
  ctx.on('page', page => {
    const data = { pending: new Set(), changedAt: Date.now(), row }; activity.set(page, data);
    page.on('request', request => { data.pending.add(request); data.changedAt = Date.now(); });
    const finish = request => { data.pending.delete(request); data.changedAt = Date.now(); }; page.on('requestfinished', finish); page.on('requestfailed', finish);
    page.on('pageerror', error => row.errors.push('page: ' + error.message));
    page.on('requestfailed', request => {
      const entry = { method: request.method(), url: request.url(), error: request.failure()?.errorText };
      if (row.expectedAbort && entry.method === 'POST' && new URL(entry.url).pathname === prefix + '/setup') row.expectedFailures.push(entry);
      else row.errors.push('request: ' + entry.url + ': ' + entry.error);
    });
    page.on('response', response => { if (response.status() >= 400) row.errors.push('http: ' + response.status() + ': ' + response.url()); });
  });
  await ctx.route('**/*', async route => {
    row.requests.push({ method: route.request().method(), url: route.request().url() });
    if (!route.request().url().startsWith(origin + '/') && !route.request().url().startsWith('data:')) { row.errors.push('external_origin'); await route.abort(); }
    else await route.continue();
  });
  return ctx;
}
async function run(id, width, fn) {
  const row = { id, width, passed: false, captures: [], requests: [], settlements: [], expectedFailures: [], errors: [], contextsClosed: 0 }; report.cases.push(row);
  const ctx = await context(row);
  try { await fn(row, ctx); need(!row.errors.length && row.captures.length === 2, 'harness_browser_profile'); row.passed = true; }
  catch (error) { row.errors.push(String(error.stack ?? error)); for (const [index, page] of ctx.pages().entries()) { try { save(`harness-${id.toLowerCase()}-failed-${index}.html`, await page.content()); } catch {} } throw error; }
  finally { await ctx.close(); row.contextsClosed++; }
}
try {
  browser = await chromium.launch({ headless: true }); report.version = browser.version();
  await run('HB01', 1280, async (row, ctx) => {
    const page = await ctx.newPage(), company = state.browserCompanies[0]; await open(page, company);
    await harness(page).getByText('Not created yet.', { exact: true }).waitFor(); await capture(row, page, 'empty');
    need(!row.requests.some(request => request.method === 'POST' && request.url.includes(prefix)), 'read_only_page_load');
    const result = await setup(page); need(result.missingCount === 0 && result.agents.every(agent => agent.status === 'paused' && agent.skillSelected), 'desktop_shared_team');
    await capture(row, page, 'created', true);
    const before = page.url(); await harness(page).getByRole('link', { name: 'Configure planner', exact: true }).click();
    await page.waitForURL(url => url.pathname.includes('/agents/')); await page.locator('main').getByText('Mission Planner', { exact: true }).first().waitFor(); await settle(page);
    row.navigation = { agent: page.url() }; await page.goBack({ waitUntil: 'domcontentloaded' }); await harness(page).getByRole('heading', { name: 'Shared Harness', exact: true }).waitFor(); await settle(page); need(page.url() === before, 'native_agent_return');
    await harness(page).getByRole('link', { name: 'Open Missions', exact: true }).click(); await page.getByRole('region', { name: 'Missions', exact: true }).getByRole('heading', { name: 'Missions', exact: true }).waitFor(); await settle(page); row.navigation.missions = page.url();
    await open(page, state.other);
    need(await harness(page).getByText('pending approval', { exact: true }).count() === 2
      && await harness(page).getByRole('link', { name: 'Review hire approval', exact: true }).count() === 2, 'native_hire_approvals_visible');
    row.approvalLinks = await harness(page).getByRole('link', { name: 'Review hire approval', exact: true }).evaluateAll(links => links.map(link => link.getAttribute('href')));
    need(row.approvalLinks.every(link => link === '/' + state.other.issuePrefix + '/approvals'), 'company_scoped_approval_links');
  });
  await run('HB02', 390, async (row, ctx) => {
    const page = await ctx.newPage(), company = state.browserCompanies[1]; await open(page, company); await capture(row, page, 'narrow-empty');
    const result = await setup(page); need(result.missingCount === 0, 'narrow_setup'); await page.reload({ waitUntil: 'domcontentloaded' });
    await harness(page).getByRole('heading', { name: 'Your shared team', exact: true }).waitFor(); await settle(page);
    need(await harness(page).getByText('Selected', { exact: true }).count() === 2 && await harness(page).getByText('paused', { exact: true }).count() === 2, 'narrow_reload_bindings'); await capture(row, page, 'narrow-reloaded', true);
  });
  await run('HB03', 1280, async (row, ctx) => {
    const company = state.browserCompanies[2], original = await scoped(company.id, 'POST', '/setup', pack);
    const planner = original.agents.find(agent => agent.key === 'mission-planner'), operator = original.agents.find(agent => agent.key === 'mission-operator');
    const native = await api('GET', '/agents/' + planner.id), file = await api('GET', `/agents/${planner.id}/instructions-bundle/file?path=promptTemplate.legacy.md`);
    await api('PATCH', '/agents/' + planner.id, { name: 'Board customized planner', adapterConfig: { ...native.adapterConfig, paperclipSkillSync: { desiredSkills: [] } } });
    const customInstructions = file.content + '\nBoard authored customization.\n';
    await api('PUT', `/agents/${planner.id}/instructions-bundle/file`, { path: 'AGENTS.md', content: customInstructions, baseRevisionId: file.revision?.id ?? null, clearLegacyPromptTemplate: true });
    await api('POST', '/agents/' + operator.id + '/terminate', {});
    let retired = false;
    for (let n = 0; n < 50; n++) {
      const current = await api('GET', '/agents/' + operator.id);
      if (current.status === 'terminated') { retired = true; break; }
      await new Promise(done => setTimeout(done, 300));
    }
    need(retired, 'native_operator_termination_complete');
    const page = await ctx.newPage(); await open(page, company); await harness(page).getByRole('heading', { name: 'Board customized planner', exact: true }).waitFor();
    await harness(page).getByRole('article', { name: 'Board customized planner', exact: true }).getByText('Agent instructions and settings are kept in Paperclip.', { exact: true }).waitFor(); await capture(row, page, 'customized-missing');
    const result = await setup(page); const retained = result.agents.find(agent => agent.id === planner.id);
    need(retained.name === 'Board customized planner' && !retained.skillSelected
      && result.agents.some(agent => agent.key === 'mission-operator' && agent.id !== operator.id && agent.status === 'paused'), 'recreate_only_missing_preserves_customization');
    need((await api('GET', `/agents/${planner.id}/instructions-bundle/file?path=AGENTS.md`)).content === customInstructions, 'browser_repair_keeps_native_instructions');
    await capture(row, page, 'customized-retained', true); row.repair = { retainedPlanner: planner.id, retiredOperator: operator.id, newOperator: result.agents.find(agent => agent.key === 'mission-operator').id };
  });
  await run('HB04', 1280, async (row, ctx) => {
    const page = await ctx.newPage(), company = state.browserCompanies[3], attempts = []; let committed;
    await page.route('**/api/plugins/' + pluginKey + '/api/setup?*', async route => {
      if (route.request().method() !== 'POST') { await route.fallback(); return; }
      const body = route.request().postData(); need(JSON.parse(body).packVersion === '0.1.0', 'owned_harness_lost_reply'); attempts.push(body);
      if (attempts.length === 1) {
        const actual = await route.fetch(); need(actual.status() === 200, 'harness_committed_before_reply_loss'); const raw = await actual.body(); committed = JSON.parse(raw);
        save('harness-hb04-committed-response.json', raw); row.committedResponse = { status: actual.status(), bytes: raw.length, sha256: hash(raw) }; row.expectedAbort = true; await route.abort('failed');
      } else await route.continue();
    });
    await open(page, company); await harness(page).getByRole('button', { name: 'Create missing resources', exact: true }).click();
    await harness(page).getByRole('alert').waitFor(); await harness(page).getByText('Setup may have partially completed.', { exact: true }).waitFor(); await settle(page); await capture(row, page, 'uncertain', true);
    await page.reload({ waitUntil: 'domcontentloaded' }); await harness(page).getByRole('heading', { name: 'Your shared team', exact: true }).waitFor(); await settle(page);
    await harness(page).getByText('Setup may have partially completed.', { exact: true }).waitFor(); const replay = await setup(page, 'Retry setup');
    need(attempts.length === 2 && attempts[0] === attempts[1] && JSON.stringify(replay) === JSON.stringify(committed)
      && row.expectedFailures.length === 1, 'identical_harness_retry');
    need(await harness(page).getByRole('button', { name: 'Retry setup', exact: true }).count() === 0, 'pending_setup_cleared');
    row.replay = { attempts: 2, sameRequestBytes: true, sameBindings: true }; await capture(row, page, 'recovered');
  });
  need(report.cases.length === 4 && report.cases.every(row => row.passed), 'four_harness_browser_cases'); report.passed = true; setupReport.passed = true;
} catch (error) { report.errors.push(String(error.stack ?? error)); }
finally { if (browser) { await browser.close(); report.browserClosed = true; } save('browser-setup.json', setupReport); save('harness-browser.json', report); }
if (!report.passed) process.exitCode = 1;
