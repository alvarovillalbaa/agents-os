import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fixtureClient, need } from './mission-api-client.mjs';
const mode = process.argv[2]; need(['core', 'restart'].includes(mode), 'mission_api_mode');
const { root, report, api, scoped, save, pass } = fixtureClient('missions-api-' + mode);
const crm = JSON.parse(fs.readFileSync(path.join(root, 'crm-state.json'))), company = crm.company, other = crm.other;
const call = (method, route, body, expected) => scoped(company.id, method, route, body, expected);
const task = title => api('POST', '/companies/' + company.id + '/issues', { title, status: 'todo', assigneeUserId: company.defaultResponsibleUserId });
const plan = (title, issues) => ({ title, objective: 'Authored Mission objective.\nReview real Task results.', checkpoints: issues.map((issue, index) => ({ id: randomUUID(), title: 'Authored checkpoint ' + (index + 1), acceptance: 'Review authored evidence for checkpoint ' + (index + 1), issueId: issue?.id ?? null })) });
const body = plan => ({ id: randomUUID(), operationId: randomUUID(), plan });
let current;
const read = async () => current = await call('GET', '/missions/' + current.mission.id);
const commandBody = (action, patch = {}) => ({ operationId: randomUUID(), revision: current.mission.revision, action, ...patch });
const command = async (action, patch = {}) => current = await call('POST', '/missions/' + current.mission.id + '/commands', commandBody(action, patch));
const review = (action, index, note) => command(action, { checkpointId: current.mission.checkpoints[index].id, taskUpdatedAt: current.tasks[index].updatedAt, note });
try {
  if (mode === 'core') {
    const first = await task('Mission authored first Task'), second = await task('Mission authored second Task');
    const create = body(plan('Authored persistent Mission', [first, second])); create.id = create.id.toUpperCase(); create.operationId = create.operationId.toUpperCase(); current = await call('POST', '/missions', create);
    need(current.mission.phase === 'draft' && current.mission.revision === 1 && current.mission.objective === create.plan.objective && current.tasks.map(row => row.id).join() === [first.id, second.id].join(), 'mission_fields_and_real_task_reads');
    pass('N01', { actualMissionCreated: current.mission.id, linkedTasks: 2, noImplicitStart: true });

    for (const patch of [{ title: ' ' }, { checkpoints: [] }, { companyId: other.id }, { checkpoints: [{ ...create.plan.checkpoints[0], review: { decision: 'approved' } }] }]) {
      const invalid = body({ ...create.plan, ...patch }); await call('POST', '/missions', invalid, [400]); await call('GET', '/missions/' + invalid.id, undefined, [404]);
    }
    const unlinked = await call('POST', '/missions', body(plan('Authored unlinked draft', [null])));
    await call('POST', '/missions/' + unlinked.mission.id + '/commands', { operationId: randomUUID(), revision: 1, action: 'start' }, [409]);
    pass('N02', { invalidPlansRejected: 4, noPartialInsertion: true, unlinkedStartRejected: true });

    const start = commandBody('start'); current = await call('POST', '/missions/' + current.mission.id + '/commands', start);
    const startReplay = await call('POST', '/missions/' + current.mission.id + '/commands', start), createReplay = await call('POST', '/missions', { ...create, id: create.id.toLowerCase(), operationId: create.operationId.toLowerCase() });
    need(startReplay.replayed && createReplay.replayed && startReplay.mission.revision === 2 && createReplay.mission.phase === 'running', 'mission_initial_replay');
    await call('POST', '/missions/' + current.mission.id + '/commands', { ...start, action: 'pause', note: 'Changed operation intent' }, [409]);
    await call('POST', '/missions/' + current.mission.id + '/commands', { ...commandBody('pause', { note: 'Case changes must not reuse a creation operation' }), operationId: create.operationId.toLowerCase() }, [409]);
    pass('N03', { createAndCommandReplay: true, changedIntentRejected: true });

    const pathToCommand = '/missions/' + current.mission.id + '/commands';
    const competing = await Promise.all(['One pause reason', 'Other pause reason'].map(note => call('POST', pathToCommand, commandBody('pause', { note }), [200, 409])));
    need(competing.filter(row => row.mission).length === 1 && competing.filter(row => row.error).length === 1, 'mission_single_cas_winner'); await read();
    await call('POST', pathToCommand, { ...start, operationId: randomUUID() }, [409]);
    const oldReplay = await call('POST', pathToCommand, start); need(oldReplay.replayed && oldReplay.mission.phase === 'paused' && oldReplay.mission.revision === 3, 'old_command_cannot_clobber_new_state');
    pass('N04', { oneConcurrentWinner: true, staleRevisionRejected: true, olderReplayPreservesLaterState: true });

    await scoped(other.id, 'GET', '/missions/' + current.mission.id, undefined, [404]);
    await scoped(other.id, 'POST', pathToCommand, commandBody('start'), [404]);
    const foreignTask = await api('POST', '/companies/' + other.id + '/issues', { title: 'Foreign Mission Task', status: 'backlog' });
    await call('POST', '/missions', body(plan('Foreign link rejected', [foreignTask])), [404]);
    const agent = await api('POST', '/companies/' + company.id + '/agents', { name: 'Mission Scope Fixture', role: 'ceo', adapterType: 'process', runner: 'legacy',
      adapterConfig: { command: process.execPath, args: ['--version'], cwd: path.join(root, 'worker') }, runtimeConfig: { heartbeat: { enabled: false, wakeOnDemand: false } } });
    for (let n = 0; n < 50; n++) { const actual = await api('GET', '/agents/' + agent.id); if (actual.status === 'idle' && (actual.lifecycleState === undefined || actual.lifecycleState === 'ready')) break; need(!['error', 'terminated'].includes(actual.status), 'mission_agent_setup'); await new Promise(done => setTimeout(done, 300)); }
    const key = await api('POST', '/agents/' + agent.id + '/keys', { name: 'Disposable Mission scope key' }, [201], undefined, true);
    try {
      need((await api('GET', '/agents/' + agent.id, undefined, [200], key.token)).id === agent.id, 'valid_mission_agent_auth');
      await scoped(company.id, 'POST', '/missions/search', {}, [403], key.token); await scoped(other.id, 'POST', '/missions/search', {}, [403], key.token);
    } finally { await api('DELETE', '/agents/' + agent.id + '/keys/' + key.id); }
    pass('N05', { company404s: 2, foreignTaskRejected: true, validAgentThenTwo403s: true, keyRevoked: true });

    await command('start'); await call('POST', pathToCommand, commandBody('approve', { checkpointId: create.plan.checkpoints[0].id, taskUpdatedAt: current.tasks[0].updatedAt, note: 'Cannot approve unfinished work' }), [409]);
    const beforeStamp = current.tasks[0].updatedAt; await api('PATCH', '/issues/' + first.id, { status: 'done' }); await read();
    await call('POST', pathToCommand, commandBody('approve', { checkpointId: create.plan.checkpoints[0].id, taskUpdatedAt: beforeStamp, note: 'Stale Task view must fail' }), [409]);
    await review('approve', 0, 'Authored first checkpoint evidence'); need(current.approvedCount === 1 && current.currentIndex === 1 && current.mission.phase === 'running', 'first_review_advances_one_checkpoint');
    pass('N06', { unfinishedRejected: true, staleTaskStampRejected: true, explicitFirstReview: true });

    await api('PATCH', '/issues/' + second.id, { status: 'done' }); await read(); await review('request_changes', 1, 'Authored rework: include missing evidence.');
    await call('POST', pathToCommand, commandBody('approve', { checkpointId: current.mission.checkpoints[1].id, taskUpdatedAt: current.tasks[1].updatedAt, note: 'Unchanged rework must fail' }), [409]);
    await api('PATCH', '/issues/' + second.id, { description: 'Authored rework supplied with evidence.' }); await read(); await review('approve', 1, 'Authored revised second checkpoint evidence');
    need(current.status === 'ready_to_complete' && current.mission.phase === 'running', 'reviewed_does_not_auto_complete');
    pass('N07', { reworkRetained: true, unchangedReworkRejected: true, revisedTaskApproved: true, noAutomaticCompletion: true });

    await command('complete', { note: 'Authored final outcome evidence.' }); need(current.mission.phase === 'completed' && current.mission.completion.evidence === 'Authored final outcome evidence.', 'explicit_complete');
    await api('PATCH', '/issues/' + first.id, { description: 'Task changed after Mission completion.' }); await read();
    need(current.status === 'needs_review' && current.changedCheckpointIds.includes(current.mission.checkpoints[0].id), 'completed_task_drift_visible');
    await call('POST', pathToCommand, commandBody('complete', { note: 'Cannot reuse invalid reviews' }), [409]);
    await command('reopen', { checkpointId: current.mission.checkpoints[0].id, note: 'Reopen changed work and downstream reviews.' });
    need(current.mission.phase === 'paused' && !current.mission.completion && current.mission.checkpoints.every(row => row.review === null)
      && current.mission.history.some(row => row.action === 'approve' && row.note === 'Authored first checkpoint evidence' && row.task?.status === 'done'), 'reopen_preserves_review_history');
    pass('N08', { explicitCompletion: true, laterDriftDetected: true, invalidCompletionRejected: true, reopenRetainsEvidence: true });

    const revisedPlan = { ...create.plan, checkpoints: create.plan.checkpoints.map((row, n) => ({ ...row, ...(n ? { title: 'Replanned second checkpoint' } : {}) })) };
    await command('edit', { plan: revisedPlan }); await command('start'); await review('approve', 0, 'Reviewed the changed first Task.'); await command('pause', { note: 'Hold Mission progression for replanning.' });
    await call('POST', pathToCommand, commandBody('edit', { plan: { ...revisedPlan, objective: 'Different objective must reopen approvals' } }), [409]);
    const allowedPlan = { ...revisedPlan, checkpoints: revisedPlan.checkpoints.map((row, n) => ({ ...row, ...(n ? { acceptance: 'Revised future checkpoint criteria.' } : {}) })) };
    await command('edit', { plan: allowedPlan }); need(current.mission.checkpoints[0].review.decision === 'approved', 'replan_keeps_reviewed_prefix'); await command('start');
    pass('N09', { replanFutureCheckpoint: true, approvedObjectiveFrozen: true, pauseResumeRetainsReview: true });

    const seeded = [];
    for (let n = 0; n < 31; n++) { const actual = await call('POST', '/missions', body(plan('Authored Mission Page ' + String(n).padStart(2, '0'), [null]))); seeded.push(actual.mission.id); }
    const page1 = await call('POST', '/missions/search', { q: 'Authored Mission Page', offset: '0' }), page2 = await call('POST', '/missions/search', { q: 'Authored Mission Page', offset: '30' });
    need(page1.missions.length === 30 && page1.hasMore && page2.missions.length === 1 && !page2.hasMore && new Set([...page1.missions, ...page2.missions].map(row => row.id)).size === 31, 'mission_real_paging');
    need((await call('POST', '/missions/search', { q: '%' })).missions.length === 0, 'mission_search_is_literal'); pass('N10', { realRows: 31, pages: [30, 1], literalSearch: true });

    await read(); const activity = await api('GET', '/companies/' + company.id + '/activity?limit=500');
    const own = activity.filter(row => row.entityType === 'agents_os_mission' && row.entityId === current.mission.id), eventIds = new Set(own.map(row => row.details?.eventId ?? row.metadata?.eventId));
    need(!current.mission.activityPending && current.mission.history.every(row => eventIds.has(row.id)), 'all_mission_activity_delivered');
    const logged = JSON.stringify(own); need(!logged.includes(create.plan.objective) && !logged.includes('Authored first checkpoint evidence') && !logged.includes('Revised future checkpoint criteria.'), 'mission_activity_content_free');
    pass('N11', { durableEvents: current.mission.history.length, hostActivityDelivered: true, privateEvidenceNotInHostActivity: true });

    const pause = commandBody('pause', { note: 'Continue this Mission after restart.' }); current = await call('POST', pathToCommand, pause);
    const browserTasks = [await task('Mission Browser Task A'), await task('Mission Browser Task B')]; for (const row of browserTasks) await api('PATCH', '/issues/' + row.id, { status: 'done' });
    const conflict = await call('POST', '/missions', body(plan('Browser Conflict Mission', [browserTasks[0]])));
    const state = { sourceCommit: process.env.SOURCE_COMMIT, company, other, current, pause, seeded, browserTasks, conflictMissionId: conflict.mission.id };
    fs.writeFileSync(path.join(root, 'missions-state.json'), JSON.stringify(state), { flag: 'wx' }); save('missions-state.json', state);
    pass('N12', { pausedMissionDurable: true, reviewedPrefix: current.approvedCount, privateHistoryRetained: current.mission.history.length, actualBrowserTasksPrepared: 2 });
  } else {
    const state = JSON.parse(fs.readFileSync(path.join(root, 'missions-state.json'))); current = await call('GET', '/missions/' + state.current.mission.id);
    need(JSON.stringify(current.mission) === JSON.stringify(state.current.mission) && current.tasks.map(row => row.id + ':' + row.updatedAt).join() === state.current.tasks.map(row => row.id + ':' + row.updatedAt).join(), 'actual_restart_mission_history_tasks');
    const replay = await call('POST', '/missions/' + current.mission.id + '/commands', state.pause); need(replay.replayed && replay.mission.revision === current.mission.revision && replay.mission.phase === 'paused', 'restart_command_ledger');
    const page1 = await call('POST', '/missions/search', { q: 'Authored Mission Page', offset: '0' }), page2 = await call('POST', '/missions/search', { q: 'Authored Mission Page', offset: '30' });
    need([...page1.missions, ...page2.missions].map(row => row.id).every(id => state.seeded.includes(id)) && page1.missions.length + page2.missions.length === 31, 'restart_mission_pages');
    await command('start'); need(current.mission.phase === 'running' && current.currentIndex === 1 && current.approvedCount === 1, 'restart_resume_correct_checkpoint');
    pass('N13', { actualRestartRetainedMission: true, replayLedgerAndHistory: true, pagingRetained: 31, resumeAtNextCheckpoint: true });
  }
  report.passed = report.cases.length === (mode === 'core' ? 12 : 1);
} catch (error) { report.errors.push(String(error.stack ?? error)); }
finally { save(`missions-api-${mode}.json`, report); }
if (!report.passed) process.exitCode = 1;
