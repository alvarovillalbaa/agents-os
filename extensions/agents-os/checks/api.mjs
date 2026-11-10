// Actual packaged plugin and host APIs against disposable authored data.
import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
const root = process.env.AGENTS_OS_EVAL_ROOT, nonce = process.env.AGENTS_OS_EVAL_NONCE, mode = process.argv[2];
const need = (value, message) => { if (!value) throw new Error(message); };
need(root && nonce && fs.readFileSync(path.join(root, '.owner'), 'utf8') === nonce && ['core', 'restart'].includes(mode), 'owned_crm_fixture_required');
const output = path.join(root, 'output'), origin = 'http://127.0.0.1:4315';
const pluginKey = 'alvarovillalbaa.agents-os', prefix = '/plugins/' + pluginKey + '/api';
const report = { sourceCommit: process.env.SOURCE_COMMIT, mode, passed: false, cases: [], requests: [], errors: [] };
const secrets = [process.env.PAPERCLIP_AGENT_JWT_SECRET, process.env.PAPERCLIP_SECRETS_MASTER_KEY].filter(Boolean);
const hash = value => createHash('sha256').update(value).digest('hex'); let sequence = 0;
function safe(raw) { const text = String(raw); need(!secrets.some(value => text.includes(value)) && !/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/.test(text), 'sensitive_capture'); }
function save(name, value) { const raw = Buffer.from(typeof value === 'string' ? value : JSON.stringify(value, null, 2) + '\n'); safe(raw); fs.writeFileSync(path.join(output, name), raw, { flag: 'wx' }); }
async function api(method, route, body, expected = [200, 201], token, sensitive = false) {
  const current = ++sequence;
  need(current <= 240 && route.startsWith('/') && !route.includes('://'), 'api_scope_bound');
  const response = await fetch(origin + '/api' + route, { method, redirect: 'error', signal: AbortSignal.timeout(20000),
    headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const raw = Buffer.from(await response.arrayBuffer()); need(raw.length <= 1024 * 1024, 'api_response_bound');
  const value = raw.length ? JSON.parse(raw.toString()) : null, filename = `api-${mode}-${String(current).padStart(3, '0')}.json`;
  if (sensitive) {
    need(response.status === 201 && typeof value.token === 'string' && value.token.length > 16, 'generated_agent_key'); secrets.push(value.token);
    fs.writeFileSync(path.join(root, 'generated-secrets.json'), JSON.stringify(secrets), { mode: 0o600 });
    save(filename, { sensitiveBodyWithheld: true, reason: 'One-time disposable agent key', responseSha256: hash(raw), id: value.id, status: response.status });
  } else { safe(raw); fs.writeFileSync(path.join(output, filename), raw, { flag: 'wx' }); }
  report.requests.push({ method, route, status: response.status, capture: filename, capturedBytes: fs.statSync(path.join(output, filename)).size,
    responseBytes: raw.length, responseSha256: hash(raw), originalBodyRetained: !sensitive, cacheControl: response.headers.get('cache-control') });
  need(expected.includes(response.status), 'unexpected_http_' + response.status);
  if (route.startsWith(prefix)) need(response.headers.get('cache-control')?.includes('no-store') || response.status >= 400, 'crm_no_store');
  return value;
}
const crm = (companyId, method, route, body, expected, token) => api(method, prefix + route + '?companyId=' + companyId, body, expected, token);
const fields = { name: 'Authored Contact', organization: 'Example Studio', email: 'contact@example.test', phone: '+34 000 000 000',
  stage: 'active', notes: 'Authored private note\nSecond line', nextStep: 'Review authored proposal', followUpDate: '2026-12-15' };
const createBody = value => ({ id: randomUUID(), operationId: randomUUID(), ...value });
const mutation = (contact, patch = {}) => ({ operationId: randomUUID(), revision: contact.revision, ...fields, ...patch });
const sameFields = (actual, expected) => Object.keys(expected).every(key => actual[key] === expected[key]);
function passed(id, details = {}) { report.cases.push({ id, passed: true, ...details }); }

try {
  if (mode === 'core') {
    const company = await api('POST', '/companies', { name: 'Agents OS CRM Checks', description: 'Disposable authored CRM fixtures.' });
    const other = await api('POST', '/companies', { name: 'Other Authored Company', description: 'Disposable scope boundary.' });
    const issue = await api('POST', '/companies/' + company.id + '/issues', { title: 'Authored follow-up task', status: 'todo', assigneeUserId: company.defaultResponsibleUserId });
    const foreignIssue = await api('POST', '/companies/' + other.id + '/issues', { title: 'Other company task', status: 'todo', assigneeUserId: other.defaultResponsibleUserId });
    const installed = await api('POST', '/plugins/install', { packageName: process.env.AGENTS_OS_PLUGIN_PACKAGE, isLocalPath: true });
    need(installed.pluginKey === pluginKey && installed.status === 'ready', 'actual_plugin_install');
    let healthy;
    for (let n = 0; n < 50; n++) {
      healthy = await api('GET', '/plugins/' + pluginKey + '/health');
      if (healthy.status === 'ready' && healthy.healthy === true) break;
      await new Promise(done => setTimeout(done, 300));
    }
    need(healthy?.status === 'ready' && healthy.healthy === true && healthy.checks.every(check => check.passed), 'actual_plugin_health');
    const dashboard = await api('GET', '/plugins/' + pluginKey + '/dashboard');
    const pid = dashboard.worker?.pid; need(Number.isInteger(pid) && pid > 1, 'actual_worker_pid');
    const stat = fs.readFileSync(`/proc/${pid}/stat`, 'utf8').split(') ').at(-1).split(' ');
    const worker = { pid, start: stat[19], pgid: Number(stat[2]), sid: Number(stat[3]) };
    save('plugin-worker-identity.json', worker);
    passed('I01', { pluginId: installed.id, pluginKey, worker });

    const originalCreate = createBody(fields);
    let response = await crm(company.id, 'POST', '/contacts', originalCreate), contact = response.contact;
    need(sameFields(contact, fields) && contact.revision === 1 && !contact.activityPending, 'created_contact_fields');
    passed('I02', { contactId: contact.id, revision: 1 });
    for (const patch of [{ email: 'invalid' }, { followUpDate: '2026-02-30' }, { notes: 'a'.repeat(6001) }, { companyId: other.id }]) {
      const body = createBody({ ...fields, ...patch }); await crm(company.id, 'POST', '/contacts', body, [400]);
      await crm(company.id, 'GET', '/contacts/' + body.id, undefined, [404]);
    }
    passed('I03', { rejectedInputs: 4, noRowsCreated: true });
    const replay = await crm(company.id, 'POST', '/contacts', originalCreate);
    need(replay.replayed && replay.contact.id === contact.id && replay.contact.revision === 1, 'create_replay');
    const edit = mutation(contact, { notes: 'Confirmed authored edit' });
    response = await crm(company.id, 'PATCH', '/contacts/' + contact.id, edit); contact = response.contact;
    need(contact.revision === 2 && contact.notes === edit.notes, 'contact_edit');
    const editReplay = await crm(company.id, 'PATCH', '/contacts/' + contact.id, edit);
    need(editReplay.replayed && editReplay.contact.revision === 2, 'edit_replay');
    await crm(company.id, 'PATCH', '/contacts/' + contact.id, { ...edit, notes: 'Different payload' }, [409]);
    passed('I04', { createAndEditReplay: true, changedReplayRejected: true });
    await crm(company.id, 'PATCH', '/contacts/' + contact.id, { ...edit, operationId: randomUUID() }, [409]);
    const contenderA = mutation(contact, { nextStep: 'Concurrent contender A' }), contenderB = mutation(contact, { nextStep: 'Concurrent contender B' });
    const competing = await Promise.all([contenderA, contenderB].map(body => crm(company.id, 'PATCH', '/contacts/' + contact.id, body, [200, 409])));
    need(competing.filter(row => row.contact).length === 1 && competing.filter(row => row.error).length === 1, 'concurrent_cas');
    contact = (await crm(company.id, 'GET', '/contacts/' + contact.id)).contact; need(contact.revision === 3, 'single_concurrent_revision');
    passed('I05', { staleRejected: true, concurrentWinners: 1, revision: contact.revision });

    const foreign = await crm(other.id, 'POST', '/contacts', createBody({ ...fields, name: 'Other authored contact', email: 'other@example.test' }));
    await crm(other.id, 'GET', '/contacts/' + contact.id, undefined, [404]);
    await crm(other.id, 'PATCH', '/contacts/' + contact.id, mutation(contact), [404]);
    await crm(company.id, 'GET', '/contacts/' + foreign.contact.id, undefined, [404]);
    const agent = await api('POST', '/companies/' + company.id + '/agents', { name: 'CRM Scope Fixture', role: 'ceo', adapterType: 'process', runner: 'legacy',
      adapterConfig: { command: process.execPath, args: ['--version'], cwd: path.join(root, 'worker') }, runtimeConfig: { heartbeat: { enabled: false, wakeOnDemand: false } } });
    for (let n = 0; n < 50; n++) {
      const current = await api('GET', '/agents/' + agent.id); if (current.status === 'idle' && (current.lifecycleState === undefined || current.lifecycleState === 'ready')) break;
      need(!['error', 'terminated'].includes(current.status), 'agent_scope_setup'); await new Promise(done => setTimeout(done, 300));
    }
    const key = await api('POST', '/agents/' + agent.id + '/keys', { name: 'Disposable CRM scope check' }, [201], undefined, true);
    const authenticatedAgent = await api('GET', '/agents/' + agent.id, undefined, [200], key.token); need(authenticatedAgent.id === agent.id, 'valid_agent_authentication');
    await crm(company.id, 'POST', '/contacts/search', { q: '', mode: 'all', offset: '0' }, [403], key.token);
    await crm(other.id, 'POST', '/contacts/search', { q: '', mode: 'all', offset: '0' }, [403], key.token);
    await api('DELETE', '/agents/' + agent.id + '/keys/' + key.id);
    passed('I06', { companyScope404s: 3, validAgentRead: true, agentCrm403s: 2, disposableKeyRevoked: true, sensitiveKeyBodyWithheld: true });

    await crm(company.id, 'POST', '/contacts/' + contact.id + '/tasks', { revision: contact.revision, operationId: randomUUID(), issueId: foreignIssue.id, linked: true }, [404]);
    response = await crm(company.id, 'POST', '/contacts/' + contact.id + '/tasks', { revision: contact.revision, operationId: randomUUID(), issueId: issue.id, linked: true }); contact = response.contact;
    need(response.tasks.length === 1 && response.tasks[0].id === issue.id && response.tasks[0].title === issue.title, 'native_task_link');
    const unlink = await crm(company.id, 'POST', '/contacts/' + contact.id + '/tasks', { revision: contact.revision, operationId: randomUUID(), issueId: issue.id, linked: false }); contact = unlink.contact;
    need(unlink.tasks.length === 0 && (await api('GET', '/issues/' + issue.id)).id === issue.id, 'unlink_preserves_native_task');
    response = await crm(company.id, 'POST', '/contacts/' + contact.id + '/tasks', { revision: contact.revision, operationId: randomUUID(), issueId: issue.id, linked: true }); contact = response.contact;
    passed('I07', { nativeTaskId: issue.id, otherCompanyTaskRejected: true, unlinkPreservedTask: true });
    contact = (await crm(company.id, 'POST', '/contacts/' + contact.id + '/archive', { revision: contact.revision, operationId: randomUUID(), archived: true })).contact;
    need(contact.archivedAt, 'archive_timestamp');
    const active = await crm(company.id, 'POST', '/contacts/search', { q: fields.email, mode: 'active' });
    const archived = await crm(company.id, 'POST', '/contacts/search', { q: fields.email, mode: 'archived' });
    need(active.contacts.length === 0 && archived.contacts.some(row => row.id === contact.id), 'archive_search');
    await crm(company.id, 'PATCH', '/contacts/' + contact.id, mutation(contact), [409]);
    contact = (await crm(company.id, 'POST', '/contacts/' + contact.id + '/archive', { revision: contact.revision, operationId: randomUUID(), archived: false })).contact;
    need(contact.archivedAt === null, 'restored_contact'); passed('I08', { archiveAndRestore: true, archivedEditRejected: true });
    const seeded = [];
    for (let n = 0; n < 31; n++) seeded.push((await crm(company.id, 'POST', '/contacts', createBody({ ...fields, name: 'Authored Page ' + n, email: '', notes: '' }))).contact.id);
    const page1 = await crm(company.id, 'POST', '/contacts/search', { q: 'Authored Page', offset: '0' });
    const page2 = await crm(company.id, 'POST', '/contacts/search', { q: 'Authored Page', offset: '30' });
    need(page1.contacts.length === 30 && page1.hasMore && page2.contacts.length === 1 && !page2.hasMore
      && new Set([...page1.contacts, ...page2.contacts].map(row => row.id)).size === 31, 'actual_contact_pagination');
    const literal = await crm(company.id, 'POST', '/contacts/search', { q: "' OR 1=1", mode: 'all' }); need(literal.contacts.length === 0, 'parameterized_search');
    passed('I09', { created: seeded.length, pageSizes: [30, 1], distinct: 31, searchLiteral: true });
    const current = await crm(company.id, 'GET', '/contacts/' + contact.id); contact = current.contact;
    const activity = await api('GET', '/companies/' + company.id + '/activity?limit=500');
    const activityText = JSON.stringify(activity);
    need(contact.audit.every(event => activityText.includes(event.id)) && !contact.activityPending
      && !activityText.includes(fields.email) && !activityText.includes(fields.notes) && !activityText.includes(fields.phone), 'content_free_activity_delivery');
    passed('I10', { journalEvents: contact.audit.length, delivered: true, noContactFieldsInActivity: true });
    const state = { sourceCommit: process.env.SOURCE_COMMIT, company, other: { id: other.id }, pluginId: installed.id, worker, contact, issue: { id: issue.id, identifier: issue.identifier, title: issue.title }, seededContactIds: seeded };
    fs.writeFileSync(path.join(root, 'crm-state.json'), JSON.stringify(state), { flag: 'wx' }); save('crm-state.json', state);
  } else {
    const state = JSON.parse(fs.readFileSync(path.join(root, 'crm-state.json')));
    let dashboard;
    for (let n = 0; n < 50; n++) {
      dashboard = await api('GET', '/plugins/' + pluginKey + '/dashboard');
      if (dashboard.worker?.status === 'running' && Number.isInteger(dashboard.worker.pid)) break;
      await new Promise(done => setTimeout(done, 200));
    }
    const pid = dashboard?.worker?.pid;
    need(dashboard?.worker?.status === 'running' && Number.isInteger(pid), 'restarted_worker_ready');
    const stat = fs.readFileSync(`/proc/${pid}/stat`, 'utf8').split(') ').at(-1).split(' ');
    need(pid !== state.worker.pid || stat[19] !== state.worker.start, 'new_worker_after_actual_restart');
    save('plugin-restarted-worker-identity.json', { pid, start: stat[19], pgid: Number(stat[2]), sid: Number(stat[3]) });
    const actual = await crm(state.company.id, 'GET', '/contacts/' + state.contact.id);
    need(actual.contact.id === state.contact.id && actual.contact.revision === state.contact.revision
      && sameFields(actual.contact, fieldsOfState(state.contact)) && actual.tasks.some(row => row.id === state.issue.id)
      && actual.contact.audit.length === state.contact.audit.length && !actual.contact.activityPending, 'actual_restart_contact');
    const page1 = await crm(state.company.id, 'POST', '/contacts/search', { q: 'Authored Page', offset: '0' });
    const page2 = await crm(state.company.id, 'POST', '/contacts/search', { q: 'Authored Page', offset: '30' });
    need([...page1.contacts, ...page2.contacts].every(row => state.seededContactIds.includes(row.id)) && page1.contacts.length + page2.contacts.length === 31, 'restart_seeded_contacts');
    const plugin = await api('GET', '/plugins/' + pluginKey); need(plugin.status === 'ready', 'plugin_restored_after_server_restart');
    try { const stat = fs.readFileSync(`/proc/${state.worker.pid}/stat`, 'utf8').split(') ').at(-1).split(' '); need(stat[19] !== state.worker.start, 'old_worker_absence'); }
    catch (error) { if (!['ENOENT', 'ESRCH'].includes(error.code)) throw error; }
    passed('I11', { actualServerRestart: true, sameContactAndTaskLink: true, seededContacts: 31, journalRetained: true, originalWorkerAbsent: true });
  }
  report.passed = report.cases.length === (mode === 'core' ? 10 : 1) && report.cases.every(row => row.passed);
} catch (error) { report.errors.push(String(error.stack ?? error)); }
finally { save('crm-api-' + mode + '.json', report); }
if (!report.passed) process.exitCode = 1;
function fieldsOfState(contact) { return Object.fromEntries(Object.keys(fields).map(key => [key, contact[key]])); }
