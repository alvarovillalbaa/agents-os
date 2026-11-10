export const PLUGIN_ID = 'alvarovillalbaa.agents-os';
export const STAGES = ['lead', 'active', 'customer', 'paused'] as const;
export type Stage = typeof STAGES[number];
export interface ContactFields {
  name: string; organization: string; email: string; phone: string;
  stage: Stage; notes: string; nextStep: string; followUpDate: string | null;
}
export interface AuditEvent {
  id: string; revision: number; action: string; actorId: string; at: string;
}
export interface Contact extends ContactFields {
  id: string; revision: number; archivedAt: string | null;
  createdAt: string; updatedAt: string; linkedIssueIds: string[];
  activityPending: boolean; audit: AuditEvent[];
}
export interface TaskLink { id: string; identifier: string | null; title: string; status: string; }
export interface ContactDetail { contact: Contact; tasks: TaskLink[]; unavailableTaskIds: string[]; }
export interface MutationResult extends ContactDetail { replayed: boolean; }
