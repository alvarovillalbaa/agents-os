import type { PaperclipPluginManifestV1 } from '@paperclipai/plugin-sdk';
import { AGENT_KEYS, NATIVE_SKILL_KEY, PACK_VERSION, PLUGIN_ID, SKILL_KEY } from './model.js';
import { instructions, sharedSkill } from './pack.js';
const manifest: PaperclipPluginManifestV1 = {
  id: PLUGIN_ID, apiVersion: 1, version: PACK_VERSION, minimumHostVersion: '2026.1106.0',
  displayName: 'Shared Harness', description: 'Shared company skills and native agents for Agents OS.',
  author: 'Alvaro Villalba Perez', categories: ['ui', 'automation'],
  capabilities: ['api.routes.register', 'companies.read', 'agents.managed', 'skills.managed', 'ui.page.register'],
  entrypoints: { worker: './dist/worker.js', ui: './dist/ui' },
  skills: [{ skillKey: SKILL_KEY, displayName: 'Mission work', slug: 'mission-work',
    description: 'Bounded planning, execution, evidence and recoverable Mission handoffs.', markdown: sharedSkill }],
  agents: AGENT_KEYS.map((agentKey, index) => ({ agentKey, displayName: index === 0 ? 'Mission Planner' : 'Mission Operator',
    role: index === 0 ? 'pm' : 'engineer', title: index === 0 ? 'Mission planning' : 'Mission execution',
    capabilities: index === 0 ? 'Propose bounded Mission checkpoints and evidence criteria.' : 'Execute assigned native Tasks and record evidence for board review.',
    adapterType: 'codex_local', adapterPreference: ['codex_local', 'claude_local'],
    adapterConfig: { promptTemplate: instructions(index === 0 ? 'planner' : 'operator'), paperclipSkillSync: { desiredSkills: [NATIVE_SKILL_KEY] } },
    runtimeConfig: { heartbeat: { enabled: false, wakeOnDemand: false } },
    permissions: { canCreateAgents: false }, status: 'paused' })),
  apiRoutes: [
    { routeKey: 'status', method: 'GET', path: '/status', auth: 'board', capability: 'api.routes.register', companyResolution: { from: 'query', key: 'companyId' } },
    { routeKey: 'setup', method: 'POST', path: '/setup', auth: 'board', capability: 'api.routes.register', companyResolution: { from: 'query', key: 'companyId' } },
  ],
  ui: { slots: [{ type: 'page', id: 'harness', displayName: 'Shared Harness', exportName: 'HarnessPage', routePath: 'harness' }] },
};
export default manifest;
