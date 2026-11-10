import type { PluginContext } from '@paperclipai/plugin-sdk';
import { CrmError, DATABASE_NAMESPACE, FIELD_NAMES, bodyObject, contactFields, pageOffset, requestHash, requireValue, revision, uuid } from './domain.js';
import type { AuditEvent, Contact, ContactDetail, ContactFields, MutationResult, TaskLink } from './model.js';

interface Row {
  id: string; company_id: string; fields: ContactFields; revision: number;
  archived_at: string | null; linked_issue_ids: string[]; creation_hash: string;
  last_operation_id: string; last_operation_hash: string; audit: AuditEvent[];
  activity_sent_revision: number; created_at: string; updated_at: string;
}
const iso = (value: string) => new Date(value).toISOString();
const visible = (row: Row): Contact => ({ ...row.fields, id: row.id, revision: row.revision,
  archivedAt: row.archived_at ? iso(row.archived_at) : null,
  createdAt: iso(row.created_at), updatedAt: iso(row.updated_at), linkedIssueIds: row.linked_issue_ids,
  activityPending: row.activity_sent_revision < row.revision, audit: row.audit.slice(-20) });

export function createRepository(ctx: PluginContext) {
  requireValue(ctx.db.namespace === DATABASE_NAMESPACE, 'Unexpected plugin database namespace.');
  const table = `${DATABASE_NAMESPACE}.contacts`;
  const locks = new Map<string, Promise<void>>();
  async function serial<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const previous = locks.get(key) ?? Promise.resolve(); let release!: () => void;
    const tail = new Promise<void>(done => { release = done; }); locks.set(key, tail);
    await previous;
    try { return await fn(); }
    finally { release(); if (locks.get(key) === tail) locks.delete(key); }
  }
  async function find(companyId: string, id: string): Promise<Row | null> {
    return (await ctx.db.query<Row>(`SELECT * FROM ${table} WHERE company_id = $1 AND id = $2`, [companyId, id]))[0] ?? null;
  }
  async function need(companyId: string, id: string): Promise<Row> {
    const row = await find(companyId, id); if (!row) throw new CrmError(404, 'Contact not found.'); return row;
  }
  async function detail(companyId: string, row: Row): Promise<ContactDetail> {
    const tasks: TaskLink[] = [], unavailableTaskIds: string[] = [];
    for (const id of row.linked_issue_ids) {
      const issue = await ctx.issues.get(id, companyId);
      if (!issue) unavailableTaskIds.push(id);
      else tasks.push({ id: issue.id, identifier: issue.identifier ?? null, title: issue.title, status: issue.status });
    }
    return { contact: visible(row), tasks, unavailableTaskIds };
  }
  async function drain(companyId: string, row: Row): Promise<Row> {
    // The row journal is authoritative; an uncertain host log call remains pending.
    for (const event of row.audit.filter(event => event.revision > row.activity_sent_revision).slice(0, 10)) {
      try {
        await ctx.activity.log({ companyId, message: `CRM contact ${event.action}`, entityType: 'agents_os_contact', entityId: row.id,
          metadata: { eventId: event.id, contactRevision: event.revision, actorId: event.actorId } });
        await ctx.db.execute(`UPDATE ${table} SET activity_sent_revision = $3
          WHERE company_id = $1 AND id = $2 AND activity_sent_revision < $3`, [companyId, row.id, event.revision]);
      } catch { break; }
    }
    return need(companyId, row.id);
  }
  async function create(companyId: string, value: unknown, actorId: string): Promise<MutationResult> {
    const body = bodyObject(value, ['id', 'operationId', ...FIELD_NAMES]);
    const id = uuid(body.id, 'Contact ID'), operationId = uuid(body.operationId, 'Operation ID'), fields = contactFields(body);
    const fingerprint = requestHash(fields), at = new Date().toISOString();
    return serial(companyId + ':' + id, async () => {
      const event: AuditEvent = { id: id + ':' + operationId, revision: 1, action: 'created', actorId, at };
      const result = await ctx.db.execute(`INSERT INTO ${table}
        (id, company_id, fields, creation_hash, last_operation_id, last_operation_hash, audit)
        VALUES ($1, $2, $3::jsonb, $4, $5, $4, $6::jsonb) ON CONFLICT (id) DO NOTHING`,
      [id, companyId, JSON.stringify(fields), fingerprint, operationId, JSON.stringify([event])]);
      const row = await find(companyId, id);
      if (!row || row.creation_hash !== fingerprint) throw new CrmError(409, 'This contact ID already exists with different details. Load the saved contact before editing.');
      return { ...await detail(companyId, await drain(companyId, row)), replayed: result.rowCount === 0 };
    });
  }
  async function mutate(companyId: string, id: string, action: 'edit' | 'archive' | 'link', value: unknown, actorId: string): Promise<MutationResult> {
    const allowed = action === 'edit' ? FIELD_NAMES : action === 'archive' ? ['archived'] : ['issueId', 'linked'];
    const body = bodyObject(value, ['operationId', 'revision', ...allowed]);
    const operationId = uuid(body.operationId, 'Operation ID'), expected = revision(body.revision);
    const fields = action === 'edit' ? contactFields(body) : null;
    if (action === 'archive') requireValue(typeof body.archived === 'boolean', 'Archive choice is required.');
    if (action === 'link') { uuid(body.issueId, 'Task ID'); requireValue(typeof body.linked === 'boolean', 'Task link choice is required.'); }
    const hash = requestHash({ action, expected, ...(fields ?? (action === 'archive' ? { archived: body.archived } : { issueId: body.issueId, linked: body.linked })) });
    return serial(companyId + ':' + id, async () => {
      let row = await need(companyId, id);
      if (row.last_operation_id === operationId) {
        if (row.last_operation_hash !== hash) throw new CrmError(409, 'This operation ID was already used with different details.');
        return { ...await detail(companyId, await drain(companyId, row)), replayed: true };
      }
      if (row.revision !== expected) throw new CrmError(409, 'This contact changed elsewhere. Your draft is kept. Load the saved contact before trying again.');
      if (row.archived_at && action !== 'archive') throw new CrmError(409, 'Restore this contact before changing it.');
      let linked = row.linked_issue_ids, archivedAt = row.archived_at;
      if (action === 'link') {
        const issueId = body.issueId as string;
        if (body.linked) {
          if (!await ctx.issues.get(issueId, companyId)) throw new CrmError(404, 'Task not found in this company.');
          linked = [...new Set([...linked, issueId])]; requireValue(linked.length <= 50, 'A contact can link to at most 50 tasks.');
        } else linked = linked.filter(id => id !== issueId);
      }
      if (action === 'archive') archivedAt = body.archived ? new Date().toISOString() : null;
      const at = new Date().toISOString(), nextRevision = expected + 1;
      const label = action === 'edit' ? 'edited' : action === 'link' ? (body.linked ? 'task linked' : 'task unlinked') : body.archived ? 'archived' : 'restored';
      const event: AuditEvent = { id: id + ':' + operationId, revision: nextRevision, action: label, actorId, at };
      const result = await ctx.db.execute(`UPDATE ${table} SET fields = $4::jsonb, linked_issue_ids = $5::jsonb,
        archived_at = $6::timestamptz, revision = revision + 1, last_operation_id = $7, last_operation_hash = $8,
        audit = audit || $9::jsonb, updated_at = $10::timestamptz
        WHERE company_id = $1 AND id = $2 AND revision = $3`,
      [companyId, id, expected, JSON.stringify(fields ?? row.fields), JSON.stringify(linked), archivedAt, operationId, hash, JSON.stringify([event]), at]);
      if (result.rowCount !== 1) throw new CrmError(409, 'This contact changed elsewhere. Your draft is kept. Load the saved contact before trying again.');
      row = await need(companyId, id);
      return { ...await detail(companyId, await drain(companyId, row)), replayed: false };
    });
  }
  return {
    create, mutate,
    get: async (companyId: string, id: string) => detail(companyId, await need(companyId, id)),
    async list(companyId: string, value: unknown) {
      const query = bodyObject(value, ['q', 'mode', 'offset']);
      const offset = pageOffset(query.offset), q = query.q ?? '', mode = query.mode ?? 'active';
      requireValue(typeof q === 'string' && q.length <= 120 && !/[\u0000-\u001f]/.test(q), 'Search is too long or contains unsupported characters.');
      requireValue(typeof mode === 'string' && ['active', 'archived', 'all'].includes(mode), 'Invalid contact filter.');
      const rows = await ctx.db.query<Row>(`SELECT * FROM ${table} WHERE company_id = $1
        AND ($2 = 'all' OR ($2 = 'archived') = (archived_at IS NOT NULL))
        AND position(lower($3) in lower(coalesce(fields->>'name','') || ' ' || coalesce(fields->>'organization','') || ' ' || coalesce(fields->>'email',''))) > 0
        ORDER BY updated_at DESC, id LIMIT 31 OFFSET $4`, [companyId, mode, q.trim(), offset]);
      return { contacts: rows.slice(0, 30).map(visible), hasMore: rows.length > 30, offset };
    },
    async tasks(companyId: string, query: Record<string, string | string[]>) {
      const offset = pageOffset(query.offset), issues = await ctx.issues.list({ companyId, offset, limit: 51 });
      return { tasks: issues.slice(0, 50).map(issue => ({ id: issue.id, identifier: issue.identifier ?? null, title: issue.title, status: issue.status })), hasMore: issues.length > 50, offset };
    },
    async retryActivity(companyId: string, id: string) {
      return serial(companyId + ':' + id, async () => detail(companyId, await drain(companyId, await need(companyId, id))));
    },
  };
}
