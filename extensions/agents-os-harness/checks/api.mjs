import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fixtureClient, need, hash } from './api-client.mjs';
const mode = process.argv[2]; need(['core', 'restart'].includes(mode), 'harness_api_mode');
const { root, report, api, scoped, save, pluginKey, pass } = fixtureClient('harness-' + mode);
const pack = { packVersion: '0.1.0' }, sharedKey = 'plugin/' + pluginKey + '/mission-work';
const oldKey = 'alvarovillalbaa.agents-os';
const old = (company, method, route, body) => api(method, `/plugins/${oldKey}/api${route}?companyId=${company}`, body);
const identity = pid => { const stat = fs.readFileSync(`/proc/${pid}/stat`, 'utf8').split(') ').at(-1).split(' '); return { pid, start: stat[19], pgid: Number(stat[2]), sid: Number(stat[3]) }; };
async function ready(key, filename) {
  for (let n = 0; n < 80; n++) {
    const current = await api('GET', '/plugins/' + key + '/health');
    if (current.status === 'ready' && current.healthy === true && current.checks.every(row => row.passed)) {
      const dashboard = await api('GET', '/plugins/' + key + '/dashboard');
      if (dashboard.worker?.status === 'running' && Number.isInteger(dashboard.worker.pid)) { const row = identity(dashboard.worker.pid); save(filename, row); return row; }
    }
    await new Promise(done => setTimeout(done, 250));
  }
  throw new Error('native_plugin_not_ready');
}
async function unchanged(state) {
  need(JSON.stringify((await old(state.company.id, 'GET', '/contacts/' + state.contact.id)).contact) === JSON.stringify(state.contact), 'contact_unchanged');
  need(JSON.stringify((await old(state.company.id, 'GET', '/missions/' + state.mission.id)).mission) === JSON.stringify(state.mission), 'mission_unchanged');
}
function narrow(value) {
  const raw = JSON.stringify(value);
  need(!/adapterConfig|runtimeConfig|instructionsRootPath|instructionsFilePath|sourcePath|instanceSecrets|authored-private-config/.test(raw), 'narrow_harness_dto');
  need(value.agents.length === 2 && value.agents.every(row => Object.keys(row).sort().join(',') === 'adapterType,alternativeSkillSelected,approvalId,id,key,name,skillSelected,status'), 'exact_agent_dto');
}
async function nativeAgents(company) { return api('GET', '/companies/' + company + '/agents'); }
try {
  if (mode === 'core') {
    const oldInstalled = await api('POST', '/plugins/install', { packageName: process.env.AGENTS_OS_PREVIOUS_PACKAGE, isLocalPath: true });
    need(oldInstalled.pluginKey === oldKey && oldInstalled.version === '0.2.0', 'frozen_missions_install');
    const oldWorker = await ready(oldKey, 'missions-worker-identity.json');
    const installed = await api('POST', '/plugins/install', { packageName: process.env.AGENTS_OS_PLUGIN_PACKAGE, isLocalPath: true });
    need(installed.pluginKey === pluginKey && installed.version === '0.1.0', 'actual_companion_install');
    const worker = await ready(pluginKey, 'plugin-worker-identity.json');
    need(worker.pid !== oldWorker.pid, 'separate_native_workers'); pass('J01', { actualPackages: ['Missions0.2.0', 'SharedHarness0.1.0'], worker, oldWorker });
    const company = await api('POST', '/companies', { name: 'Authored Harness Company' });
    await api('PATCH', '/companies/' + company.id, { requireBoardApprovalForNewAgents: false });
    const approvalCompany = await api('POST', '/companies', { name: 'Authored Approval Company' });
    const other = await api('PATCH', '/companies/' + approvalCompany.id, { requireBoardApprovalForNewAgents: true });
    const browserCompanies = [];
    for (const name of ['Harness Desktop', 'Harness Narrow', 'Harness Customized', 'Harness Recovery']) {
      const row = await api('POST', '/companies', { name }); await api('PATCH', '/companies/' + row.id, { requireBoardApprovalForNewAgents: false }); browserCompanies.push(row);
    }
    const contact = (await old(company.id, 'POST', '/contacts', { id: randomUUID(), operationId: randomUUID(), name: 'Preserved Harness Contact', organization: 'Authored Studio', email: 'harness@example.test', phone: '', stage: 'active', notes: 'Retain the authored contact exactly.', nextStep: 'Review Mission evidence', followUpDate: null })).contact;
    const task = await api('POST', '/companies/' + company.id + '/issues', { title: 'Harness authored checkpoint', status: 'todo', assigneeUserId: company.defaultResponsibleUserId });
    const mission = (await old(company.id, 'POST', '/missions', { id: randomUUID(), operationId: randomUUID(), plan: { title: 'Harness coexistence Mission', objective: 'Preserve existing coordination while setting up shared agents.', checkpoints: [{ id: randomUUID(), title: 'Authored checkpoint', acceptance: 'Review actual evidence explicitly.', issueId: task.id }] } })).mission;
    const before = await scoped(company.id, 'GET', '/status'); narrow(before); need(before.missingCount === 3 && (await nativeAgents(company.id)).length === 0, 'readonly_empty_harness');
    for (const body of [{ packVersion: 'old' }, { ...pack, reset: true }, { ...pack, companyId: other.id }]) await scoped(company.id, 'POST', '/setup', body, [409]);
    need((await nativeAgents(company.id)).length === 0, 'invalid_setup_no_creation'); pass('J02', { readOnly: true, rejectedRequests: 3 });
    const created = await scoped(company.id, 'POST', '/setup', pack); narrow(created);
    need(created.missingCount === 0 && created.skill.id && created.agents.every(row => row.id && row.skillSelected && row.status === 'paused'), 'paused_shared_team');
    const agents = await nativeAgents(company.id); need(agents.length === 2, 'two_native_agents');
    for (const agent of agents) {
      need(agent.status === 'paused' && agent.runtimeConfig.heartbeat.enabled === false && agent.runtimeConfig.heartbeat.wakeOnDemand === false, 'native_heartbeat_off');
      need(agent.adapterConfig.paperclipSkillSync.desiredSkills.includes(sharedKey), 'native_shared_key');
    }
    pass('J03', { companyId: company.id, skillId: created.skill.id, agentIds: created.agents.map(row => row.id), pausedAndHeartbeatsOff: true });
    const detail = await api('GET', `/companies/${company.id}/skills/${created.skill.id}`);
    const skillFile = await api('GET', `/companies/${company.id}/skills/${created.skill.id}/files?path=SKILL.md`);
    need(detail.key === sharedKey && detail.markdown.includes('Leave evidence and a recoverable handoff') && detail.attachedAgentCount === 2
      && detail.usedByAgents.length === 2 && detail.usedByAgents.every(row => agents.some(agent => agent.id === row.agentId || agent.id === row.id)), 'shared_native_library_binding');
    need(typeof skillFile.content === 'string' && skillFile.content === detail.markdown, 'native_materialized_skill_bytes');
    const instructionFiles = [];
    for (const agent of agents) {
      const file = await api('GET', `/agents/${agent.id}/instructions-bundle/file?path=promptTemplate.legacy.md`);
      need(typeof file.content === 'string' && file.content.includes(sharedKey) && file.content.includes('board'), 'native_initial_role_guidance'); instructionFiles.push(file);
      const snapshot = await api('GET', `/agents/${agent.id}/skills`);
      need(snapshot.supported === true && snapshot.desiredSkills.includes(sharedKey)
        && snapshot.entries.some(row => row.key === sharedKey), 'supported_native_skill_snapshot');
    }
    pass('J04', { attachedAgents: 2, sharedSkillSha256: hash(skillFile.content), nativeSkillSnapshots: 2, instructionSha256: instructionFiles.map(row => hash(row.content)) });
    const contenders = await Promise.all(Array.from({ length: 3 }, () => scoped(company.id, 'POST', '/setup', pack)));
    need(contenders.every(row => JSON.stringify(row) === JSON.stringify(created)) && (await nativeAgents(company.id)).length === 2, 'native_setup_idempotence');
    pass('J05', { simultaneousRequests: 3, nativeAgentCount: 2 });
    const planner = agents.find(row => row.name === 'Mission Planner'); need(planner, 'native_planner');
    const originalInstructions = instructionFiles[agents.findIndex(row => row.id === planner.id)];
    need(typeof originalInstructions.content === 'string' && originalInstructions.content.includes(sharedKey), 'native_initial_inline_instructions');
    const customInstructions = originalInstructions.content + '\nAuthored board customization retained.\n';
    await api('PUT', `/agents/${planner.id}/instructions-bundle/file`, { path: 'AGENTS.md', content: customInstructions, baseRevisionId: originalInstructions.revision?.id ?? null, clearLegacyPromptTemplate: true });
    const editedPlanner = await api('GET', '/agents/' + planner.id);
    await api('PATCH', '/agents/' + planner.id, { name: 'Custom Mission Planner', adapterConfig: { ...editedPlanner.adapterConfig, authoredCanary: 'authored-private-config', paperclipSkillSync: { desiredSkills: [] } } });
    need(detail.editable === false, 'packaged_skill_read_only');
    await api('PATCH', `/companies/${company.id}/skills/${created.skill.id}/files`, { path: 'SKILL.md', content: skillFile.content + '\nRead-only boundary probe.\n' }, [422]);
    const operator = agents.find(row => row.name === 'Mission Operator');
    const fork = await api('POST', `/companies/${company.id}/skills/${created.skill.id}/fork`, { name: 'Board Mission work', slug: 'board-mission-work', reassignAgentIds: [operator.id] });
    need(fork.skill.id !== created.skill.id && fork.reassignments.length === 1 && fork.reassignments[0].agentId === operator.id, 'native_skill_fork_assignment');
    const forkFile = await api('GET', `/companies/${company.id}/skills/${fork.skill.id}/files?path=SKILL.md`);
    const customSkill = forkFile.content + '\nAuthored company skill customization retained.\n';
    await api('PATCH', `/companies/${company.id}/skills/${fork.skill.id}/files`, { path: 'SKILL.md', content: customSkill, expectedVersionId: fork.skill.currentVersionId, idempotencyKey: 'harness-authored-customization' });
    const customized = await scoped(company.id, 'POST', '/setup', pack); narrow(customized);
    need(customized.agents.some(row => row.id === planner.id && row.name === 'Custom Mission Planner' && !row.skillSelected)
      && customized.agents.some(row => row.id === operator.id && !row.skillSelected && row.alternativeSkillSelected), 'native_customization_visible_preserved');
    need((await api('GET', `/agents/${planner.id}/instructions-bundle/file?path=AGENTS.md`)).content === customInstructions
      && (await api('GET', `/companies/${company.id}/skills/${fork.skill.id}/files?path=SKILL.md`)).content === customSkill
      && (await api('GET', `/companies/${company.id}/skills/${created.skill.id}/files?path=SKILL.md`)).content === skillFile.content, 'native_customization_bytes_preserved');
    pass('J06', { changedInstructionsPreserved: true, forkContentPreserved: true, alternativeSelectionPreserved: true, packagedSkillReadOnly: true, deliberateDeselectionPreserved: true, privateAdapterCanaryWithheld: true });
    need((await scoped(other.id, 'GET', '/status')).missingCount === 3, 'other_company_unmodified');
    const otherSetup = await scoped(other.id, 'POST', '/setup', pack);
    need(other.requireBoardApprovalForNewAgents === true && otherSetup.agents.every(row => row.status === 'pending_approval' && row.approvalId)
      && otherSetup.skill.id !== created.skill.id && otherSetup.agents.every(row => !created.agents.some(agent => agent.id === row.id)), 'native_hire_approval_and_company_isolation');
    for (const agent of otherSetup.agents) {
      const current = await api('GET', '/agents/' + agent.id);
      need(current.status === 'pending_approval' && current.adapterConfig.promptTemplate.includes(sharedKey)
        && current.runtimeConfig.heartbeat.enabled === false && current.runtimeConfig.heartbeat.wakeOnDemand === false, 'pending_hire_keeps_initial_config');
    }
    const authAgent = await api('POST', '/companies/' + company.id + '/agents', { name: 'Harness Access Fixture', role: 'ceo', adapterType: 'process', runner: 'legacy', adapterConfig: { command: process.execPath, args: ['--version'], cwd: path.join(root, 'worker') }, runtimeConfig: { heartbeat: { enabled: false, wakeOnDemand: false } } });
    const key = await api('POST', '/agents/' + authAgent.id + '/keys', { name: 'Disposable Harness scope check' }, [201], undefined, true);
    need((await api('GET', '/agents/' + authAgent.id, undefined, [200], key.token)).id === authAgent.id, 'valid_disposable_agent_auth');
    for (const id of [company.id, other.id]) { await scoped(id, 'GET', '/status', undefined, [403], key.token); await scoped(id, 'POST', '/setup', pack, [403], key.token); }
    await api('DELETE', '/agents/' + authAgent.id + '/keys/' + key.id);
    pass('J07', { companyIsolation: true, nativeHireApprovals: 2, validAgentAuthentication: true, deniedAgentRoutes: 4, keyRevoked: true });
    await api('GET', `/companies/${other.id}/skills/${created.skill.id}`, undefined, [404]);
    await api('GET', `/plugins/${pluginKey}/api/status`, undefined, [400]);
    await scoped(randomUUID(), 'GET', '/status', undefined, [404]);
    narrow(await scoped(company.id, 'GET', '/status'));
    pass('J08', { foreignSkill404: true, companyResolutionRequired: true, missingCompany404: true, exactDtoBoundary: true });
    await api('PATCH', '/issues/' + task.id, { assigneeAgentId: created.agents.find(row => row.key === 'mission-operator').id, assigneeUserId: null });
    const state = { company, other, browserCompanies, contact, mission, taskId: task.id, created, customized, worker, oldWorker, plannerId: planner.id, customInstructions, customSkill, forkSkillId: fork.skill.id, authAgentId: authAgent.id };
    await unchanged(state);
    const runs = await api('GET', `/companies/${company.id}/heartbeat-runs?limit=100`);
    need(runs.length === 0 && (await api('GET', '/issues/' + task.id)).status === 'todo', 'assignment_does_not_invoke_paused_agent');
    pass('J09', { unchangedContact: contact.id, unchangedMission: mission.id, nativeAssignedTask: task.id, noHeartbeatRuns: true });
    fs.writeFileSync(path.join(root, 'harness-state.json'), JSON.stringify(state), { flag: 'wx' }); save('harness-state.json', state);
  } else {
    const state = JSON.parse(fs.readFileSync(path.join(root, 'harness-state.json')));
    const worker = await ready(pluginKey, 'plugin-restarted-worker-identity.json');
    const oldWorker = await ready(oldKey, 'missions-restarted-worker-identity.json');
    for (const prior of [state.worker, state.oldWorker]) { let absent = false; try { absent = identity(prior.pid).start !== prior.start; } catch (error) { if (error.code === 'ENOENT') absent = true; else throw error; } need(absent, 'original_worker_absent_after_restart'); }
    need(worker.pid !== state.worker.pid && oldWorker.pid !== state.oldWorker.pid, 'new_workers_after_restart');
    const current = await scoped(state.company.id, 'GET', '/status'); narrow(current); need(JSON.stringify(current) === JSON.stringify(state.customized), 'durable_harness_state');
    await unchanged(state);
    need((await api('GET', `/agents/${state.plannerId}/instructions-bundle/file?path=AGENTS.md`)).content === state.customInstructions
      && (await api('GET', `/companies/${state.company.id}/skills/${state.forkSkillId}/files?path=SKILL.md`)).content === state.customSkill, 'custom_bytes_after_restart');
    pass('J10', { nativeWorkersReplaced: 2, nativeBindingsAndCustomizationsDurable: true, crmAndMissionPreserved: true });
    const replay = await scoped(state.company.id, 'POST', '/setup', pack); need(JSON.stringify(replay) === JSON.stringify(current), 'restart_safe_setup');
    need((await nativeAgents(state.company.id)).length === 3 && (await api('GET', `/companies/${state.company.id}/heartbeat-runs?limit=100`)).length === 0, 'restart_no_duplicate_no_wake');
    pass('J11', { retryAfterRestartPreservedBindings: true, twoManagedAgentsAndOneAuthFixture: true, noHeartbeatRuns: true });
  }
  report.passed = report.cases.length === (mode === 'core' ? 9 : 2);
} catch (error) { report.errors.push(String(error.stack ?? error)); }
finally { save(`harness-api-${mode}.json`, report); }
if (!report.passed) process.exitCode = 1;
