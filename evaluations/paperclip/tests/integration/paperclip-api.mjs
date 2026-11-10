// T2 authored workflow + T3 newly owned PostgreSQL. No public or model endpoints.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
const need = (value, message) => { if (!value) throw new Error(message); };
const root = process.env.AGENTS_OS_EVAL_ROOT, nonce = process.env.AGENTS_OS_EVAL_NONCE, mode = process.argv[2];
need(root && path.isAbsolute(root) && nonce && fs.readFileSync(path.join(root, '.owner'), 'utf8') === nonce && ['core', 'restart'].includes(mode), 'owned_eval_required');
const output = path.join(root, 'output'), origin = 'http://127.0.0.1:4315';
const report = { mode, sourceCommit: process.env.SOURCE_COMMIT, passed: false, cases: [], requests: [], errors: [] };
const hash = value => createHash('sha256').update(value).digest('hex');
const sensitive = [process.env.PAPERCLIP_AGENT_JWT_SECRET, process.env.PAPERCLIP_SECRETS_MASTER_KEY].filter(Boolean);
const comment = 'Authored operator review: the deterministic fixture is complete; no AI result is claimed.';
let sequence = 0;
function safe(body) {
  need(!sensitive.some(secret => body.includes(secret)) && !/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/.test(body), 'secret_bearing_capture');
}
async function api(method, route, body, statuses = [200, 201, 202]) {
  need(++sequence <= 120 && route.startsWith('/') && !route.includes('://'), 'request_scope');
  const response = await fetch(origin + '/api' + route, { method, redirect: 'error', signal: AbortSignal.timeout(15000),
    headers: body === undefined ? {} : { 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const chunks = []; let bytes = 0;
  for await (const chunk of response.body) { bytes += chunk.length; need(bytes <= 1024 * 1024, 'api_body_bound'); chunks.push(chunk); }
  const raw = Buffer.concat(chunks), text = raw.toString(); safe(text);
  const filename = `api-${mode}-${String(sequence).padStart(3, '0')}.json`;
  fs.writeFileSync(path.join(output, filename), raw, { flag: 'wx' });
  report.requests.push({ method, route, status: response.status, body: filename, bytes, sha256: hash(raw) });
  need(statuses.includes(response.status), 'unexpected_api_status_' + response.status);
  return { status: response.status, value: text ? JSON.parse(text) : null };
}
const id = value => { need(/^[a-f0-9-]{36}$/.test(value ?? ''), 'record_uuid'); return value; };
async function commentsContain(taskId) {
  const { value } = await api('GET', '/issues/' + id(taskId) + '/comments');
  const rows = Array.isArray(value) ? value : value.items ?? value.comments;
  need(Array.isArray(rows) && rows.some(row => row.body === comment), 'persisted_operator_comment');
}
try {
  if (mode === 'core') {
    const company = (await api('POST', '/companies', { name: 'Agents OS Evaluation', description: 'Disposable authored Paperclip prerequisite.', budgetMonthlyCents: 0 })).value;
    id(company.id); need(/^[A-Z][A-Z0-9]{1,12}$/.test(company.issuePrefix), 'company_route_prefix');
    need(company.defaultResponsibleUserId === 'local-board', 'trusted_fixture_operator');
    const goal = (await api('POST', '/companies/' + company.id + '/goals', { title: 'Evaluate the control plane', description: 'An authored prerequisite; no autonomous research claim.', level: 'company', status: 'active' })).value;
    const project = (await api('POST', '/companies/' + company.id + '/projects', { name: 'Agents OS prerequisite', description: 'Authored local fixture.', goalIds: [id(goal.id)], status: 'in_progress' })).value;
    const task = (await api('POST', '/companies/' + company.id + '/issues', { title: 'Review the Paperclip prerequisite', description: 'Move this authored operator task through its states.', projectId: id(project.id), goalId: goal.id, assigneeUserId: company.defaultResponsibleUserId, status: 'todo', priority: 'medium' })).value;
    id(task.id);
    await api('PATCH', '/issues/' + task.id, { status: 'in_progress' });
    await api('PATCH', '/issues/' + task.id, { status: 'done', comment });
    const actual = (await api('GET', '/issues/' + task.id)).value;
    need(actual.status === 'done' && actual.projectId === project.id && actual.goalId === goal.id && actual.companyId === company.id
      && actual.assigneeUserId === company.defaultResponsibleUserId && actual.assigneeAgentId === null, 'linked_operator_task');
    await commentsContain(task.id);
    report.cases.push({ id: 'P03', passed: true, companyId: company.id, goalId: goal.id, projectId: project.id, taskId: task.id, manualOperatorTransitions: ['todo', 'in_progress', 'done'] });
    const agent = (await api('POST', '/companies/' + company.id + '/agents', { name: 'Fixture Coordinator', role: 'ceo', title: 'Authored deterministic process', capabilities: 'Writes one owned fixture event; no model or API call.', adapterType: 'process', runner: 'legacy',
      adapterConfig: { command: process.execPath, args: [path.join(root, 'source/tests/fixtures/process-agent.mjs')], cwd: path.join(root, 'worker'), env: { AGENTS_OS_EVAL_ROOT: root, AGENTS_OS_EVAL_NONCE: nonce }, timeoutSec: 20, graceSec: 3 },
      runtimeConfig: { heartbeat: { enabled: false, wakeOnDemand: true } }, budgetMonthlyCents: 0 })).value;
    id(agent.id); let ready = false;
    for (let n = 0; n < 60; n++) {
      const current = (await api('GET', '/agents/' + agent.id)).value;
      if (current.status === 'idle' && (current.lifecycleState === undefined || current.lifecycleState === 'ready')) { ready = true; break; }
      need(!['error', 'terminated'].includes(current.status), 'agent_setup_failed'); await new Promise(done => setTimeout(done, 500));
    }
    need(ready, 'agent_setup_not_ready');
    const invoked = (await api('POST', '/agents/' + agent.id + '/heartbeat/invoke', {})).value; id(invoked.id);
    let run;
    for (let n = 0; n < 60; n++) {
      run = (await api('GET', '/heartbeat-runs/' + invoked.id)).value;
      if (run.status === 'succeeded') break;
      need(['queued', 'running'].includes(run.status), 'process_run_failed'); await new Promise(done => setTimeout(done, 500));
    }
    need(run?.status === 'succeeded' && run.agentId === agent.id && run.companyId === company.id, 'actual_process_run');
    const eventsFile = path.join(root, 'worker/events.jsonl'), events = fs.readFileSync(eventsFile, 'utf8').trim().split('\n').map(JSON.parse);
    need(events.length === 1 && events[0].companyId === company.id && events[0].agentId === agent.id && events[0].runId === run.id && events[0].apiCredentialInjected, 'actual_process_context');
    try { const raw = fs.readFileSync(`/proc/${events[0].pid}/stat`, 'utf8'), start = raw.split(') ').at(-1).split(' ')[19]; need(start !== events[0].start, 'original_worker_still_alive'); }
    catch (error) { if (!['ENOENT', 'ESRCH'].includes(error.code)) throw error; }
    const log = (await api('GET', '/heartbeat-runs/' + run.id + '/log?offset=0&limitBytes=65536')).value;
    need(typeof log.content === 'string' && log.content.includes('AGENTS_OS_PROCESS_OK'), 'actual_process_log');
    report.cases.push({ id: 'P04', passed: true, companyId: company.id, agentId: agent.id, runId: run.id, status: run.status, worker: events[0], actualLogMarker: true });
    await api('POST', '/agents/' + agent.id + '/pause', {});
    const paused = (await api('GET', '/agents/' + agent.id)).value; need(paused.status === 'paused', 'agent_not_paused');
    const rejected = await api('POST', '/agents/' + agent.id + '/heartbeat/invoke', {}, [409]);
    need(/paused/i.test(JSON.stringify(rejected.value)) && fs.readFileSync(eventsFile, 'utf8').trim().split('\n').length === 1, 'paused_run_not_rejected');
    const runs = (await api('GET', '/companies/' + company.id + '/heartbeat-runs?agentId=' + agent.id + '&limit=10')).value;
    need(Array.isArray(runs) && runs.length === 1 && runs[0].id === run.id, 'unexpected_additional_run');
    report.cases.push({ id: 'P05', passed: true, status: paused.status, rejectedHttpStatus: rejected.status, processExecutions: 1, runCount: 1 });
    const state = { sourceCommit: process.env.SOURCE_COMMIT, company: { id: company.id, name: company.name, issuePrefix: company.issuePrefix },
      goal: { id: goal.id, title: goal.title }, project: { id: project.id, name: project.name }, task: { id: task.id, title: task.title },
      agent: { id: agent.id, name: agent.name }, run: { id: run.id }, worker: events[0], comment };
    fs.writeFileSync(path.join(root, 'state.json'), JSON.stringify(state, null, 2) + '\n', { flag: 'wx' });
    fs.writeFileSync(path.join(output, 'fixture-state.json'), JSON.stringify(state, null, 2) + '\n', { flag: 'wx' });
  } else {
    const state = JSON.parse(fs.readFileSync(path.join(root, 'state.json')));
    const reads = [
      ['/companies/' + state.company.id, value => value.id === state.company.id && value.name === state.company.name],
      ['/goals/' + state.goal.id, value => value.id === state.goal.id && value.title === state.goal.title],
      ['/projects/' + state.project.id, value => value.id === state.project.id && value.name === state.project.name],
      ['/issues/' + state.task.id, value => value.id === state.task.id && value.status === 'done' && value.projectId === state.project.id && value.goalId === state.goal.id],
      ['/agents/' + state.agent.id, value => value.id === state.agent.id && value.status === 'paused' && value.adapterType === 'process'],
      ['/heartbeat-runs/' + state.run.id, value => value.id === state.run.id && value.status === 'succeeded'],
    ];
    for (const [route, assertion] of reads) need(assertion((await api('GET', route)).value), 'restart_persistence');
    await commentsContain(state.task.id);
    need(fs.readFileSync(path.join(root, 'worker/events.jsonl'), 'utf8').trim().split('\n').length === 1, 'unexpected_restart_execution');
    report.cases.push({ id: 'P06', passed: true, actualServerRestart: true, records: reads.length, commentRetained: true, processExecutions: 1 });
  }
  report.passed = report.cases.length === (mode === 'core' ? 3 : 1) && report.cases.every(row => row.passed);
} catch (error) { report.errors.push(String(error.stack ?? error)); }
finally {
  const body = JSON.stringify(report, null, 2) + '\n'; safe(body); need(Buffer.byteLength(body) <= 1024 * 1024, 'api_report_bound');
  fs.writeFileSync(path.join(output, 'paperclip-api-' + mode + '.json'), body, { flag: 'wx' });
}
if (!report.passed) process.exitCode = 1;
