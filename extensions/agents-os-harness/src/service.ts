import type { PluginContext } from '@paperclipai/plugin-sdk';
import { AGENT_KEYS, NATIVE_SKILL_KEY, PACK_VERSION, SKILL_KEY, type HarnessState } from './model.js';

export class HarnessError extends Error { constructor(public status: number, message: string) { super(message); } }
export function companyId(value: unknown): string {
  if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) throw new HarnessError(400, 'A valid company ID is required.');
  return value;
}
export function setupInput(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length !== 1 || (value as Record<string, unknown>).packVersion !== PACK_VERSION) {
    throw new HarnessError(409, 'Reload Shared Harness before setting up this version.');
  }
}
export function selectsSharedSkill(config: unknown): boolean {
  if (!config || typeof config !== 'object') return false;
  const sync = (config as Record<string, unknown>).paperclipSkillSync;
  if (!sync || typeof sync !== 'object') return false;
  const desired = (sync as Record<string, unknown>).desiredSkills;
  return Array.isArray(desired) && desired.some(entry => entry === NATIVE_SKILL_KEY
    || Boolean(entry && typeof entry === 'object' && entry.key === NATIVE_SKILL_KEY));
}
export function createHarness(ctx: Pick<PluginContext, 'agents' | 'skills'>) {
  const locks = new Map<string, Promise<void>>();
  async function status(company: string): Promise<HarnessState> {
    const [skill, agents] = await Promise.all([ctx.skills.managed.get(SKILL_KEY, company),
      Promise.all(AGENT_KEYS.map(key => ctx.agents.managed.get(key, company)))]);
    const views = agents.map((item, index) => ({ key: AGENT_KEYS[index]!, id: item.agentId,
      name: item.agent?.name ?? (index === 0 ? 'Mission Planner' : 'Mission Operator'),
      status: item.agent?.status ?? 'missing', adapterType: item.agent?.adapterType ?? null,
      skillSelected: selectsSharedSkill(item.agent?.adapterConfig),
      instructionsCustomized: Boolean(item.defaultDrift?.changedFiles.length), approvalId: item.approvalId ?? null }));
    return { packVersion: PACK_VERSION, skill: { key: NATIVE_SKILL_KEY, id: skill.skillId,
      name: skill.skill?.name ?? 'Mission work', customized: Boolean(skill.defaultDrift?.changedFiles.length) },
    agents: views, missingCount: Number(!skill.skillId) + views.filter(agent => !agent.id).length };
  }
  async function setup(company: string, value: unknown): Promise<HarnessState> {
    setupInput(value);
    const previous = locks.get(company) ?? Promise.resolve(); let release!: () => void;
    const tail = new Promise<void>(done => { release = done; }); locks.set(company, tail); await previous;
    try {
      // Native managed bindings survive partial responses/restarts. Never reset
      // or reconcile an existing resource, including deliberately changed ones.
      if (!(await ctx.skills.managed.get(SKILL_KEY, company)).skillId) await ctx.skills.managed.reconcile(SKILL_KEY, company);
      for (const key of AGENT_KEYS) if (!(await ctx.agents.managed.get(key, company)).agentId) await ctx.agents.managed.reconcile(key, company);
      return await status(company);
    } finally { release(); if (locks.get(company) === tail) locks.delete(company); }
  }
  return { status, setup };
}
