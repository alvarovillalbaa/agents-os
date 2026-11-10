// T2/T3 actual published Paperclip UI against the owned fixture database.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const need = (value, message) => { if (!value) throw new Error(message); };
const root = process.env.AGENTS_OS_EVAL_ROOT, nonce = process.env.AGENTS_OS_EVAL_NONCE;
need(root && nonce && fs.readFileSync(path.join(root, '.owner'), 'utf8') === nonce, 'owned_eval_required');
const { chromium } = createRequire(path.join(process.env.AGENTS_OS_TOOLS, 'package.json'))('playwright');
const output = path.join(root, 'output'), state = JSON.parse(fs.readFileSync(path.join(root, 'state.json'))), origin = 'http://127.0.0.1:4315';
const report = { sourceCommit: process.env.SOURCE_COMMIT, passed: false, cases: [], browserClosed: false, errors: [] }; let browser;
try {
  browser = await chromium.launch({ headless: true }); report.version = browser.version();
  for (const [id, width] of [['P07', 1280], ['P08', 390]]) {
    const row = { id, width, captures: [], errors: [], requests: [], contextClosed: false }; report.cases.push(row);
    const context = await browser.newContext({ viewport: { width, height: 900 } }); const page = await context.newPage();
    page.on('pageerror', error => row.errors.push('page: ' + error.message));
    page.on('requestfailed', request => row.errors.push('request: ' + request.url() + ': ' + request.failure()?.errorText));
    page.on('response', response => { if (response.status() >= 400) row.errors.push('http: ' + response.status() + ': ' + response.url()); });
    await page.route('**/*', async route => {
      const request = route.request(), url = request.url(); row.requests.push({ method: request.method(), url });
      if (!url.startsWith(origin + '/') && !url.startsWith('data:')) { row.errors.push('external_origin'); await route.abort(); }
      else await route.continue();
    });
    try {
      const base = '/' + state.company.issuePrefix;
      const routes = [
        ['task', base + '/issues/' + state.task.id, state.task.title, true],
        ['agent-run', base + '/agents/' + state.agent.id + '/runs/' + state.run.id, state.agent.name, true],
        ['goals', base + '/goals', state.goal.title, false],
        ['skills', base + '/skills', null, false],
      ];
      for (const [label, route, expected, png] of routes) {
        await page.goto(origin + route, { waitUntil: 'networkidle', timeout: 30000 });
        const main = page.locator('main').first(); await main.waitFor();
        if (expected) await main.getByText(expected, { exact: true }).first().waitFor({ timeout: 15000 });
        else await main.getByRole('heading', { name: /skills/i }).first().waitFor({ timeout: 15000 });
        if (label === 'task') {
          const previous = page.url(), links = main.locator('a[href^="/"]'); let followed = false;
          for (let n = 0; n < Math.min(20, await links.count()); n++) {
            const link = links.nth(n), href = await link.getAttribute('href');
            if (!href || href.startsWith('//') || new URL(href, origin).href === previous || !await link.isVisible()) continue;
            await link.click(); await page.waitForURL(url => url.href !== previous, { timeout: 10000 });
            row.navigation = { from: previous, followed: page.url() };
            await page.goBack({ waitUntil: 'networkidle' });
            await main.getByText(expected, { exact: true }).first().waitFor({ timeout: 15000 });
            row.navigation.returned = page.url(); followed = true; break;
          }
          need(followed && row.navigation.returned === previous, 'actual_navigation_and_back');
        }
        need(!/Something went wrong|Internal Server Error|Failed to load/i.test(await main.innerText()), 'page_error_surface');
        const geometry = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth, body: document.body.scrollWidth }));
        const stem = 'paperclip-' + id.toLowerCase() + '-' + label, body = Buffer.from(JSON.stringify({ route, geometry, html: await page.content() }, null, 2) + '\n');
        need(body.length <= 2 * 1024 * 1024, 'dom_bound'); fs.writeFileSync(path.join(output, stem + '.dom.json'), body, { flag: 'wx' });
        if (png) { const image = await page.screenshot({ fullPage: false }); need(image.length <= 1024 * 1024, 'png_bound'); fs.writeFileSync(path.join(output, stem + '.png'), image, { flag: 'wx' }); }
        row.captures.push({ label, route, geometry, dom: stem + '.dom.json', png: png ? stem + '.png' : null });
        need(geometry.scroll <= width + 1 && geometry.body <= width + 1, 'document_horizontal_overflow');
      }
      need(row.errors.length === 0 && row.captures.length === 4, 'actual_ui_profile'); row.passed = true;
    } catch (error) {
      row.errors.push(String(error.stack ?? error));
      try { const raw = Buffer.from(await page.content()); if (raw.length <= 2 * 1024 * 1024) fs.writeFileSync(path.join(output, 'paperclip-' + id.toLowerCase() + '-failed.html'), raw, { flag: 'wx' }); } catch {}
      throw error;
    } finally { await context.close(); row.contextClosed = true; }
  }
  report.passed = report.cases.length === 2 && report.cases.every(row => row.passed && row.contextClosed && !row.errors.length);
} catch (error) { report.errors.push(String(error.stack ?? error)); }
finally {
  if (browser) { await browser.close(); report.browserClosed = true; }
  fs.writeFileSync(path.join(output, 'paperclip-browser.json'), JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
}
if (!report.passed || !report.browserClosed) process.exitCode = 1;
