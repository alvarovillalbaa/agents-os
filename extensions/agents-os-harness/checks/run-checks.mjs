// Bounded actual Agents OS package/API/DB/browser checks on a pinned Paperclip host.
import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import { spawn, execFileSync } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { createRequire } from 'node:module';
const need = (value, message) => { if (!value) throw new Error(message); };
const hash = value => createHash('sha256').update(value).digest('hex');
const sourceCommit = process.argv[3], workflowCommit = process.env.GITHUB_SHA;
need(process.argv.length === 4 && process.argv[2] === '--source-commit' && sourceCommit === process.env.SOURCE_COMMIT
  && /^[a-f0-9]{40}$/.test(sourceCommit ?? '') && /^[a-f0-9]{40}$/.test(workflowCommit ?? '') && sourceCommit !== workflowCommit, 'source_pin_required');
need(process.platform === 'linux' && process.version === 'v24.22.2' && process.env.CI === 'true'
  && process.env.GITHUB_REPOSITORY === 'alvarovillalbaa/agents-os' && process.env.GITHUB_REF === 'refs/heads/master'
  && process.env.GITHUB_EVENT_NAME === 'workflow_dispatch' && process.env.AGENTS_OS_PUBLIC_REPOSITORY === 'true', 'approved_public_ci_required');
const repo = fs.realpathSync(process.cwd()), parent = fs.realpathSync(process.env.RUNNER_TEMP);
const root = fs.mkdtempSync(path.join(parent, 'agents-os-harness-')); fs.chmodSync(root, 0o700);
const identity = fs.lstatSync(root), nonce = randomBytes(16).toString('hex');
fs.writeFileSync(path.join(root, '.owner'), nonce, { flag: 'wx', mode: 0o600 });
for (const name of ['source', 'output', 'tools', 'worker', 'home', 'storage', 'logs', 'tmp', 'cache', 'config', 'data', 'state', 'package', 'artifacts', 'installed', 'candidate', 'previous']) fs.mkdirSync(path.join(root, name), { mode: 0o700 });
for (const name of ['npm-user', 'npm-global']) fs.writeFileSync(path.join(root, name), '', { flag: 'wx', mode: 0o600 });
const sourcePrefix = 'extensions/agents-os-harness/';
const source = path.join(root, 'source'), output = path.join(root, 'output'), toolsRoot = path.join(root, 'tools');
const packageRoot = path.join(root, 'package'), installedRoot = path.join(root, 'installed');
const packet = path.join(parent, `agents-os-harness-packet-${process.env.GITHUB_RUN_ID}-${process.env.GITHUB_RUN_ATTEMPT}`);
fs.mkdirSync(packet, { mode: 0o700 }); fs.appendFileSync(process.env.GITHUB_ENV, `AGENTS_OS_EVAL_PACKET=${packet}\n`);
const env = { PATH: `${path.dirname(process.execPath)}:/usr/bin:/bin`, HOME: process.env.HOME, LANG: 'C.UTF-8', TZ: 'UTC', CI: 'true', NO_COLOR: '1', SOURCE_COMMIT: sourceCommit,
  TMPDIR: path.join(root, 'tmp'), TMP: path.join(root, 'tmp'), TEMP: path.join(root, 'tmp'),
  XDG_CACHE_HOME: path.join(root, 'cache'), XDG_CONFIG_HOME: path.join(root, 'config'), XDG_DATA_HOME: path.join(root, 'data'), XDG_STATE_HOME: path.join(root, 'state'),
  npm_config_cache: path.join(root, 'cache/npm'), npm_config_userconfig: path.join(root, 'npm-user'), npm_config_globalconfig: path.join(root, 'npm-global'),
  npm_config_registry: 'https://registry.npmjs.org/', npm_config_ignore_scripts: 'true', npm_config_audit: 'false', npm_config_fund: 'false',
  npm_config_fetch_retries: '0', npm_config_fetch_timeout: '15000', npm_config_update_notifier: 'false',
  PLAYWRIGHT_BROWSERS_PATH: path.join(root, 'cache/ms-playwright'),
  AGENTS_OS_EVAL_ROOT: root, AGENTS_OS_EVAL_NONCE: nonce, AGENTS_OS_TOOLS: toolsRoot };
const deadline = Date.now() + 1020000, active = new Set(), secrets = [], report = {
  schemaVersion: 'agents-os.harness-checks.v1', sourceCommit, workflowCommit, status: 'failed', startedAt: new Date().toISOString(),
  upstream: { version: '2026.1106.0', commit: 'd69631b01b9c658f80bf8bed389863dce82643e1' },
  commands: [], cases: [], guards: [], errors: [], database: { created: false, removed: false }, cleanup: {},
  proofLimits: ['Shared native agent/skill configuration and materialization only; model execution quality, production and finished Agents OS remain open.',
    'Loopback local_trusted/private authored fixture only; no public deployment, real account/contact data, model/provider call or paid resource.',
    'Two generated disposable key bodies are explicitly withheld; all other safe originals and full command streams are retained.'] };
let baseline, seed, server, admin, dbName, interrupted = false;
function safe(body) {
  const privateFile = path.join(root, 'generated-secrets.json');
  if (fs.existsSync(privateFile)) {
    const stat = fs.lstatSync(privateFile); need(stat.isFile() && !stat.isSymbolicLink() && stat.size <= 65536 && stat.uid === process.getuid(), 'private_secret_owner');
    const generated = JSON.parse(fs.readFileSync(privateFile, 'utf8')); need(Array.isArray(generated) && generated.length <= 16 && generated.every(value => typeof value === 'string' && value.length <= 4096), 'private_secret_bound');
    for (const value of generated) if (!secrets.includes(value)) secrets.push(value);
  }
  const text = Buffer.isBuffer(body) ? body.toString() : String(body);
  need(!secrets.some(secret => text.includes(secret)) && !/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/.test(text), 'secret_bearing_capture');
}
function write(base, name, value) {
  const body = typeof value === 'string' || Buffer.isBuffer(value) ? value : JSON.stringify(value, null, 2) + '\n'; safe(body);
  fs.writeFileSync(path.join(base, name), body, { flag: 'wx' });
}
function owner() {
  const current = fs.lstatSync(root);
  need(current.isDirectory() && !current.isSymbolicLink() && current.dev === identity.dev && current.ino === identity.ino && current.uid === process.getuid()
    && fs.readFileSync(path.join(root, '.owner'), 'utf8') === nonce, 'owned_root_changed');
}
function proc(pid) {
  try { const raw = fs.readFileSync(`/proc/${pid}/stat`, 'utf8'), fields = raw.slice(raw.lastIndexOf(')') + 2).split(' ');
    return { pid, uid: fs.statSync(`/proc/${pid}`).uid, pgid: Number(fields[2]), sid: Number(fields[3]), start: fields[19] };
  } catch (error) { if (['ENOENT', 'ESRCH'].includes(error.code)) return null; throw error; }
}
function remainingWorkers() {
  return ['plugin-worker-identity.json', 'plugin-restarted-worker-identity.json', 'missions-worker-identity.json', 'missions-restarted-worker-identity.json'].flatMap(name => {
    const file = path.join(output, name); if (!fs.existsSync(file)) return [];
    const row = JSON.parse(fs.readFileSync(file)), current = proc(row.pid);
    return current && current.uid === process.getuid() && current.start === row.start ? [row] : [];
  });
}
function absent(pid) { try { process.kill(-pid, 0); return false; } catch (error) { return error.code === 'ESRCH'; } }
const processBaseline = new Map();
for (const name of fs.readdirSync('/proc').filter(value => /^\d+$/.test(value))) { const row = proc(Number(name)); if (row?.uid === process.getuid()) processBaseline.set(row.pid, row.start); }
function ownedProcesses() {
  const names = fs.readdirSync('/proc').filter(value => /^\d+$/.test(value)); need(names.length <= 16384, 'process_scan_bound');
  const found = [];
  for (const name of names) {
    const pid = Number(name); if (pid === process.pid) continue;
    try {
      const row = proc(pid); if (!row || row.uid !== process.getuid() || processBaseline.get(pid) === row.start) continue;
      const body = fs.readFileSync(`/proc/${pid}/environ`); need(body.length <= 1024 * 1024, 'process_environment_bound');
      const values = body.toString().split('\0');
      if (values.includes('AGENTS_OS_EVAL_ROOT=' + root) && values.includes('AGENTS_OS_EVAL_NONCE=' + nonce)) {
        const after = proc(pid); if (after && after.start === row.start) found.push(row);
      }
    } catch (error) { if (!['ENOENT', 'ESRCH'].includes(error.code)) throw error; }
  }
  return found;
}
for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(signal, () => { interrupted = true; for (const child of active) child.stop('SIGTERM'); });
function launch(label, command, args, cwd = source, seconds = 120) {
  owner(); need(!interrupted && Date.now() + 15000 < deadline, 'deadline_or_interruption');
  const row = { label, command, args, startedAt: new Date().toISOString(), signals: [], streams: [] }; report.commands.push(row);
  const child = spawn(command, args, { cwd, env, detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
  const bound = child.pid ? proc(child.pid) : null; row.pid = child.pid; row.identity = bound;
  const pieces = [[], []], sizes = [0, 0], ended = [false, false]; let timer, killTimer, handle;
  const stop = signal => {
    const now = child.pid && proc(child.pid);
    if (now && bound && now.uid === bound.uid && now.start === bound.start && now.pgid === child.pid && now.sid === child.pid) {
      process.kill(-child.pid, signal); row.signals.push(signal);
    } else if (child.pid && !absent(child.pid)) row.uncertainOwnership = true;
  };
  const promise = new Promise((resolve, reject) => {
    child.once('error', error => { row.spawnError = error.code ?? 'spawn_error'; });
    [child.stdout, child.stderr].forEach((stream, index) => {
      stream.on('data', body => { sizes[index] += body.length; if (sizes[index] <= 4 * 1024 * 1024) pieces[index].push(body); else { row.overflow = true; stop('SIGTERM'); } });
      stream.once('end', () => { ended[index] = true; });
    });
    child.once('close', async (code, signal) => {
      clearTimeout(timer); clearTimeout(killTimer); active.delete(handle);
      row.exitCode = code; row.signal = signal; row.closeObserved = true; row.completedAt = new Date().toISOString();
      for (let n = 0; child.pid && !absent(child.pid) && n < 20; n++) await new Promise(done => setTimeout(done, 50));
      row.originalGroupAbsent = !child.pid || absent(child.pid);
      try {
        for (let n = 0; n < 2; n++) { const body = Buffer.concat(pieces[n]), name = label + (n ? '.stderr.txt' : '.stdout.txt'); safe(body); write(output, name, body);
          row.streams.push({ name, bytes: body.length, sha256: hash(body), complete: ended[n] && !row.overflow }); }
        if (row.spawnError || row.overflow || !row.originalGroupAbsent || !ended.every(Boolean)) throw new Error('command_or_stream_closure_failed');
        resolve({ row, code, signal, stdout: Buffer.concat(pieces[0]) });
      } catch (error) { reject(error); }
    });
    timer = setTimeout(() => { row.timedOut = true; stop('SIGTERM'); killTimer = setTimeout(() => stop('SIGKILL'), 5000); },
      Math.min(seconds * 1000, Math.max(1000, deadline - Date.now() - 10000)));
  });
  promise.catch(() => undefined); handle = { row, promise, stop }; active.add(handle); return handle;
}
async function run(label, command, args, cwd = source, seconds = 120) {
  const result = await launch(label, command, args, cwd, seconds).promise;
  need(result.code === 0 && result.signal === null && !result.row.timedOut, label + '_failed'); return result.stdout;
}
const git = (...args) => execFileSync('git', args, { cwd: repo, env: { ...env, GIT_NO_LAZY_FETCH: '1', GIT_OPTIONAL_LOCKS: '0' }, maxBuffer: 2 * 1024 * 1024, timeout: 30000 });
const names = git('ls-files', '-z').toString().split('\0').filter(Boolean).sort(); need(names.length <= 2000, 'source_file_count');
const exported = names.filter(name => name.startsWith(sourcePrefix)).map(name => name.slice(sourcePrefix.length));
need(exported.length > 0 && exported.length <= 100, 'evaluator_file_count');
function snapshot(base, paths) {
  let total = 0; return paths.map(name => { const file = path.join(base, name), stat = fs.lstatSync(file);
    need((stat.isFile() || stat.isSymbolicLink()) && stat.size <= 2 * 1024 * 1024, 'source_file_bound');
    const raw = stat.isSymbolicLink() ? fs.readlinkSync(file, { encoding: 'buffer' }) : fs.readFileSync(file);
    total += raw.length; need(total <= 64 * 1024 * 1024, 'source_total_bound');
    return { path: name, kind: stat.isSymbolicLink() ? 'symlink' : 'file', bytes: raw.length, mode: stat.mode & 0o777, sha256: hash(raw) }; });
}
function guard(label) {
  owner(); need(git('status', '--porcelain').length === 0 && git('rev-parse', 'HEAD').toString().trim() === sourceCommit
    && git('ls-files', '-z').toString().split('\0').filter(Boolean).sort().join('\0') === names.join('\0'), 'canonical_index_changed');
  const now = snapshot(repo, names), current = snapshot(source, exported), working = snapshot(packageRoot, exported);
  need(JSON.stringify(now) === JSON.stringify(baseline) && JSON.stringify(current) === JSON.stringify(seed) && JSON.stringify(working) === JSON.stringify(seed), 'complete_source_changed');
  report.guards.push({ label, canonicalFiles: now.length, canonicalVectorSha256: hash(JSON.stringify(now)), protectedFiles: current.length, protectedVectorSha256: hash(JSON.stringify(current)), workingSourceVectorSha256: hash(JSON.stringify(working)) });
}
async function portClosed() {
  return await new Promise(resolve => { const socket = net.createConnection({ host: '127.0.0.1', port: 4315 });
    socket.setTimeout(1000); socket.once('connect', () => { socket.destroy(); resolve(false); });
    socket.once('error', error => { socket.destroy(); resolve(error.code === 'ECONNREFUSED'); }); socket.once('timeout', () => { socket.destroy(); resolve(false); }); });
}
async function stopServer() {
  if (!server) return;
  server.stop('SIGTERM'); const closed = await server.promise;
  need(!closed.row.timedOut && closed.row.originalGroupAbsent && closed.row.signals.includes('SIGTERM')
    && ((closed.code === 0 && closed.signal === null) || (closed.code === null && closed.signal === 'SIGTERM')), 'explicit_server_shutdown');
  server = undefined; need(await portClosed(), 'listener_not_closed');
}
async function startServer(label) {
  need(await portClosed(), 'evaluation_port_in_use');
  server = launch(label, process.execPath, [path.join(toolsRoot, 'start-paperclip.mjs')], toolsRoot, 360);
  let health;
  for (let n = 0; n < 120; n++) {
    need(!server.row.closeObserved, 'server_stopped_before_health');
    try { const response = await fetch('http://127.0.0.1:4315/api/health', { signal: AbortSignal.timeout(1000), redirect: 'error' });
      const raw = await response.text(); if (response.status === 200) { safe(raw); const parsed = JSON.parse(raw); if (parsed.status === 'ok') { health = parsed; break; } }
    } catch (error) { if (!(error instanceof TypeError) && error.name !== 'TimeoutError') throw error; }
    await new Promise(done => setTimeout(done, 500));
  }
  need(health && health.deploymentMode === 'local_trusted' && health.deploymentExposure === 'private', 'healthy_trusted_loopback_required');
  write(output, label + '-health.json', health);
  const response = await fetch('http://127.0.0.1:4315/', { redirect: 'error', signal: AbortSignal.timeout(10000) });
  const html = await response.text(); need(response.status === 200 && /<html/i.test(html) && /Paperclip/i.test(html) && Buffer.byteLength(html) <= 1024 * 1024, 'actual_bundled_ui');
  write(output, label + '-index.html', html);
}
function runtimeBound() {
  let bytes = 0, files = 0;
  function walk(folder) { for (const item of fs.readdirSync(folder, { withFileTypes: true })) { const file = path.join(folder, item.name);
    if (item.isDirectory()) walk(file); else if (item.isFile()) { bytes += fs.statSync(file).size; files++;
      if (files > 128000 || bytes > 4 * 1024 ** 3) { report.runtime = { bytes, files, scanComplete: false }; throw new Error('runtime_scratch_bound'); } }
    else need(item.isSymbolicLink(), 'runtime_file_type');
  } }
  walk(root); return { bytes, files };
}
try {
  need(git('rev-parse', 'HEAD').toString().trim() === sourceCommit && git('status', '--porcelain').length === 0
    && git('rev-parse', 'HEAD^').toString().trim() === '6cb3870ff8c1d5ea25418bdce13934c4df8c6828', 'exact_clean_candidate');
  baseline = snapshot(repo, names); let bytes = 0;
  for (const name of exported) { need(!path.isAbsolute(name) && !name.split('/').some(part => ['..', '.git'].includes(part)), 'export_path');
    const original = path.join(repo, sourcePrefix, name), stat = fs.lstatSync(original); need(stat.isFile() && !stat.isSymbolicLink(), 'evaluator_regular_file');
    bytes += stat.size; need(bytes <= 4 * 1024 * 1024, 'export_bound'); const target = path.join(source, name);
    fs.mkdirSync(path.dirname(target), { recursive: true }); fs.copyFileSync(original, target, fs.constants.COPYFILE_EXCL); }
  seed = snapshot(source, exported);
  for (const name of exported) { const target = path.join(packageRoot, name); fs.mkdirSync(path.dirname(target), { recursive: true }); fs.copyFileSync(path.join(source, name), target, fs.constants.COPYFILE_EXCL); }
  report.export = { files: exported.length, bytes }; guard('before-install');
  await run('tools-install', 'npm', ['install', '--prefix', toolsRoot, '--ignore-scripts', '--omit=optional', '--save-exact', '--no-audit', '--no-fund', 'paperclipai@2026.1106.0', 'playwright@1.65.0', 'postgres@3.4.9', '@img/sharp-linux-x64@0.35.5', '@img/sharp-libvips-linux-x64@1.3.4', '@esbuild/linux-x64@0.28.2'], root, 240);
  const requireTool = createRequire(path.join(toolsRoot, 'package.json')), lock = JSON.parse(fs.readFileSync(path.join(toolsRoot, 'package-lock.json')));
  const pins = [
    ['paperclipai', '2026.1106.0', 'sha512-jcZrSB5DItxeDJGO7TccI0WcYca2IbBJxpbaKZN6kZp+isNIbVF2AgmfFQq394mjXD+TTHwS5P3AT6jjpqXbng==', 'dist/index.js'],
    ['@paperclipai/server', '2026.1106.0', 'sha512-OqG0qydn5Pky3iHmTgL3fvAh47m77CYgkuM3CgV6ciw6tY/AmBgkO3greyr0LinLFk7x1FdLkF1sfVVukZo/YA==', 'dist/index.js'],
    ['@img/sharp-linux-x64', '0.35.5', 'sha512-SxFtLTeJInhAA9Q836kux2vZNeOBQEx658qvbboZScr0wIARym3IcGmW7KpVD5sbVg0Ojy+udFQdayYIZyoNog==', 'lib/sharp-linux-x64-0.35.5.node'],
    ['@img/sharp-libvips-linux-x64', '1.3.4', 'sha512-GJ//SSXbnwSDes02umB3nDJLFcQzw8a18V8fyhqr6tV515tOEMdImjjxj1AoafMRz56F3PHgftnj1QEKSU1zkw==', null],
    ['@esbuild/linux-x64', '0.28.2', 'sha512-4xTZr1FUmSoQW4XIWmit3tzQrUTZM+N3P0XV8xROKYF50XfI7xeO90+1bZvNwxIufQ9hDQVRJH5YhgPVF8A/HQ==', 'bin/esbuild'],
  ];
  const packages = pins.map(([name, version, integrity, pinnedEntry]) => { const base = path.join(toolsRoot, 'node_modules', name), metadata = JSON.parse(fs.readFileSync(path.join(base, 'package.json'))), entry = lock.packages['node_modules/' + name];
    need(metadata.version === version && entry.integrity === integrity && entry.resolved.startsWith('https://registry.npmjs.org/'), 'published_package_identity');
    const libraries = pinnedEntry ? [] : fs.readdirSync(path.join(base, 'lib')).filter(file => /^libvips-cpp\.so\.[0-9.]+$/.test(file));
    need(pinnedEntry || libraries.length === 1, 'exact_libvips_library'); const entryFile = pinnedEntry ?? 'lib/' + libraries[0];
    const executable = fs.readFileSync(path.join(base, entryFile)); return { name, version: metadata.version, integrity, resolved: entry.resolved, entryFile, entryBytes: executable.length, entrySha256: hash(executable) }; });
  write(output, 'tool-package-lock.json', fs.readFileSync(path.join(toolsRoot, 'package-lock.json'))); write(output, 'package-identities.json', packages);
  report.host = { packages, unmodifiedPublishedEntrypoint: true }; guard('after-host-install'); report.runtime = runtimeBound();
  await run('chromium-install', path.join(toolsRoot, 'node_modules/.bin/playwright'), ['install', 'chromium'], root, 120);
  await run('plugin-dependencies', 'npm', ['install', '--include=optional', '--ignore-scripts', '--no-audit', '--no-fund'], packageRoot, 240);
  const pluginLock = JSON.parse(fs.readFileSync(path.join(packageRoot, 'package-lock.json')));
  need(pluginLock.packages['node_modules/@paperclipai/plugin-sdk'].version === '2026.1106.0'
    && pluginLock.packages['node_modules/@paperclipai/plugin-sdk'].integrity === 'sha512-dmRBcyEIsqKAxBfrqwVGNxnARCwsGCt2bhrch49E0jhGzo0wwn501W9B3YADggSTSbm81FxMu8/G9z/jDrNeKA==', 'exact_plugin_sdk');
  write(output, 'plugin-package-lock.json', fs.readFileSync(path.join(packageRoot, 'package-lock.json')));
  await run('plugin-typecheck', 'npm', ['run', 'typecheck'], packageRoot, 120);
  const tap = (await run('plugin-domain', 'npm', ['test'], packageRoot, 120)).toString();
  need(/^# tests 12$/m.test(tap) && /^# pass 12$/m.test(tap) && /^# fail 0$/m.test(tap) && /^# skipped 0$/m.test(tap), 'twelve_authored_harness_checks');
  report.unit = { tests: 12, passed: 12, failed: 0 };
  report.cases.push(...Array.from({ length: 12 }, (_, index) => ({ id: 'H' + String(index + 1).padStart(2, '0'), passed: true })));
  await run('plugin-build', 'npm', ['run', 'build'], packageRoot, 120);
  const packed = JSON.parse((await run('plugin-pack', 'npm', ['pack', '--ignore-scripts', '--json', '--pack-destination', path.join(root, 'artifacts')], packageRoot, 60)).toString());
  need(packed.length === 1 && packed[0].name === '@alvarovillalbaa/agents-os-harness' && packed[0].version === '0.1.0', 'actual_package_identity');
  const metadata = packed[0], archive = path.join(root, 'artifacts', metadata.filename);
  need(path.basename(archive) === metadata.filename && /^[a-z0-9.-]+\.tgz$/.test(metadata.filename), 'owned_archive_name');
  const archiveRaw = fs.readFileSync(archive); need(archiveRaw.length <= 2 * 1024 * 1024
    && 'sha512-' + createHash('sha512').update(archiveRaw).digest('base64') === metadata.integrity, 'actual_archive_integrity');
  const members = (await run('package-list', 'tar', ['-tzf', archive], root, 30)).toString().trim().split('\n').sort();
  const expected = metadata.files.map(file => 'package/' + file.path).sort();
  need(metadata.files.length <= 100 && JSON.stringify(members) === JSON.stringify(expected)
    && members.every(name => /^package\/[a-zA-Z0-9._/-]+$/.test(name) && !name.split('/').includes('..')), 'exact_package_members');
  await run('package-extract', 'tar', ['-xzf', archive, '-m', '-C', installedRoot], root, 30);
  const extracted = path.join(installedRoot, 'package');
  const payload = metadata.files.map(item => {
    const actual = fs.readFileSync(path.join(extracted, item.path)), original = fs.readFileSync(path.join(packageRoot, item.path));
    need(actual.equals(original) && actual.length === item.size && !fs.lstatSync(path.join(extracted, item.path)).isSymbolicLink(), 'packaged_file_bytes');
    return { path: item.path, bytes: actual.length, sha256: hash(actual), mode: item.mode };
  });
  need(payload.some(file => file.path === 'dist/worker.js') && payload.some(file => file.path === 'dist/ui/index.js')
    && payload.some(file => file.path === 'dist/THIRD_PARTY_LICENSES.txt'), 'required_package_surfaces');
  write(output, 'agents-os-harness-0.1.0.tgz', archiveRaw);
  write(output, 'packaged-files.json', { sourceCommit, name: metadata.name, version: metadata.version, integrity: metadata.integrity, archiveBytes: archiveRaw.length, archiveSha256: hash(archiveRaw), files: payload });
  env.AGENTS_OS_PLUGIN_PACKAGE = extracted;
  report.package = { archive: 'agents-os-harness-0.1.0.tgz', integrity: metadata.integrity, files: payload.length, sha256: hash(archiveRaw), actualExtractedPackage: true };
  guard('after-package-build');
  await run('previous-package-download', process.execPath, ['checks/previous-package.mjs'], source, 60);
  const previousArchive = path.join(root, 'artifacts/missions-0.2.0.tgz');
  const previousMembers = (await run('previous-package-list', 'tar', ['-tzf', previousArchive], root, 30)).toString().trim().split('\n').sort();
  need(JSON.stringify(previousMembers) === JSON.stringify(['LICENSE', 'README.md', 'dist/manifest.js', 'dist/THIRD_PARTY_LICENSES.txt', 'dist/ui/index.js', 'dist/worker.js', 'migrations/001_contacts.sql', 'migrations/002_missions.sql', 'package.json'].map(name => 'package/' + name).sort()), 'previous_exact_members');
  await run('previous-package-extract', 'tar', ['-xzf', previousArchive, '-C', path.join(root, 'previous')], root, 30);
  env.AGENTS_OS_PREVIOUS_PACKAGE = path.join(root, 'previous/package');
  const adminUrl = new URL(process.env.EVAL_POSTGRES_ADMIN_URL); need(adminUrl.hostname === '127.0.0.1' && adminUrl.port === '5432' && adminUrl.pathname === '/postgres', 'isolated_admin_database_required');
  need(/^\d+$/.test(process.env.GITHUB_RUN_ID ?? '') && /^\d+$/.test(process.env.GITHUB_RUN_ATTEMPT ?? ''), 'run_identity');
  dbName = 'agents_os_harness_' + process.env.GITHUB_RUN_ID + '_' + process.env.GITHUB_RUN_ATTEMPT; need(/^[a-z0-9_]{1,63}$/.test(dbName), 'database_name');
  const postgres = requireTool('postgres'); admin = postgres(adminUrl.href, { max: 1, prepare: false, connect_timeout: 10 });
  need((await admin`SELECT datname FROM pg_database WHERE datname = ${dbName}`).length === 0, 'database_already_exists');
  await admin.unsafe('CREATE DATABASE "' + dbName + '"'); report.database.created = true;
  await admin.unsafe('COMMENT ON DATABASE "' + dbName + '" IS \'' + nonce + '\'');
  report.database.name = dbName; report.database.ownerMarkerSha256 = hash(nonce);
  const databaseUrl = new URL(adminUrl); databaseUrl.pathname = '/' + dbName;
  const configFile = path.join(root, 'paperclip-config.json');
  const config = { $meta: { version: 1, updatedAt: new Date().toISOString(), source: 'configure' }, database: { mode: 'postgres', connectionString: databaseUrl.href, backup: { enabled: false } },
    logging: { mode: 'file', logDir: path.join(root, 'logs') }, server: { deploymentMode: 'local_trusted', exposure: 'private', bind: 'loopback', host: '127.0.0.1', port: 4315, serveUi: true },
    telemetry: { enabled: false }, updates: { checkEnabled: false }, storage: { provider: 'local_disk', localDisk: { baseDir: path.join(root, 'storage') } },
    secrets: { provider: 'local_encrypted', localEncrypted: { keyFilePath: path.join(root, 'home/master.key') } } };
  fs.writeFileSync(configFile, JSON.stringify(config), { flag: 'wx', mode: 0o600 });
  const jwtSecret = randomBytes(32).toString('hex'), masterKey = randomBytes(32).toString('base64'); secrets.push(jwtSecret, masterKey);
  Object.assign(env, { NODE_ENV: 'production', PAPERCLIP_HOME: path.join(root, 'home'), PAPERCLIP_INSTANCE_ID: 'evaluation', PAPERCLIP_CONFIG: configFile,
    DATABASE_URL: databaseUrl.href, PAPERCLIP_MIGRATION_AUTO_APPLY: 'true', PAPERCLIP_MIGRATION_PROMPT: 'never', PAPERCLIP_BIND: 'loopback', HOST: '127.0.0.1', PORT: '4315',
    PAPERCLIP_DEPLOYMENT_MODE: 'local_trusted', PAPERCLIP_DEPLOYMENT_EXPOSURE: 'private', PAPERCLIP_API_URL: 'http://127.0.0.1:4315/api', SERVE_UI: 'true',
    HEARTBEAT_SCHEDULER_ENABLED: 'false', PAPERCLIP_ANNOUNCEMENTS_ENABLED: 'false', PAPERCLIP_AGENT_JWT_SECRET: jwtSecret, PAPERCLIP_SECRETS_MASTER_KEY: masterKey });
  fs.copyFileSync(path.join(source, 'checks/start-paperclip.mjs'), path.join(toolsRoot, 'start-paperclip.mjs'));
  await startServer('paperclip-first');
  report.host.origin = 'http://127.0.0.1:4315'; report.host.mode = 'local_trusted/private';
  await run('harness-api-core', process.execPath, ['checks/api.mjs', 'core'], source, 240);
  const core = JSON.parse(fs.readFileSync(path.join(output, 'harness-api-core.json')));
  need(core.passed && core.cases.length === 9, 'nine_actual_harness_core_cases');
  report.cases.push(...core.cases); guard('after-harness-api');
  await stopServer(); await startServer('paperclip-restarted');
  await run('harness-api-restart', process.execPath, ['checks/api.mjs', 'restart'], source, 120);
  const restart = JSON.parse(fs.readFileSync(path.join(output, 'harness-api-restart.json')));
  need(restart.passed && restart.cases.length === 2, 'two_actual_harness_restart_cases');
  report.cases.push(...restart.cases); guard('after-restart');
  await run('harness-browser', process.execPath, ['checks/browser.mjs'], source, 240);
  const browser = JSON.parse(fs.readFileSync(path.join(output, 'harness-browser.json')));
  need(browser.passed && browser.browserClosed && browser.cases.length === 4
    && browser.cases.every(row => row.passed && !row.errors.length && row.contextsClosed === 1 && row.captures.length === 2
      && row.captures.filter(capture => capture.png).length === 1), 'four_actual_harness_browser_cases');
  report.cases.push(...browser.cases.map(row => ({ id: row.id, passed: row.passed, width: row.width, contextsClosed: row.contextsClosed })));
  report.browser = { version: browser.version, cases: 4, dom: 8, png: 4, browserClosed: true }; guard('after-browser');
  await stopServer();
  const size = await admin`SELECT pg_database_size(${dbName}) AS bytes`; need(Number(size[0].bytes) <= 256 * 1024 * 1024, 'database_size_bound'); report.database.bytes = Number(size[0].bytes);
  report.runtime = runtimeBound(); need(report.cases.length === 27 && new Set(report.cases.map(row => row.id)).size === 27 && report.cases.every(row => row.passed), 'twenty_seven_harness_cases'); report.status = 'passed';
} catch (error) {
  report.errors.push(/^[a-zA-Z0-9_-]+$/.test(error.message ?? '') ? error.message : 'controller_error');
  const body = Buffer.from(String(error.stack ?? error)); try { if (body.length <= 1024 * 1024) write(output, 'controller-error.txt', body); } catch { report.errors.push('diagnostic_withheld'); }
} finally {
  if (server) { try { await stopServer(); } catch { report.status = 'failed'; report.errors.push('server_shutdown_failed'); } }
  for (const child of active) child.stop('SIGTERM');
  let owned = []; try { owned = ownedProcesses(); } catch { report.status = 'failed'; report.errors.push('owned_process_scan_failed'); }
  for (const row of owned) { const current = proc(row.pid); if (current && current.start === row.start && current.uid === row.uid) {
    try { process.kill(row.pid, 'SIGTERM'); } catch (error) { if (error.code !== 'ESRCH') report.errors.push('owned_signal_failed'); }
  } }
  for (let n = 0; owned.length && n < 50; n++) { await new Promise(done => setTimeout(done, 100)); try { owned = ownedProcesses(); } catch { break; } }
  const groups = report.commands.filter(row => row.pid && !absent(row.pid)), workers = remainingWorkers();
  if (admin && report.database.created && !active.size && !owned.length && !groups.length && !workers.length) {
    try {
      const marker = await admin`SELECT shobj_description(oid, 'pg_database') AS marker FROM pg_database WHERE datname = ${dbName}`;
      need(marker.length === 1 && marker[0].marker === nonce, 'database_owner_changed');
      await admin`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = ${dbName} AND pid <> pg_backend_pid()`;
      await admin.unsafe('DROP DATABASE "' + dbName + '"'); report.database.removed = (await admin`SELECT datname FROM pg_database WHERE datname = ${dbName}`).length === 0;
    } catch { report.status = 'failed'; report.errors.push('owned_database_cleanup_failed'); }
  }
  if (admin) { try { await admin.end({ timeout: 5 }); } catch { report.status = 'failed'; report.errors.push('admin_connection_close_failed'); } }
  if (baseline && seed && !active.size) { try { guard('terminal-source-check'); } catch { report.status = 'failed'; report.errors.push('terminal_source_guard_failed'); } }
  if (report.status === 'passed' && (report.commands.length !== 17 || report.guards.length !== 7)) { report.status = 'failed'; report.errors.push('complete_pipeline_profile'); }
  report.cleanup = { activeChildren: active.size, remainingOriginalGroups: groups.map(row => row.label), remainingOwnedProcesses: owned.length, remainingOriginalWorkers: workers.length,
    allStreamsComplete: report.commands.every(row => row.closeObserved && row.streams.length === 2 && row.streams.every(stream => stream.complete)),
    databaseRemoved: !report.database.created || report.database.removed, listenerClosed: await portClosed(), rootRemoved: false };
  if (active.size || groups.length || owned.length || workers.length || !report.cleanup.allStreamsComplete || !report.cleanup.databaseRemoved || !report.cleanup.listenerClosed) { report.status = 'failed'; report.errors.push('cleanup_not_proven'); }
  try {
    owner(); let bytes = 0;
    for (const name of fs.readdirSync(output)) { const file = path.join(output, name), stat = fs.lstatSync(file); bytes += stat.size;
      need(stat.isFile() && !stat.isSymbolicLink() && bytes <= 24 * 1024 * 1024, 'packet_bound'); const raw = fs.readFileSync(file); safe(raw); fs.copyFileSync(file, path.join(packet, name), fs.constants.COPYFILE_EXCL); }
    if (!active.size && !groups.length && !owned.length && !workers.length && report.cleanup.databaseRemoved) { fs.rmSync(root, { recursive: true }); report.cleanup.rootRemoved = !fs.existsSync(root); }
  } catch { report.status = 'failed'; report.errors.push('owned_packet_or_cleanup_failed'); }
  report.completedAt = new Date().toISOString(); write(packet, 'receipt.json', report);
  const files = fs.readdirSync(packet).sort().map(name => { const body = fs.readFileSync(path.join(packet, name)); return { name, bytes: body.length, sha256: hash(body) }; });
  write(packet, 'packet-manifest.json', { sourceCommit, workflowCommit, files });
}
console.log(JSON.stringify({ status: report.status, cases: report.cases.length, commands: report.commands.length, errors: report.errors, cleanup: report.cleanup }));
if (report.status !== 'passed') process.exitCode = 1;
