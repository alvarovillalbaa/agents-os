import test from 'node:test';
import assert from 'node:assert/strict';
import type { PluginContext } from '@paperclipai/plugin-sdk';
import manifest from '../src/manifest.js';
import { AGENT_KEYS, NATIVE_SKILL_KEY, PACK_VERSION, SKILL_KEY } from '../src/model.js';
import { companyId, createHarness, HarnessError, selectsAlternativeSkill, selectsSharedSkill, setupInput } from '../src/service.js';
const A = '11111111-1111-4111-8111-111111111111', B = '22222222-2222-4222-8222-222222222222';
function fixture() {
  const rows = new Map<string, Record<string, any>>(), mutations: string[] = [];
  let failKey = '';
  const keyOf = (company: string, key: string) => company + ':' + key;
  const get = async (key: string, company: string, kind: 'agent' | 'skill') => rows.get(keyOf(company, key))
    ?? { [`${kind}Id`]: null, [kind]: null, status: 'missing' };
  const reconcile = async (key: string, company: string, kind: 'agent' | 'skill') => {
    mutations.push(keyOf(company, key));
    if (key === failKey) throw new Error('authored_partial_failure');
    await new Promise(done => setTimeout(done, 2));
    const row = { [`${kind}Id`]: keyOf(company, key), status: 'resolved', [kind]: kind === 'skill' ? { name: 'Mission work' } : {
      name: key, status: 'paused', adapterType: 'codex_local', adapterConfig: { paperclipSkillSync: { desiredSkills: [NATIVE_SKILL_KEY] }, secret: 'private-adapter-value' },
      runtimeConfig: { secret: 'private-runtime-value' }, instructionsRootPath: '/private/authored/path' } };
    rows.set(keyOf(company, key), row); return row;
  };
  const ctx = { agents: { managed: { get: (key: string, company: string) => get(key, company, 'agent'), reconcile: (key: string, company: string) => reconcile(key, company, 'agent'), reset: () => assert.fail('reset forbidden') } },
    skills: { managed: { get: (key: string, company: string) => get(key, company, 'skill'), reconcile: (key: string, company: string) => reconcile(key, company, 'skill'), reset: () => assert.fail('reset forbidden') } } } as unknown as PluginContext;
  return { rows, mutations, ctx, harness: createHarness(ctx), fail: (key: string) => { failKey = key; } };
}
const input = { packVersion: PACK_VERSION };
test('H01 company IDs reject paths, arrays and malformed scope', () => {
  assert.equal(companyId(A), A);
  for (const value of [undefined, '', '../company', [A], '11111111-1111-0111-0111-111111111111']) assert.throws(() => companyId(value), HarnessError);
});
test('H02 setup accepts only the current fixed pack request', () => {
  setupInput(input);
  for (const value of [null, [], {}, { packVersion: '0.0.0' }, { ...input, reset: true }, { ...input, companyId: B }]) assert.throws(() => setupInput(value), HarnessError);
});
test('H03 native string and versioned skill selections are understood', () => {
  assert.equal(selectsSharedSkill({ paperclipSkillSync: { desiredSkills: [NATIVE_SKILL_KEY] } }), true);
  assert.equal(selectsSharedSkill({ paperclipSkillSync: { desiredSkills: [{ key: NATIVE_SKILL_KEY, versionId: 'authored-version' }] } }), true);
  assert.equal(selectsAlternativeSkill({ paperclipSkillSync: { desiredSkills: [{ key: 'company/authored-fork' }] } }), true);
  assert.equal(selectsAlternativeSkill({ paperclipSkillSync: { desiredSkills: [NATIVE_SKILL_KEY, null, {}] } }), false);
  for (const value of [null, {}, { paperclipSkillSync: null }, { paperclipSkillSync: { desiredSkills: ['other', null, { key: 'other' }] } }]) assert.equal(selectsSharedSkill(value), false);
});
test('H04 declarations share one skill and do not enable execution', () => {
  assert.equal(manifest.skills?.length, 1);
  for (const agent of manifest.agents ?? []) {
    assert.equal(agent.status, 'paused'); assert.equal(selectsSharedSkill(agent.adapterConfig), true);
    assert.deepEqual(agent.runtimeConfig, { heartbeat: { enabled: false, wakeOnDemand: false } });
    assert.match(agent.instructions?.content ?? '', /board/);
  }
  assert.equal(manifest.agents?.length, 2);
  assert.equal(manifest.capabilities.some(cap => /invoke|resume|secrets|outbound|database/.test(cap)), false);
});
test('H05 status is read only, with three missing resources', async () => {
  const f = fixture(), result = await f.harness.status(A);
  assert.equal(result.missingCount, 3); assert.deepEqual(f.mutations, []); assert.equal(result.skill.key, NATIVE_SKILL_KEY);
});
test('H06 setup creates shared skill before both agent bindings', async () => {
  const f = fixture(), result = await f.harness.setup(A, input);
  assert.deepEqual(f.mutations, [SKILL_KEY, ...AGENT_KEYS].map(key => A + ':' + key));
  assert.equal(result.missingCount, 0); assert.equal(result.agents.every(row => row.skillSelected), true);
});
test('H07 DTOs withhold adapter/runtime/private-path content', async () => {
  const f = fixture(), result = await f.harness.setup(A, input), raw = JSON.stringify(result);
  assert.doesNotMatch(raw, /private-adapter-value|private-runtime-value|\/private\/authored|adapterConfig|runtimeConfig|instructionsRootPath/);
  assert.equal(result.agents[0]?.adapterType, 'codex_local');
});
test('H08 replay preserves operator changes and deliberate deselection', async () => {
  const f = fixture(); await f.harness.setup(A, input);
  const original = f.rows.get(A + ':' + AGENT_KEYS[0])!;
  original.agent.name = 'Operator choice'; original.agent.adapterConfig.paperclipSkillSync.desiredSkills = [];
  original.defaultDrift = { changedFiles: ['AGENTS.md'] };
  const skill = f.rows.get(A + ':' + SKILL_KEY)!; skill.defaultDrift = { changedFiles: ['SKILL.md'] };
  const result = await f.harness.setup(A, input);
  assert.equal(f.mutations.length, 3); assert.equal(result.agents[0]?.name, 'Operator choice');
  assert.equal(result.agents[0]?.skillSelected, false); assert.equal(result.agents[0]?.instructionsCustomized, true); assert.equal(result.skill.customized, true);
});
test('H09 partial failure retains progress and retries only missing resources', async () => {
  const f = fixture(); f.fail(AGENT_KEYS[1]); await assert.rejects(f.harness.setup(A, input), /authored_partial_failure/);
  assert.equal((await f.harness.status(A)).missingCount, 1); f.fail('');
  await f.harness.setup(A, input);
  assert.deepEqual(f.mutations, [SKILL_KEY, AGENT_KEYS[0], AGENT_KEYS[1], AGENT_KEYS[1]].map(key => A + ':' + key));
});
test('H10 simultaneous setup serializes to one native creation per key', async () => {
  const f = fixture(); const results = await Promise.all([f.harness.setup(A, input), f.harness.setup(A, input), f.harness.setup(A, input)]);
  assert.equal(f.mutations.length, 3); assert.deepEqual(results[0], results[1]); assert.deepEqual(results[1], results[2]);
});
test('H11 companies resolve separate native resources', async () => {
  const f = fixture(); await f.harness.setup(A, input); assert.equal((await f.harness.status(B)).missingCount, 3);
  await f.harness.setup(B, input); assert.equal(f.rows.size, 6); assert.notEqual((await f.harness.status(A)).skill.id, (await f.harness.status(B)).skill.id);
});
test('H12 restart resolves durable bindings; stale pack never mutates', async () => {
  const f = fixture(), initial = await f.harness.setup(A, input), restarted = createHarness(f.ctx);
  assert.deepEqual(await restarted.setup(A, input), initial); assert.equal(f.mutations.length, 3);
  await assert.rejects(restarted.setup(B, { packVersion: 'obsolete' }), HarnessError); assert.equal(f.mutations.length, 3);
});
