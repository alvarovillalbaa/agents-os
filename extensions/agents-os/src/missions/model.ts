import type { AuditEvent } from '../model.js';
export const MISSION_PHASES = ['draft', 'running', 'paused', 'completed', 'cancelled'] as const;
export type MissionPhase = typeof MISSION_PHASES[number];
export const MISSION_ACTIONS = ['edit', 'start', 'pause', 'cancel', 'reopen', 'approve', 'request_changes', 'complete'] as const;
export type MissionAction = typeof MISSION_ACTIONS[number];
export interface CheckpointPlan { id: string; title: string; acceptance: string; issueId: string | null; }
export interface MissionPlan { title: string; objective: string; checkpoints: CheckpointPlan[]; }
export interface TaskSnapshot { id: string; identifier: string | null; title: string; status: string; updatedAt: string; }
export interface CheckpointReview { decision: 'approved' | 'changes_requested'; evidence: string; actorId: string; at: string; taskUpdatedAt: string; }
export interface MissionCheckpoint extends CheckpointPlan { review: CheckpointReview | null; }
export interface MissionDocument extends Omit<MissionPlan, 'checkpoints'> {
  phase: MissionPhase; checkpoints: MissionCheckpoint[]; reason: string;
  completion: { evidence: string; actorId: string; at: string } | null;
}
export interface MissionEvent extends AuditEvent {
  checkpointId?: string; note?: string; checkpoint?: CheckpointPlan;
  task?: { id: string; status: string; updatedAt: string };
}
export interface MissionSummary { id: string; revision: number; title: string; phase: MissionPhase; reviewedCheckpoints: number; totalCheckpoints: number; updatedAt: string; }
export interface Mission extends MissionDocument {
  id: string; revision: number; createdAt: string; updatedAt: string;
  history: MissionEvent[]; activityPending: boolean;
}
export interface MissionDetail {
  mission: Mission; tasks: (TaskSnapshot | null)[]; currentIndex: number;
  status: MissionPhase | 'blocked' | 'awaiting_review' | 'needs_review' | 'ready_to_complete';
  approvedCount: number; changedCheckpointIds: string[]; replayed?: boolean;
}
