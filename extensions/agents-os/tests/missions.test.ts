import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { CrmError } from '../src/domain.js';
import { applyMissionCommand, inspectMission, missionCommand, missionPlan, type MissionCommand } from '../src/missions/domain.js';
import type { CheckpointPlan, MissionAction, MissionDocument, TaskSnapshot } from '../src/missions/model.js';
const at = '2026-11-10T12:00:00.000Z', later = '2026-11-10T13:00:00.000Z';
const checkpoint = (n: number): CheckpointPlan & { issueId: string } => ({ id: randomUUID(), title: `Checkpoint ${n}`, acceptance: `Evidence for checkpoint ${n}`, issueId: randomUUID() });
const plan = () => ({ title: 'Authored Mission', objective: 'Deliver a reviewed authored result.\nRetain evidence.', checkpoints: [checkpoint(1), checkpoint(2)] });
const document = (): MissionDocument => ({ ...plan(), phase: 'draft', reason: '', completion: null, checkpoints: plan().checkpoints.map(row => ({ ...row, review: null })) });
const tasks = (doc: MissionDocument, status = 'done'): TaskSnapshot[] => doc.checkpoints.map(row => ({ id: row.issueId!, title: row.title, identifier: null, status, updatedAt: at }));
const command = (action: MissionAction, patch: Partial<MissionCommand> = {}): MissionCommand => ({ action, expected: 1, operationId: randomUUID(), note: 'Authored evidence or reason.', ...patch });
const apply = (doc: MissionDocument, action: MissionAction, native = tasks(doc), patch: Partial<MissionCommand> = {}) => applyMissionCommand(doc, command(action, patch), native, 'authored-board', at);
const reject = (fn: () => unknown, status = 409) => assert.throws(fn, error => error instanceof CrmError && error.status === status);
const running = () => { const doc = document(); return apply(doc, 'start'); };
const approve = (doc: MissionDocument, n: number, native = tasks(doc)) => apply(doc, 'approve', native, { checkpointId: doc.checkpoints[n]!.id, taskUpdatedAt: native[n]!.updatedAt });

test('Mission plan normalizes whitespace, multiline text and UUID case', () => {
  const input = plan(); input.checkpoints[0]!.id = input.checkpoints[0]!.id.toUpperCase();
  const actual = missionPlan({ ...input, title: ' Authored Mission ' });
  assert.equal(actual.title, 'Authored Mission'); assert.equal(actual.objective, input.objective); assert.equal(actual.checkpoints[0]!.id, input.checkpoints[0]!.id.toLowerCase());
});
test('Mission plans require bounded nonempty criteria and 1 to 20 checkpoints', () => {
  for (const patch of [{ title: ' ' }, { objective: 'a'.repeat(8001) }, { checkpoints: [] }, { checkpoints: Array.from({ length: 21 }, (_, n) => checkpoint(n)) },
    { checkpoints: [{ ...checkpoint(1), acceptance: '' }] }, { checkpoints: [{ ...checkpoint(1), title: 'Bad\0text' }] }]) reject(() => missionPlan({ ...plan(), ...patch }), 400);
});
test('Duplicate checkpoint IDs and native Tasks, including case changes, are rejected', () => {
  const input = plan(); const first = input.checkpoints[0]!;
  reject(() => missionPlan({ ...input, checkpoints: [first, { ...checkpoint(2), id: first.id.toUpperCase() }] }), 400);
  reject(() => missionPlan({ ...input, checkpoints: [first, { ...checkpoint(2), issueId: first.issueId.toUpperCase() }] }), 400);
});
test('Mission plans reject client-injected scope, review and phase fields', () => {
  for (const patch of [{ companyId: randomUUID() }, { phase: 'completed' }, { checkpoints: [{ ...checkpoint(1), review: { decision: 'approved' } }] }]) reject(() => missionPlan({ ...plan(), ...patch }), 400);
});
test('Commands require action-specific fields, evidence, revision and exact Task stamp', () => {
  const input = { action: 'approve', operationId: randomUUID(), revision: 1, checkpointId: randomUUID(), note: ' Evidence ', taskUpdatedAt: at };
  assert.equal(missionCommand(input).note, 'Evidence');
  for (const patch of [{ note: ' ' }, { taskUpdatedAt: 'tomorrow' }, { revision: 0 }, { phase: 'completed' }, { plan: plan() }, { action: 'invented' }]) reject(() => missionCommand({ ...input, ...patch }), 400);
  reject(() => missionCommand({ action: 'start', operationId: randomUUID(), revision: 1, note: 'Ignored input' }), 400);
});
test('Starting requires every checkpoint to have an available company Task', () => {
  const doc = document(); reject(() => applyMissionCommand(doc, command('start'), [null, ...tasks(doc).slice(1)], 'board', at));
  doc.checkpoints[0]!.issueId = null; reject(() => apply(doc, 'start'));
  assert.equal(apply(document(), 'start').phase, 'running'); reject(() => apply(running(), 'start'));
});
test('Checkpoint review cannot skip order or accept unfinished Tasks', () => {
  const doc = running(); reject(() => approve(doc, 1)); reject(() => approve(doc, 0, tasks(doc, 'in_progress')));
  const reviewed = approve(doc, 0); assert.equal(inspectMission(reviewed, tasks(reviewed)).approvedCount, 1); assert.equal(doc.checkpoints[0]!.review, null);
});
test('Review binds the exact native Task version shown to the reviewer', () => {
  const doc = running(); reject(() => apply(doc, 'approve', tasks(doc), { checkpointId: doc.checkpoints[0]!.id, taskUpdatedAt: later }));
  assert.equal(approve(doc, 0).checkpoints[0]!.review?.taskUpdatedAt, at);
});
test('Requested rework requires a changed native Task before approval', () => {
  const doc = running(), changes = apply(doc, 'request_changes', tasks(doc), { checkpointId: doc.checkpoints[0]!.id, taskUpdatedAt: at });
  reject(() => approve(changes, 0));
  const native = tasks(changes); native[0]!.updatedAt = later;
  assert.equal(approve(changes, 0, native).checkpoints[0]!.review?.decision, 'approved');
});
test('Pause retains approvals and blocks review until explicit resume', () => {
  const doc = approve(running(), 0), paused = apply(doc, 'pause');
  assert.equal(paused.reason, 'Authored evidence or reason.'); assert.equal(paused.checkpoints[0]!.review?.decision, 'approved'); reject(() => approve(paused, 1));
  assert.equal(apply(paused, 'start').phase, 'running');
});
test('Replanning preserves reviewed checkpoints and freezes their objective', () => {
  const doc = apply(approve(running(), 0), 'pause'), input = missionPlan({ title: doc.title, objective: doc.objective,
    checkpoints: doc.checkpoints.map(({ id, title, acceptance, issueId }) => ({ id, title, acceptance, issueId })) });
  input.checkpoints[1]!.title = 'Replanned future work';
  assert.equal(apply(doc, 'edit', tasks(doc), { plan: input }).checkpoints[0]!.review?.decision, 'approved');
  reject(() => apply(doc, 'edit', tasks(doc), { plan: { ...input, objective: 'Different outcome' } }));
  input.checkpoints[0]!.acceptance = 'Different approved criteria'; reject(() => apply(doc, 'edit', tasks(doc), { plan: input }));
});
test('Done Tasks and reviewed checkpoints still require explicit final completion', () => {
  let doc = running(); reject(() => apply(doc, 'complete')); doc = approve(doc, 0); doc = approve(doc, 1);
  assert.equal(doc.phase, 'running'); assert.equal(inspectMission(doc, tasks(doc)).status, 'ready_to_complete');
  const complete = apply(doc, 'complete'); assert.equal(complete.phase, 'completed'); assert.equal(complete.completion?.evidence, 'Authored evidence or reason.');
});
test('Task drift invalidates completion and reopening clears downstream reviews', () => {
  let doc = running(); doc = approve(doc, 0); doc = approve(doc, 1); doc = apply(doc, 'complete');
  const native = tasks(doc); native[0]!.updatedAt = later;
  assert.equal(inspectMission(doc, native).status, 'needs_review'); assert.equal(inspectMission(doc, native).changedCheckpointIds[0], doc.checkpoints[0]!.id);
  reject(() => apply(doc, 'start', native)); const reopened = apply(doc, 'reopen', native, { checkpointId: doc.checkpoints[0]!.id });
  assert.equal(reopened.phase, 'paused'); assert.equal(reopened.completion, null); assert(reopened.checkpoints.every(row => row.review === null));
  const cancelled = apply(running(), 'cancel'); reject(() => apply(cancelled, 'start')); assert.equal(apply(cancelled, 'reopen', tasks(cancelled), { checkpointId: cancelled.checkpoints[0]!.id }).phase, 'paused');
});
