import { CrmError, bodyObject, requireValue, revision, uuid } from '../domain.js';
import { MISSION_ACTIONS, type CheckpointPlan, type MissionAction, type MissionDetail, type MissionDocument, type MissionPlan, type TaskSnapshot } from './model.js';
function text(value: unknown, label: string, max: number, multiline = false): string {
  requireValue(typeof value === 'string' && value.length <= max && !(multiline ? /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/ : /[\u0000-\u001f]/).test(value), `${label} is required and must be at most ${max} characters.`);
  const result = value.trim(); requireValue(result.length > 0, `${label} is required.`); return result;
}
export function missionPlan(value: unknown): MissionPlan {
  const body = bodyObject(value, ['title', 'objective', 'checkpoints']);
  requireValue(Array.isArray(body.checkpoints) && body.checkpoints.length > 0 && body.checkpoints.length <= 20, 'Plan 1 to 20 checkpoints.');
  const checkpoints = body.checkpoints.map((value): CheckpointPlan => {
    const row = bodyObject(value, ['id', 'title', 'acceptance', 'issueId']);
    return { id: uuid(row.id, 'Checkpoint ID').toLowerCase(), title: text(row.title, 'Checkpoint title', 160), acceptance: text(row.acceptance, 'Acceptance criteria', 2000, true), issueId: row.issueId === null ? null : uuid(row.issueId, 'Task ID').toLowerCase() };
  });
  requireValue(new Set(checkpoints.map(row => row.id)).size === checkpoints.length, 'Checkpoint IDs must be distinct.');
  const taskIds = checkpoints.map(row => row.issueId).filter(id => id !== null);
  requireValue(new Set(taskIds).size === taskIds.length, 'Use a distinct Task for each checkpoint.');
  return { title: text(body.title, 'Mission title', 120), objective: text(body.objective, 'Objective', 8000, true), checkpoints };
}
export interface MissionCommand { action: MissionAction; expected: number; operationId: string; plan?: MissionPlan; checkpointId?: string; taskUpdatedAt?: string; note: string; }
export function missionCommand(value: unknown): MissionCommand {
  const body = bodyObject(value, ['action', 'revision', 'operationId', 'plan', 'checkpointId', 'taskUpdatedAt', 'note']);
  requireValue(MISSION_ACTIONS.includes(body.action as MissionAction), 'Choose a valid Mission action.');
  const action = body.action as MissionAction;
  const checkpointAction = ['approve', 'request_changes', 'reopen'].includes(action);
  const reviewAction = action === 'approve' || action === 'request_changes';
  const needsNote = !['edit', 'start'].includes(action);
  bodyObject(body, ['action', 'revision', 'operationId', ...(action === 'edit' ? ['plan'] : []), ...(checkpointAction ? ['checkpointId'] : []), ...(reviewAction ? ['taskUpdatedAt'] : []), ...(needsNote ? ['note'] : [])]);
  if (reviewAction) requireValue(typeof body.taskUpdatedAt === 'string' && Number.isFinite(Date.parse(body.taskUpdatedAt)) && new Date(body.taskUpdatedAt).toISOString() === body.taskUpdatedAt, 'Refresh the Task before reviewing it.');
  return { action, expected: revision(body.revision), operationId: uuid(body.operationId, 'Operation ID').toLowerCase(),
    ...(action === 'edit' ? { plan: missionPlan(body.plan) } : {}), ...(checkpointAction ? { checkpointId: uuid(body.checkpointId, 'Checkpoint ID').toLowerCase() } : {}),
    ...(reviewAction ? { taskUpdatedAt: body.taskUpdatedAt as string } : {}),
    note: needsNote ? text(body.note, action === 'approve' || action === 'complete' ? 'Evidence' : 'Reason', 4000, true) : '' };
}
const conflict = (condition: unknown, message: string) => { if (!condition) throw new CrmError(409, message); };
export function inspectMission(document: MissionDocument, tasks: (TaskSnapshot | null)[]): Pick<MissionDetail, 'status' | 'currentIndex' | 'approvedCount' | 'changedCheckpointIds'> {
  const valid = document.checkpoints.map((row, index) => row.review?.decision === 'approved' && tasks[index]?.status === 'done' && tasks[index]?.updatedAt === row.review.taskUpdatedAt);
  const currentIndex = valid.findIndex(value => !value), approvedCount = valid.filter(Boolean).length;
  const changedCheckpointIds = document.checkpoints.filter((row, index) => row.review?.decision === 'approved' && !valid[index]).map(row => row.id);
  let status: MissionDetail['status'] = document.phase;
  if (changedCheckpointIds.length && !['draft', 'cancelled'].includes(document.phase)) status = 'needs_review';
  else if (document.phase === 'running') status = currentIndex < 0 ? 'ready_to_complete' : !tasks[currentIndex] || ['blocked', 'cancelled'].includes(tasks[currentIndex]?.status ?? '') ? 'blocked' : tasks[currentIndex]?.status === 'done' ? 'awaiting_review' : 'running';
  return { status, currentIndex, approvedCount, changedCheckpointIds };
}
export function applyMissionCommand(document: MissionDocument, command: MissionCommand, tasks: (TaskSnapshot | null)[], actorId: string, at: string): MissionDocument {
  const next: MissionDocument = structuredClone(document), phase = document.phase;
  const view = inspectMission(document, tasks), index = document.checkpoints.findIndex(row => row.id === command.checkpointId);
  switch (command.action) {
    case 'edit': {
      conflict(phase === 'draft' || phase === 'paused', 'Pause this Mission before changing its plan.');
      const plan = command.plan!;
      conflict(plan.objective === document.objective || !document.checkpoints.some(row => row.review?.decision === 'approved'), 'Reopen reviewed checkpoints before changing the objective.');
      for (const [n, row] of document.checkpoints.entries()) if (row.review?.decision === 'approved') {
        const replacement = plan.checkpoints[n];
        conflict(replacement && replacement.id === row.id && replacement.title === row.title && replacement.acceptance === row.acceptance && replacement.issueId === row.issueId, 'Reopen approved checkpoints before changing them.');
      }
      next.title = plan.title; next.objective = plan.objective;
      next.checkpoints = plan.checkpoints.map(row => {
        const prior = document.checkpoints.find(old => old.id === row.id);
        return { ...row, review: prior && prior.title === row.title && prior.acceptance === row.acceptance && prior.issueId === row.issueId ? prior.review : null };
      });
      break;
    }
    case 'start':
      conflict(phase === 'draft' || phase === 'paused', 'Only a draft or paused Mission can start.');
      conflict(document.checkpoints.every((row, n) => row.issueId && tasks[n]), 'Link an available company Task to every checkpoint before starting.');
      conflict(!view.changedCheckpointIds.length, 'Reopen checkpoints whose Tasks changed before resuming.');
      next.phase = 'running'; next.reason = ''; break;
    case 'pause': conflict(phase === 'running', 'Only a running Mission can pause.'); next.phase = 'paused'; next.reason = command.note; break;
    case 'cancel': conflict(phase !== 'cancelled' && phase !== 'completed', 'This Mission is already closed.'); next.phase = 'cancelled'; next.reason = command.note; break;
    case 'reopen':
      conflict(phase !== 'draft' && index >= 0, 'Choose a checkpoint in an existing Mission.');
      next.checkpoints = next.checkpoints.map((row, n) => n >= index ? { ...row, review: null } : row);
      next.phase = 'paused'; next.reason = command.note; next.completion = null; break;
    case 'approve': case 'request_changes': {
      conflict(phase === 'running', 'Start or resume this Mission before reviewing a checkpoint.');
      conflict(!view.changedCheckpointIds.length, 'A reviewed Task changed. Reopen it before continuing.');
      conflict(index >= 0 && index === view.currentIndex, 'Review checkpoints in order.');
      const task = tasks[index], checkpoint = next.checkpoints[index]!;
      conflict(task?.status === 'done', 'The native Task must be done before checkpoint review.');
      conflict(task!.updatedAt === command.taskUpdatedAt, 'The Task changed since this review opened. Refresh the Mission before reviewing it.');
      if (command.action === 'approve' && checkpoint.review?.decision === 'changes_requested') conflict(task!.updatedAt !== checkpoint.review.taskUpdatedAt, 'The Task has not changed since rework was requested.');
      checkpoint.review = { decision: command.action === 'approve' ? 'approved' : 'changes_requested', evidence: command.note, actorId, at, taskUpdatedAt: task!.updatedAt };
      break;
    }
    case 'complete':
      conflict(phase === 'running' && view.currentIndex < 0 && !view.changedCheckpointIds.length, 'Review every checkpoint against unchanged done Tasks before completing.');
      next.phase = 'completed'; next.completion = { evidence: command.note, actorId, at }; next.reason = ''; break;
  }
  return next;
}
