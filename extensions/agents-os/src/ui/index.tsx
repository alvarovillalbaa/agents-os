import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useHostContext, type PluginPageProps } from '@paperclipai/plugin-sdk/ui';
import { PLUGIN_ID, STAGES, type Contact, type ContactDetail, type ContactFields, type MutationResult, type TaskLink } from '../model.js';
import { styles } from './styles.js';

const EMPTY: ContactFields = { name: '', organization: '', email: '', phone: '', stage: 'lead', notes: '', nextStep: '', followUpDate: null };
type Operation = { path: string; method: 'POST' | 'PATCH'; body: Record<string, unknown> };
type Draft = { id: string; kind: 'new' | 'edit'; revision: number; fields: ContactFields; original: ContactFields; pending: Operation | null };
type Listing = { contacts: Contact[]; hasMore: boolean; offset: number };
type Tasks = { tasks: TaskLink[]; hasMore: boolean; offset: number };
class ApiError extends Error { constructor(public status: number, message: string) { super(message); } }
function fieldsOf(contact: Contact): ContactFields {
  return { name: contact.name, organization: contact.organization, email: contact.email, phone: contact.phone,
    stage: contact.stage, notes: contact.notes, nextStep: contact.nextStep, followUpDate: contact.followUpDate };
}
function isDirty(draft: Draft | null) {
  return Boolean(draft && (JSON.stringify(draft.fields) !== JSON.stringify(draft.original) || draft.pending));
}
function readDraft(key: string | null): Draft | null {
  if (!key) return null;
  try {
    const d = JSON.parse(sessionStorage.getItem(key) ?? 'null') as Draft | null;
    if (!d || !/^[a-f0-9-]{36}$/i.test(d.id) || !['new', 'edit'].includes(d.kind) || !Number.isSafeInteger(d.revision)) return null;
    for (const fields of [d.fields, d.original]) {
      if (!fields || !['name', 'organization', 'email', 'phone', 'notes', 'nextStep', 'stage'].every(name => typeof fields[name as keyof ContactFields] === 'string')
        || !STAGES.includes(fields.stage) || !(fields.followUpDate === null || typeof fields.followUpDate === 'string')) return null;
    }
    if (d.pending && (!['POST', 'PATCH'].includes(d.pending.method) || ![ '/contacts', `/contacts/${d.id}`, `/contacts/${d.id}/archive`, `/contacts/${d.id}/tasks` ].includes(d.pending.path)
      || !d.pending.body || typeof d.pending.body !== 'object')) return null;
    return d;
  } catch { return null; }
}

export function CrmPage({ context }: PluginPageProps) {
  const host = useHostContext();
  if (!context.companyId) return <div className="aos-crm"><p>Select a company to open CRM.</p></div>;
  if (!host.userId) return <section className="aos-crm" aria-busy="true"><style>{styles}</style><p role="status">Loading CRM for your session…</p><button onClick={() => window.location.reload()}>Reload CRM</button></section>;
  return <Crm companyId={context.companyId} companyPrefix={context.companyPrefix} userId={host.userId} key={`${host.userId ?? ''}:${context.companyId}`} />;
}
function Crm({ companyId, companyPrefix, userId }: { companyId: string; companyPrefix: string | null; userId: string | null }) {
  const draftKey = userId ? `agents-os.crm.draft.v1:${userId}:${companyId}` : null;
  const [draft, setDraft] = useState<Draft | null>(() => readDraft(draftKey));
  const [detail, setDetail] = useState<ContactDetail | null>(null);
  const [listing, setListing] = useState<Listing | null>(null), [tasks, setTasks] = useState<Tasks | null>(null);
  const [search, setSearch] = useState(''), [query, setQuery] = useState(''), [mode, setMode] = useState('active');
  const [offset, setOffset] = useState(0), [taskOffset, setTaskOffset] = useState(0), [taskId, setTaskId] = useState('');
  const [loading, setLoading] = useState(false), [busy, setBusy] = useState(false), [refresh, setRefresh] = useState(0);
  const [error, setError] = useState(''), [listError, setListError] = useState(''), [taskError, setTaskError] = useState('');
  const [notice, setNotice] = useState(() => readDraft(draftKey) ? 'Unsaved draft restored for this company.' : '');
  const alive = useRef(true), requestId = useRef(0), editor = useRef<HTMLElement>(null), busyRef = useRef(false);
  const dirty = isDirty(draft), pending = draft?.pending ?? null;
  const frozen = busy || Boolean(pending), archived = Boolean(detail?.contact.archivedAt);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => {
    try {
      if (draftKey) { if (isDirty(draft)) sessionStorage.setItem(draftKey, JSON.stringify(draft)); else sessionStorage.removeItem(draftKey); }
    } catch { /* The in-memory draft remains usable if tab storage is unavailable. */ }
  }, [draftKey, draft]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  async function api<T>(path: string, method = 'GET', body?: unknown, signal?: AbortSignal): Promise<T> {
    let response: Response;
    try {
      response = await fetch(`/api/plugins/${PLUGIN_ID}/api${path}${path.includes('?') ? '&' : '?'}companyId=${encodeURIComponent(companyId)}`,
        { method, credentials: 'same-origin', cache: 'no-store', signal,
          ...(body === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }) });
    } catch (err) { if (signal?.aborted) throw err; throw new ApiError(0, 'Could not confirm the request. Your draft is kept.'); }
    const text = await response.text(); let data: unknown;
    try { data = JSON.parse(text); } catch { throw new ApiError(response.ok ? 503 : response.status, 'The response could not be confirmed. Your draft is kept.'); }
    if (!response.ok) throw new ApiError(response.status, typeof (data as { error?: unknown }).error === 'string' ? (data as { error: string }).error : 'Request failed. Your draft is kept.');
    return data as T;
  }
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setListError('');
    void api<Listing>('/contacts/search', 'POST', { q: query, mode, offset: String(offset) }, controller.signal)
      .then(data => { if (!controller.signal.aborted) setListing(data); })
      .catch(err => { if (!controller.signal.aborted) setListError((err as Error).message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [query, mode, offset, refresh]);
  useEffect(() => {
    if (!draft || draft.kind === 'new') { setTasks(null); return; }
    const controller = new AbortController(); setTaskId(''); setTaskError('');
    void api<Tasks>(`/tasks?offset=${taskOffset}`, 'GET', undefined, controller.signal)
      .then(data => { if (!controller.signal.aborted) setTasks(data); })
      .catch(err => { if (!controller.signal.aborted) setTaskError((err as Error).message); });
    return () => controller.abort();
  }, [draft?.id, draft?.kind, taskOffset, refresh]);
  useEffect(() => {
    if (!draft || draft.kind !== 'edit') return;
    const controller = new AbortController();
    void api<ContactDetail>(`/contacts/${draft.id}`, 'GET', undefined, controller.signal)
      .then(data => { if (!controller.signal.aborted) setDetail(current => current && current.contact.id === data.contact.id
        && current.contact.revision > data.contact.revision ? current : data); })
      .catch(err => { if (!controller.signal.aborted) setError((err as Error).message); });
    return () => controller.abort();
  }, [draft?.id, draft?.kind]);
  async function select(id: string, discard = true) {
    if (busyRef.current || (discard && dirty && !window.confirm(pending ? 'The operation may already be saved. Replace this local draft with the saved contact?' : 'Discard this unsaved draft and load the saved contact?'))) return;
    const owner = ++requestId.current; setBusy(true); busyRef.current = true; setError('');
    try {
      const data = await api<ContactDetail>(`/contacts/${id}`);
      if (!alive.current || owner !== requestId.current) return;
      const fields = fieldsOf(data.contact); setDetail(data); setDraft({ id, kind: 'edit', revision: data.contact.revision, fields, original: fields, pending: null });
      setTaskOffset(0); setNotice(''); editor.current?.scrollIntoView({ block: 'start' });
    } catch (err) { if (alive.current && owner === requestId.current) setError((err as Error).message); }
    finally { if (alive.current && owner === requestId.current) { setBusy(false); busyRef.current = false; } }
  }
  function add() {
    if (busyRef.current || (dirty && !window.confirm(pending ? 'The operation may already be saved. Close this local draft and add a new contact?' : 'Discard this unsaved draft and add a new contact?'))) return;
    requestId.current++; setDetail(null); setError(''); setNotice('');
    setDraft({ id: crypto.randomUUID(), kind: 'new', revision: 0, fields: { ...EMPTY }, original: { ...EMPTY }, pending: null });
  }
  function close() {
    if (busyRef.current || (dirty && !window.confirm(pending ? 'This operation may already be saved. Close the editor and check the contact list?' : 'Discard this unsaved draft?'))) return;
    requestId.current++; setDraft(null); setDetail(null); setError(''); setNotice(''); setRefresh(n => n + 1);
  }
  async function perform(operation: Operation) {
    if (!draft || busyRef.current) return;
    const owner = ++requestId.current, captured = { ...draft, pending: operation };
    busyRef.current = true; setBusy(true); setError(''); setNotice(''); setDraft(captured);
    try { if (draftKey) sessionStorage.setItem(draftKey, JSON.stringify(captured)); } catch {}
    try {
      const result = await api<MutationResult>(operation.path, operation.method, operation.body);
      if (!alive.current || owner !== requestId.current) return;
      const fields = fieldsOf(result.contact); setDetail(result); setDraft({ id: result.contact.id, kind: 'edit', revision: result.contact.revision, fields, original: fields, pending: null });
      setNotice(result.contact.activityPending ? 'Contact saved. Activity log delivery is pending.' : result.replayed ? 'Saved operation confirmed.' : 'Contact saved.');
      setRefresh(n => n + 1);
    } catch (err) {
      if (!alive.current || owner !== requestId.current) return;
      if (err instanceof ApiError && err.status > 0 && err.status < 500) setDraft({ ...captured, pending: null });
      setError((err as Error).message);
    } finally { if (alive.current && owner === requestId.current) { busyRef.current = false; setBusy(false); } }
  }
  function save(event: FormEvent) {
    event.preventDefault(); if (!draft || frozen) return;
    void perform({ path: draft.kind === 'new' ? '/contacts' : `/contacts/${draft.id}`, method: draft.kind === 'new' ? 'POST' : 'PATCH',
      body: { ...(draft.kind === 'new' ? { id: draft.id } : { revision: draft.revision }), operationId: crypto.randomUUID(), ...draft.fields } });
  }
  function change<K extends keyof ContactFields>(key: K, value: ContactFields[K]) {
    setDraft(current => current ? { ...current, fields: { ...current.fields, [key]: value } } : current); setNotice('');
  }
  function modify(action: 'archive' | 'tasks', body: Record<string, unknown>) {
    if (!draft || dirty || frozen) return;
    void perform({ path: `/contacts/${draft.id}/${action}`, method: 'POST', body: { revision: draft.revision, operationId: crypto.randomUUID(), ...body } });
  }
  async function retryActivity() {
    if (!draft || dirty || busyRef.current) return;
    busyRef.current = true; setBusy(true); setError('');
    try {
      const data = await api<ContactDetail>(`/contacts/${draft.id}/activity`, 'POST', {});
      if (alive.current) { setDetail(data); setNotice(data.contact.activityPending ? 'Some activity delivery is still pending. You can retry.' : 'Activity log is up to date.'); }
    } catch (err) { if (alive.current) setError((err as Error).message); }
    finally { if (alive.current) { busyRef.current = false; setBusy(false); } }
  }
  return <section className="aos-crm" data-editing={Boolean(draft)} aria-label="CRM">
    <style>{styles}</style>
    <header><div><h1>Relationships</h1><p className="aos-muted">Contacts, next steps and the work that connects them.</p></div><button className="aos-primary" onClick={add} disabled={busy}>Add contact</button></header>
    {notice && <div className="aos-message" role="status">{notice}</div>}
    {error && <div className="aos-message aos-error" role="alert">{error}
      {pending && <><p>The operation may already be saved. Retry it safely or load the saved contact.</p><button onClick={() => void perform(pending)} disabled={busy}>Retry operation</button></>}
      {draft && <button onClick={() => void select(draft.id)} disabled={busy}>Load saved contact</button>}
    </div>}
    <div className="aos-layout">
      <aside className="aos-contact-list" aria-label="Contact list">
        <div className="aos-toolbar">
          <form onSubmit={event => { event.preventDefault(); setQuery(search); setOffset(0); }}><label style={{ minWidth: 0, flex: 1 }}><span className="aos-muted">Search contacts</span><input value={search} onChange={event => setSearch(event.target.value)} maxLength={120} placeholder="Name, company or email" /></label><button type="submit" disabled={busy} style={{ alignSelf: 'end' }}>Search</button></form>
          <label>Show<select aria-label="Show" value={mode} disabled={busy} onChange={event => { setMode(event.target.value); setOffset(0); }}><option value="active">Active contacts</option><option value="archived">Archived contacts</option><option value="all">All contacts</option></select></label>
        </div>
        {loading && <p role="status" className="aos-muted">Loading contacts…</p>}
        {listError && <div role="alert" className="aos-message aos-error">{listError}<button onClick={() => setRefresh(n => n + 1)}>Retry list</button></div>}
        {!loading && !listError && listing?.contacts.length === 0 && <div className="aos-empty"><h2>No contacts found</h2><p className="aos-muted">Add a contact or change your search.</p></div>}
        {!listError && listing?.contacts.map(contact => <button key={contact.id} className="aos-card" aria-pressed={draft?.id === contact.id} disabled={busy} onClick={() => void select(contact.id)}>
          <strong>{contact.name}</strong><span className="aos-muted">{contact.organization || contact.email || 'No organization added'}</span>
          <small>{contact.archivedAt ? 'Archived' : contact.stage}</small>{contact.followUpDate && <span className="aos-muted">Follow up {contact.followUpDate}</span>}
        </button>)}
        <div className="aos-row"><button disabled={busy || loading || offset === 0} onClick={() => setOffset(n => Math.max(0, n - 30))}>Previous contacts</button><button disabled={busy || loading || !listing?.hasMore} onClick={() => setOffset(n => n + 30)}>Next contacts</button></div>
      </aside>
      <section className="aos-panel" ref={editor} aria-label="Contact editor">
        {!draft ? <div className="aos-empty"><h2>Your relationships, in context</h2><p className="aos-muted">Select a contact to see details, next steps and linked tasks.</p><button onClick={add}>Create a contact</button></div> : <>
          <button className="aos-mobile-back" onClick={close} disabled={busy}>Back to contacts</button>
          <div className="aos-row"><h2>{draft.kind === 'new' ? 'New contact' : draft.original.name}</h2><button onClick={close} disabled={busy}>Close editor</button></div>
          <p className="aos-muted">{archived ? 'Archived. Restore this contact to edit it.' : dirty ? 'Unsaved changes' : draft.kind === 'edit' ? 'Saved contact' : 'Add the details you know.'}</p>
          {pending && !error && <div className="aos-message">An operation is waiting for confirmation. <button disabled={busy} onClick={() => void perform(pending)}>Retry operation</button><button disabled={busy} onClick={() => void select(draft.id)}>Load saved contact</button></div>}
          <form className="aos-form" onSubmit={save} aria-label="Contact details">
            <fieldset disabled={frozen || archived}><div className="aos-fields">
              <label>Name<input required maxLength={120} value={draft.fields.name} onChange={event => change('name', event.target.value)} autoComplete="off" /></label>
              <label>Organization<input maxLength={160} value={draft.fields.organization} onChange={event => change('organization', event.target.value)} autoComplete="off" /></label>
              <label>Email<input type="email" maxLength={254} value={draft.fields.email} onChange={event => change('email', event.target.value)} autoComplete="off" /></label>
              <label>Phone<input type="tel" maxLength={48} value={draft.fields.phone} onChange={event => change('phone', event.target.value)} autoComplete="off" /></label>
              <label>Stage<select aria-label="Stage" value={draft.fields.stage} onChange={event => change('stage', event.target.value as ContactFields['stage'])}>{STAGES.map(stage => <option key={stage} value={stage}>{stage[0]?.toUpperCase()}{stage.slice(1)}</option>)}</select></label>
              <label>Follow-up date<input type="date" value={draft.fields.followUpDate ?? ''} onChange={event => change('followUpDate', event.target.value || null)} /></label>
              <label className="aos-wide">Next step<input maxLength={280} value={draft.fields.nextStep} onChange={event => change('nextStep', event.target.value)} /></label>
              <label className="aos-wide">Notes<textarea aria-label="Notes" maxLength={6000} value={draft.fields.notes} onChange={event => change('notes', event.target.value)} /></label>
            </div></fieldset>
            <div className="aos-row"><button type="submit" className="aos-primary" disabled={frozen || archived || (!dirty && draft.kind !== 'new')}>{busy ? 'Saving…' : 'Save contact'}</button>
              {draft.kind === 'edit' && <button type="button" disabled={frozen || dirty} onClick={() => modify('archive', { archived: !archived })}>{archived ? 'Restore contact' : 'Archive contact'}</button>}</div>
          </form>
          {draft.kind === 'edit' && <>
            {detail?.contact.activityPending && <div className="aos-message" style={{ marginTop: 16 }}>Contact saved; activity delivery is pending.<button onClick={() => void retryActivity()} disabled={busy || dirty}>Retry activity delivery</button></div>}
            <section className="aos-section" aria-label="Linked tasks"><h3>Linked tasks</h3>
              {!detail?.tasks.length && <p className="aos-muted">No tasks linked yet.</p>}
              {detail?.tasks.map(task => <div className="aos-task" key={task.id}><div><a href={`/${encodeURIComponent(companyPrefix ?? companyId)}/issues/${encodeURIComponent(task.identifier ?? task.id)}`}>{task.identifier} {task.title}</a><small>{task.status}</small></div><button disabled={frozen || dirty || archived} onClick={() => modify('tasks', { issueId: task.id, linked: false })}>Unlink</button></div>)}
              {detail?.unavailableTaskIds.map(id => <div className="aos-task" key={id}><span className="aos-muted">Task is no longer available.</span><button disabled={frozen || dirty || archived} onClick={() => modify('tasks', { issueId: id, linked: false })}>Remove link</button></div>)}
              {!archived && <div className="aos-picker"><label>Choose a task<select aria-label="Choose a task" value={taskId} disabled={frozen || dirty} onChange={event => setTaskId(event.target.value)}><option value="">Select from this company</option>{tasks?.tasks.filter(task => !detail?.contact.linkedIssueIds.includes(task.id)).map(task => <option key={task.id} value={task.id}>{task.identifier} {task.title}</option>)}</select></label>
                <div className="aos-row"><button disabled={frozen || dirty || !taskId} onClick={() => modify('tasks', { issueId: taskId, linked: true })}>Link task</button><button disabled={busy} onClick={() => setRefresh(n => n + 1)}>Refresh tasks</button></div>
                <div className="aos-row"><button disabled={busy || taskOffset === 0} onClick={() => setTaskOffset(n => Math.max(0, n - 50))}>Previous tasks</button><button disabled={busy || !tasks?.hasMore} onClick={() => setTaskOffset(n => n + 50)}>Next tasks</button></div>
                {dirty && <p className="aos-muted">Save or discard changes before linking tasks.</p>}{taskError && <p role="alert">{taskError}</p>}
              </div>}
            </section>
            <section className="aos-section"><h3>Recent changes</h3><ol className="aos-audit">{detail?.contact.audit.slice().reverse().map(event => <li key={event.id}>{event.action} · <time dateTime={event.at}>{new Date(event.at).toLocaleString()}</time></li>)}</ol></section>
          </>}
        </>}
      </section>
    </div>
  </section>;
}
