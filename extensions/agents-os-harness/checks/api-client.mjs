import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
export const need = (value, message) => { if (!value) throw new Error(message); };
export const hash = value => createHash('sha256').update(value).digest('hex');
export function fixtureClient(tag) {
  const root = process.env.AGENTS_OS_EVAL_ROOT, nonce = process.env.AGENTS_OS_EVAL_NONCE;
  need(root && nonce && fs.readFileSync(path.join(root, '.owner'), 'utf8') === nonce && /^[a-z-]+$/.test(tag), 'owned_mission_fixture_required');
  const output = path.join(root, 'output'), origin = 'http://127.0.0.1:4315', pluginKey = 'alvarovillalbaa-agents-os-harness', prefix = '/plugins/' + pluginKey + '/api';
  const report = { sourceCommit: process.env.SOURCE_COMMIT, tag, passed: false, cases: [], requests: [], errors: [] };
  const privateFile = path.join(root, 'generated-secrets.json');
  const secrets = [...(fs.existsSync(privateFile) ? JSON.parse(fs.readFileSync(privateFile)) : []), process.env.PAPERCLIP_AGENT_JWT_SECRET, process.env.PAPERCLIP_SECRETS_MASTER_KEY].filter(Boolean);
  function safe(raw) { const text = String(raw); need(!secrets.some(secret => text.includes(secret)) && !/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/.test(text), 'sensitive_mission_capture'); }
  function save(name, value) { const raw = Buffer.isBuffer(value) ? value : Buffer.from(typeof value === 'string' ? value : JSON.stringify(value, null, 2) + '\n'); safe(raw); need(raw.length <= 1024 * 1024, 'mission_capture_bound'); fs.writeFileSync(path.join(output, name), raw, { flag: 'wx' }); }
  async function api(method, route, body, expected = [200, 201], token, sensitive = false) {
    need(report.requests.length < 300 && route.startsWith('/') && !route.includes('://'), 'mission_api_scope_bound');
    const response = await fetch(origin + '/api' + route, { method, redirect: 'error', signal: AbortSignal.timeout(20_000), headers: {
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(token ? { Authorization: 'Bearer ' + token } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const raw = Buffer.from(await response.arrayBuffer()); need(raw.length <= 1024 * 1024, 'mission_api_response_bound');
    const value = raw.length ? JSON.parse(raw.toString()) : null, filename = `${tag}-${String(report.requests.length + 1).padStart(3, '0')}.json`;
    if (sensitive) {
      need(response.status === 201 && typeof value.token === 'string' && value.token.length > 16, 'disposable_mission_key'); secrets.push(value.token);
      fs.writeFileSync(privateFile, JSON.stringify(secrets), { mode: 0o600 });
      save(filename, { sensitiveBodyWithheld: true, reason: 'One-time disposable agent key', id: value.id, status: response.status, responseSha256: hash(raw) });
    } else save(filename, raw);
    report.requests.push({ method, route, status: response.status, capture: filename, capturedBytes: fs.statSync(path.join(output, filename)).size,
      responseBytes: raw.length, responseSha256: hash(raw), originalBodyRetained: !sensitive });
    need(expected.includes(response.status), 'unexpected_mission_http_' + response.status);
    if (route.startsWith(prefix) && response.status < 400) need(response.headers.get('cache-control')?.includes('no-store'), 'mission_no_store');
    return value;
  }
  const scoped = (companyId, method, route, body, expected, token) => api(method, prefix + route + '?companyId=' + companyId, body, expected, token);
  return { root, output, report, api, scoped, save, pluginKey, pass: (id, details = {}) => report.cases.push({ id, passed: true, ...details }) };
}
