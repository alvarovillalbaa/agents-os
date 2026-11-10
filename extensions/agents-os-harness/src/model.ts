export const PLUGIN_ID = 'alvarovillalbaa-agents-os-harness';
export const PACK_VERSION = '0.1.0';
export const SKILL_KEY = 'mission-work';
export const NATIVE_SKILL_KEY = `plugin/${PLUGIN_ID}/${SKILL_KEY}`;
export const AGENT_KEYS = ['mission-planner', 'mission-operator'] as const;
export type AgentKey = typeof AGENT_KEYS[number];
export interface AgentView {
  key: AgentKey; id: string | null; name: string; status: string;
  adapterType: string | null; skillSelected: boolean; instructionsCustomized: boolean;
  approvalId: string | null;
}
export interface HarnessState {
  packVersion: string;
  skill: { key: string; id: string | null; name: string; customized: boolean };
  agents: AgentView[];
  missingCount: number;
}
