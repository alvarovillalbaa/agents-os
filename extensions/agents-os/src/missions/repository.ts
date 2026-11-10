import type { PluginContext } from '@paperclipai/plugin-sdk';
import { CrmError, DATABASE_NAMESPACE, bodyObject, pageOffset, requestHash, requireValue, uuid } from '../domain.js';
import { applyMissionCommand, inspectMission, missionCommand, missionPlan } from './domain.js';
import type { MissionDetail, MissionDocument, MissionEvent, MissionSummary, TaskSnapshot } from './model.js';
interface Row {
  id: string; company_id: string; document: MissionDocument; revision: number; creation_hash: string;
  commands: Record<string, { hash: string; revision: number }>; audit: MissionEvent[];
  activity_sent_revision: number; created_at: string; updated_at: string;
}
const iso = (value: string | Date) => new Date(value).toISOString();
export function createMissionRepository(ctx: PluginContext) {
  requireValue(ctx.db.namespace === DATABASE_NAMESPACE, 'Unexpected plugin database namespace.');
  const table = `${DATABASE_NAMESPACE}.missions`, locks = new Map<string, Promise<void>>();
  async function serial<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const previous = locks.get(key) ?? Promise.resolve(); let release!: () => void;
    const tail = new Promise<void>(done => { release = done; }); locks.set(key, tail); await previous;
    try { return await fn(); } finally { release(); if (locks.get(key) === tail) locks.delete(key); }
  }
  async function find(companyId: string, id: string): Promise<Row | null> {
    return (await ctx.db.query<Row>(`SELECT * FROM ${table} WHERE company_id = $1 AND id = $2`, [companyId, id]))[0] ?? null;
  }
  async function need(companyId: string, id: string): Promise<Row> {
    const row = await find(companyId, id); if (!row) throw new CrmError(404, 'Mission not found.'); return row;
  }
  async function tasksFor(companyId: string, document: MissionDocument): Promise<(TaskSnapshot | null)[]> {
    return Promise.all(document.checkpoints.map(async row => {
      if (!row.issueId) return null;
      const issue = await ctx.issues.get(row.issueId, companyId);
      return issue ? { id: issue.id, identifier: issue.identifier ?? null, title: issue.title, status: issue.status, updatedAt: iso(issue.updatedAt) } : null;
    }));
  }
  async function detail(companyId: string, row: Row, replayed = false): Promise<MissionDetail> {
    const tasks = await tasksFor(companyId, row.document);
    return { mission: { ...row.document, id: row.id, revision: row.revision, createdAt: iso(row.created_at), updatedAt: iso(row.updated_at), history: row.audit.slice(-50), activityPending: row.activity_sent_revision < row.revision },
      tasks, ...inspectMission(row.document, tasks), replayed };
  }
  async function drain(companyId: string, row: Row): Promise<Row> {
    for (const event of row.audit.filter(event => event.revision > row.activity_sent_revision).slice(0, 10)) {
      try {
        await ctx.activity.log({ companyId, message: `Mission ${event.action}`, entityType: 'agents_os_mission', entityId: row.id,
          metadata: { eventId: event.id, missionRevision: event.revision, actorId: event.actorId, ...(event.checkpointId ? { checkpointId: event.checkpointId } : {}) } });
        await ctx.db.execute(`UPDATE ${table} SET activity_sent_revision = $3 WHERE company_id = $1 AND id = $2 AND activity_sent_revision < $3`, [companyId, row.id, event.revision]);
      } catch { break; }
    }
    return need(companyId, row.id);
  }
  async function validateLinks(companyId: string, document: MissionDocument) {
    const tasks = await tasksFor(companyId, document);
    if (document.checkpoints.some((row, index) => row.issueId && !tasks[index])) throw new CrmError(404, 'A linked Task is not available in this company.');
    return tasks;
  }
  return {
    get: async (companyId: string, id: string) => detail(companyId, await need(companyId, id)),
    async create(companyId: string, value: unknown, actorId: string): Promise<MissionDetail> {
      const body = bodyObject(value, ['id', 'operationId', 'plan']);
      const id = uuid(body.id, 'Mission ID').toLowerCase(), operationId = uuid(body.operationId, 'Operation ID').toLowerCase(), plan = missionPlan(body.plan), fingerprint = requestHash(plan);
      const document: MissionDocument = { ...plan, checkpoints: plan.checkpoints.map(row => ({ ...row, review: null })), phase: 'draft', reason: '', completion: null };
      return serial(companyId + ':' + id, async () => {
        const existing = await find(companyId, id);
        if (existing) {
          if (existing.creation_hash !== fingerprint) throw new CrmError(409, 'This Mission ID already exists with a different plan. Load the saved Mission.');
          return detail(companyId, await drain(companyId, existing), true);
        }
        await validateLinks(companyId, document);
        const event: MissionEvent = { id: id + ':' + operationId, revision: 1, action: 'created', actorId, at: new Date().toISOString() };
        const result = await ctx.db.execute(`INSERT INTO ${table} (id, company_id, document, creation_hash, commands, audit)
          VALUES ($1, $2, $3::jsonb, $4, $5::jsonb, $6::jsonb) ON CONFLICT (id) DO NOTHING`,
        [id, companyId, JSON.stringify(document), fingerprint, JSON.stringify({ [operationId]: { hash: fingerprint, revision: 1 } }), JSON.stringify([event])]);
        const row = await find(companyId, id);
        if (!row || row.creation_hash !== fingerprint) throw new CrmError(409, 'This Mission ID already exists with a different plan. Load the saved Mission.');
        return detail(companyId, await drain(companyId, row), result.rowCount === 0);
      });
    },
    async command(companyId: string, id: string, value: unknown, actorId: string): Promise<MissionDetail> {
      const command = missionCommand(value), hash = requestHash(command);
      return serial(companyId + ':' + id, async () => {
        const row = await need(companyId, id), recorded = row.commands[command.operationId];
        if (recorded) {
          if (recorded.hash !== hash) throw new CrmError(409, 'This operation ID was used with different details. Load the saved Mission.');
          return detail(companyId, await drain(companyId, row), true);
        }
        if (row.revision !== command.expected) throw new CrmError(409, 'This Mission changed elsewhere. Your draft is kept. Load the saved Mission.');
        const tasks = await tasksFor(companyId, row.document), at = new Date().toISOString();
        const document = applyMissionCommand(row.document, command, tasks, actorId, at);
        if (command.action === 'edit') await validateLinks(companyId, document);
        const nextRevision = row.revision + 1;
        const event: MissionEvent = { id: id + ':' + command.operationId, revision: nextRevision, action: command.action, actorId, at,
          ...(command.checkpointId ? { checkpointId: command.checkpointId } : {}), ...(command.note ? { note: command.note } : {}) };
        if (command.action === 'approve' || command.action === 'request_changes') {
          const index = row.document.checkpoints.findIndex(checkpoint => checkpoint.id === command.checkpointId), checkpoint = row.document.checkpoints[index]!, task = tasks[index]!;
          event.checkpoint = { id: checkpoint.id, title: checkpoint.title, acceptance: checkpoint.acceptance, issueId: checkpoint.issueId };
          event.task = { id: task.id, status: task.status, updatedAt: task.updatedAt };
        }
        const result = await ctx.db.execute(`UPDATE ${table} SET document = $4::jsonb, revision = revision + 1,
          commands = commands || $5::jsonb, audit = audit || $6::jsonb, updated_at = $7::timestamptz
          WHERE company_id = $1 AND id = $2 AND revision = $3`,
        [companyId, id, command.expected, JSON.stringify(document), JSON.stringify({ [command.operationId]: { hash, revision: nextRevision } }), JSON.stringify([event]), at]);
        if (result.rowCount !== 1) throw new CrmError(409, 'This Mission changed elsewhere. Your draft is kept. Load the saved Mission.');
        return detail(companyId, await drain(companyId, await need(companyId, id)));
      });
    },
    async list(companyId: string, value: unknown) {
      const query = bodyObject(value, ['q', 'phase', 'offset']), offset = pageOffset(query.offset), q = query.q ?? '', phase = query.phase ?? 'all';
      requireValue(typeof q === 'string' && q.length <= 120 && !/[\u0000-\u001f]/.test(q), 'Invalid Mission search.');
      requireValue(typeof phase === 'string' && ['all', 'draft', 'running', 'paused', 'completed', 'cancelled'].includes(phase), 'Invalid Mission filter.');
      const rows = await ctx.db.query<Row>(`SELECT * FROM ${table} WHERE company_id = $1 AND ($2 = 'all' OR document->>'phase' = $2)
        AND position(lower($3) in lower(document->>'title')) > 0 ORDER BY updated_at DESC, id LIMIT 31 OFFSET $4`, [companyId, phase, q.trim(), offset]);
      const missions: MissionSummary[] = rows.slice(0, 30).map(row => ({ id: row.id, revision: row.revision, title: row.document.title, phase: row.document.phase,
        reviewedCheckpoints: row.document.checkpoints.filter(checkpoint => checkpoint.review?.decision === 'approved').length, totalCheckpoints: row.document.checkpoints.length, updatedAt: iso(row.updated_at) }));
      return { missions, hasMore: rows.length > 30, offset };
    },
    retryActivity: async (companyId: string, id: string) => serial(companyId + ':' + id, async () => detail(companyId, await drain(companyId, await need(companyId, id)))),
  };
}
