import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useHostContext, type PluginPageProps } from '@paperclipai/plugin-sdk/ui';
import { PLUGIN_ID, type TaskLink } from '../model.js';
import { MISSION_PHASES, type CheckpointPlan, type MissionAction, type MissionDetail, type MissionPlan, type MissionSummary } from '../missions/model.js';
import { styles } from './styles.js';
type Draft = { id: string; revision: number; plan: MissionPlan; original: MissionPlan | null };
type Operation = { path: string; body: Record<string, unknown> };
type Work = { selected: string | null; draft: Draft | null; note: string; pending: Operation | null };
const blank = (): Work => ({ selected: null, draft: null, note: '', pending: null });
const newCheckpoint = (): CheckpointPlan => ({ id: crypto.randomUUID(), title: '', acceptance: '', issueId: null });
const planOf = (detail: MissionDetail): MissionPlan => ({ title: detail.mission.title, objective: detail.mission.objective,
  checkpoints: detail.mission.checkpoints.map(({ id, title, acceptance, issueId }) => ({ id, title, acceptance, issueId })) });
const dirty = (work: Work) => Boolean(work.pending || work.note || work.draft && (!work.draft.original || JSON.stringify(work.draft.plan) !== JSON.stringify(work.draft.original)));
function restore(key: string): Work {
  try {
    const work = JSON.parse(sessionStorage.getItem(key) ?? 'null') as Work | null;
    const validId = (id: unknown) => typeof id === 'string' && /^[a-f0-9-]{36}$/i.test(id);
    if (!work || !(work.selected === null || validId(work.selected)) || typeof work.note !== 'string' || work.note.length > 4000) return blank();
    if (work.draft && (!validId(work.draft.id) || !Number.isSafeInteger(work.draft.revision) || !work.draft.plan || typeof work.draft.plan.title !== 'string'
      || typeof work.draft.plan.objective !== 'string' || !Array.isArray(work.draft.plan.checkpoints) || work.draft.plan.checkpoints.length > 20
      || !work.draft.plan.checkpoints.every(row => validId(row.id) && typeof row.title === 'string' && typeof row.acceptance === 'string' && (row.issueId === null || validId(row.issueId))))) return blank();
    if (work.pending && (!/^\/missions(?:\/[a-f0-9-]{36}\/(?:commands|activity))?$/i.test(work.pending.path) || !work.pending.body || typeof work.pending.body !== 'object')) return blank();
    return work;
  } catch { return blank(); }
}
class ApiError extends Error { constructor(public status: number, message: string) { super(message); } }
export function MissionsPage({ context }: PluginPageProps) {
  const host = useHostContext();
  if (!context.companyId) return <div className="aos-crm"><p>Select a company to open Missions.</p></div>;
  if (!host.userId) return <div className="aos-crm" role="status">Loading Missions for your session…</div>;
  return <Missions companyId={context.companyId} prefix={context.companyPrefix ?? context.companyId} userId={host.userId} key={`${host.userId}:${context.companyId}`} />;
}
function Missions({ companyId, prefix, userId }: { companyId: string; prefix: string; userId: string }) {
  const key = `agents-os.missions.work.v1:${userId}:${companyId}`;
  const [work, setWork] = useState<Work>(() => restore(key));
  const [detail, setDetail] = useState<MissionDetail | null>(null);
  const [list, setList] = useState<{ missions: MissionSummary[]; hasMore: boolean } | null>(null);
  const [tasks, setTasks] = useState<{ tasks: TaskLink[]; hasMore: boolean } | null>(null);
  const [search, setSearch] = useState(''), [query, setQuery] = useState(''), [phase, setPhase] = useState('all');
  const [offset, setOffset] = useState(0), [taskOffset, setTaskOffset] = useState(0), [refresh, setRefresh] = useState(0);
  const [busy, setBusy] = useState(false), [loading, setLoading] = useState(false), [listLoading, setListLoading] = useState(false);
  const [error, setError] = useState(''), [listError, setListError] = useState(''), [taskError, setTaskError] = useState('');
  const [notice, setNotice] = useState(() => dirty(restore(key)) ? 'Mission draft restored for this company.' : '');
  const active = useRef(true), busyRef = useRef(false), owner = useRef(0), panel = useRef<HTMLElement>(null);
  const frozen = busy || Boolean(work.pending), hasDraft = dirty(work);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  useEffect(() => { try { sessionStorage.setItem(key, JSON.stringify(work)); } catch {} }, [key, work]);
  useEffect(() => {
    if (!hasDraft) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn);
  }, [hasDraft]);
  useEffect(() => { const update = () => { if (!busyRef.current) setRefresh(n => n + 1); }; window.addEventListener('focus', update); return () => window.removeEventListener('focus', update); }, []);
  async function api<T>(path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
    let response: Response;
    try { response = await fetch(`/api/plugins/${PLUGIN_ID}/api${path}${path.includes('?') ? '&' : '?'}companyId=${encodeURIComponent(companyId)}`, {
      method: body === undefined ? 'GET' : 'POST', credentials: 'same-origin', cache: 'no-store', signal,
      ...(body === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }) }); }
    catch (err) { if (signal?.aborted) throw err; throw new ApiError(0, 'Could not confirm this Mission request. Your draft is kept.'); }
    let data: unknown;
    try { data = JSON.parse(await response.text()); } catch { throw new ApiError(503, 'The response could not be confirmed. Your draft is kept.'); }
    if (!response.ok) throw new ApiError(response.status, typeof (data as { error?: unknown }).error === 'string' ? (data as { error: string }).error : 'Mission request failed. Your draft is kept.');
    return data as T;
  }
  useEffect(() => {
    const controller = new AbortController(); setListLoading(true); setListError('');
    void api<{ missions: MissionSummary[]; hasMore: boolean }>('/missions/search', { q: query, phase, offset: String(offset) }, controller.signal)
      .then(data => { if (!controller.signal.aborted) setList(data); }).catch(err => { if (!controller.signal.aborted) setListError((err as Error).message); })
      .finally(() => { if (!controller.signal.aborted) setListLoading(false); });
    return () => controller.abort();
  }, [query, phase, offset, refresh]);
  useEffect(() => {
    if (!work.draft) { setTasks(null); return; }
    const controller = new AbortController(); setTaskError('');
    void api<{ tasks: TaskLink[]; hasMore: boolean }>(`/tasks?offset=${taskOffset}`, undefined, controller.signal)
      .then(data => { if (!controller.signal.aborted) setTasks(data); }).catch(err => { if (!controller.signal.aborted) setTaskError((err as Error).message); });
    return () => controller.abort();
  }, [Boolean(work.draft), taskOffset, refresh]);
  useEffect(() => {
    if (!work.selected) { setDetail(null); return; }
    const controller = new AbortController(); setLoading(true);
    void api<MissionDetail>(`/missions/${work.selected}`, undefined, controller.signal)
      .then(data => { if (!controller.signal.aborted) setDetail(current => current?.mission.id === data.mission.id && current.mission.revision > data.mission.revision ? current : data); })
      .catch(err => { if (!controller.signal.aborted) setError((err as Error).message); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [work.selected, refresh]);
  function mayReplace() { return !busyRef.current && (!hasDraft || window.confirm(work.pending ? 'This operation may already be saved. Replace the local draft with saved work?' : 'Discard the unsaved Mission draft?')); }
  function choose(id: string) {
    if (!mayReplace()) return; owner.current++; setDetail(null); setWork({ ...blank(), selected: id }); setError(''); setNotice(''); setRefresh(n => n + 1); panel.current?.scrollIntoView({ block: 'start' });
  }
  function add() {
    if (!mayReplace()) return; owner.current++; setDetail(null); setError(''); setNotice('');
    setWork({ ...blank(), draft: { id: crypto.randomUUID(), revision: 0, original: null, plan: { title: '', objective: '', checkpoints: [newCheckpoint()] } } });
  }
  function edit() {
    if (!detail || frozen || !mayReplace()) return;
    const plan = planOf(detail); setWork({ selected: detail.mission.id, draft: { id: detail.mission.id, revision: detail.mission.revision, original: plan, plan: structuredClone(plan) }, note: '', pending: null }); setError(''); setNotice('');
  }
  async function loadSaved() {
    if (!mayReplace()) return;
    const id = work.selected ?? work.draft?.id; if (!id) return;
    const generation = ++owner.current; busyRef.current = true; setBusy(true); setError('');
    try { const data = await api<MissionDetail>(`/missions/${id}`); if (!active.current || generation !== owner.current) return; setDetail(data); setWork({ ...blank(), selected: id }); setNotice('Saved Mission loaded.'); setRefresh(n => n + 1); }
    catch (err) { if (active.current && generation === owner.current) setError((err as Error).message); }
    finally { if (active.current && generation === owner.current) { busyRef.current = false; setBusy(false); } }
  }
  async function perform(operation: Operation) {
    if (busyRef.current) return;
    const generation = ++owner.current, captured = { ...work, pending: operation }; busyRef.current = true; setBusy(true); setError(''); setNotice(''); setWork(captured);
    try { sessionStorage.setItem(key, JSON.stringify(captured)); } catch {}
    try {
      const data = await api<MissionDetail>(operation.path, operation.body); if (!active.current || generation !== owner.current) return;
      setDetail(data); setWork({ ...blank(), selected: data.mission.id }); setNotice(data.replayed ? 'Saved Mission operation confirmed.' : 'Mission saved.'); setRefresh(n => n + 1);
    } catch (err) {
      if (!active.current || generation !== owner.current) return;
      if (err instanceof ApiError && err.status > 0 && err.status < 500) setWork({ ...captured, pending: null });
      setError((err as Error).message);
    } finally { if (active.current && generation === owner.current) { busyRef.current = false; setBusy(false); } }
  }
  function savePlan(event: FormEvent) {
    event.preventDefault(); if (!work.draft || frozen) return;
    const draft = work.draft;
    void perform(draft.original ? { path: `/missions/${draft.id}/commands`, body: { operationId: crypto.randomUUID(), revision: draft.revision, action: 'edit', plan: draft.plan } }
      : { path: '/missions', body: { id: draft.id, operationId: crypto.randomUUID(), plan: draft.plan } });
  }
  function command(action: MissionAction, checkpointId?: string) {
    if (!detail || frozen || work.draft) return;
    if (action === 'reopen' && !window.confirm('Reopen this checkpoint and all following checkpoints? Their review history is preserved.')) return;
    const index = detail.mission.checkpoints.findIndex(row => row.id === checkpointId), task = detail.tasks[index];
    void perform({ path: `/missions/${detail.mission.id}/commands`, body: { operationId: crypto.randomUUID(), revision: detail.mission.revision, action,
      ...(checkpointId ? { checkpointId } : {}), ...(['approve', 'request_changes'].includes(action) ? { taskUpdatedAt: task?.updatedAt } : {}), ...(!['start', 'edit'].includes(action) ? { note: work.note } : {}) } });
  }
  function changePlan(plan: MissionPlan) { setWork(current => current.draft ? { ...current, draft: { ...current.draft, plan } } : current); setNotice(''); }
  function changeCheckpoint(index: number, patch: Partial<CheckpointPlan>) { if (work.draft) changePlan({ ...work.draft.plan, checkpoints: work.draft.plan.checkpoints.map((row, n) => n === index ? { ...row, ...patch } : row) }); }
  const mission = detail?.mission, noteReady = Boolean(work.note.trim()), planning = work.draft?.plan;
  const reviewed = (id: string) => mission?.checkpoints.find(row => row.id === id)?.review?.decision === 'approved';
  const close = () => { if (mayReplace()) { owner.current++; setWork(blank()); setDetail(null); setError(''); setNotice(''); } };
  return <section className="aos-crm aos-missions" aria-label="Missions" data-editing={Boolean(work.selected || work.draft)}>
    <style>{styles + missionStyles}</style>
    <header><div><h1>Missions</h1><p className="aos-muted">Keep long-term work moving, one reviewed checkpoint at a time.</p></div><button className="aos-primary" onClick={add} disabled={busy}>New Mission</button></header>
    {notice && <div role="status" className="aos-message">{notice}</div>}
    {error && <div role="alert" className="aos-message aos-error">{error}{work.pending && <><p>The operation may already be saved.</p><button onClick={() => void perform(work.pending!)} disabled={busy}>Retry Mission operation</button></>}
      {(work.selected || work.draft) && <button onClick={() => void loadSaved()} disabled={busy}>Load saved Mission</button>}</div>}
    {work.pending && !error && <div className="aos-message">An operation is waiting for confirmation.<button disabled={busy} onClick={() => void perform(work.pending!)}>Retry Mission operation</button><button disabled={busy} onClick={() => void loadSaved()}>Load saved Mission</button></div>}
    <div className="aos-layout">
      <aside className="aos-contact-list" aria-label="Mission list"><div className="aos-toolbar">
        <form onSubmit={event => { event.preventDefault(); setQuery(search); setOffset(0); }}><label>Search Missions<input value={search} maxLength={120} onChange={event => setSearch(event.target.value)} /></label><button disabled={busy}>Search</button></form>
        <label>Mission phase<select aria-label="Mission phase" value={phase} disabled={busy} onChange={event => { setPhase(event.target.value); setOffset(0); }}><option value="all">All Missions</option>{MISSION_PHASES.map(value => <option key={value} value={value}>{value}</option>)}</select></label>
      </div>
        {listLoading && <p role="status">Loading Missions…</p>}{listError && <div role="alert">{listError}<button onClick={() => setRefresh(n => n + 1)}>Retry Mission list</button></div>}
        {!listLoading && !listError && !list?.missions.length && <p className="aos-muted">No Missions found. Create one to plan the work ahead.</p>}
        {list?.missions.map(row => <button className="aos-card" key={row.id} disabled={busy} aria-pressed={row.id === work.selected} onClick={() => choose(row.id)}><strong>{row.title}</strong><span>{row.reviewedCheckpoints}/{row.totalCheckpoints} checkpoints reviewed</span><small>{row.phase}</small></button>)}
        <div className="aos-row"><button disabled={busy || listLoading || !offset} onClick={() => setOffset(n => Math.max(0, n - 30))}>Previous Missions</button><button disabled={busy || listLoading || !list?.hasMore} onClick={() => setOffset(n => n + 30)}>Next Missions</button></div>
      </aside>
      <section className="aos-panel" aria-label="Mission workspace" ref={panel}>
        {(work.selected || work.draft) && <button className="aos-mobile-back" disabled={busy} onClick={close}>Back to Missions</button>}
        {loading && <p role="status">Refreshing Mission and native Tasks…</p>}
        {planning ? <form onSubmit={savePlan} aria-label="Mission plan" className="aos-form">
          <div className="aos-row"><h2>{work.draft?.original ? 'Edit Mission plan' : 'New Mission plan'}</h2><button type="button" onClick={close} disabled={busy}>Close plan</button></div>
          <fieldset disabled={frozen}><label>Mission title<input required maxLength={120} value={planning.title} onChange={event => changePlan({ ...planning, title: event.target.value })} /></label>
            <label>Objective<textarea aria-label="Objective" required maxLength={8000} value={planning.objective} onChange={event => changePlan({ ...planning, objective: event.target.value })} /></label>
            <p className="aos-muted">Define acceptance criteria and link a distinct native Task to each checkpoint. Tasks keep their own execution and pause controls.</p>
            {planning.checkpoints.map((row, index) => <section className="aos-checkpoint" key={row.id} aria-label={`Checkpoint ${index + 1}`}>
              <h3>Checkpoint {index + 1}</h3>{reviewed(row.id) && <p className="aos-muted">Reviewed. Reopen this checkpoint before changing it.</p>}
              <fieldset disabled={frozen || reviewed(row.id)}><label>Checkpoint title<input aria-label={`Checkpoint ${index + 1} title`} required maxLength={160} value={row.title} onChange={event => changeCheckpoint(index, { title: event.target.value })} /></label>
                <label>Acceptance criteria<textarea aria-label={`Checkpoint ${index + 1} criteria`} required maxLength={2000} value={row.acceptance} onChange={event => changeCheckpoint(index, { acceptance: event.target.value })} /></label>
                <label>Native Task<select aria-label={`Checkpoint ${index + 1} Task`} value={row.issueId ?? ''} onChange={event => changeCheckpoint(index, { issueId: event.target.value || null })}><option value="">Link a Task later</option>
                  {row.issueId && !tasks?.tasks.some(task => task.id === row.issueId) && <option value={row.issueId}>{detail?.tasks.find(task => task?.id === row.issueId)?.title ?? 'Linked Task'}</option>}
                  {tasks?.tasks.map(task => <option key={task.id} value={task.id}>{task.identifier} {task.title}</option>)}</select></label>
                <div className="aos-row"><button type="button" disabled={index === 0 || reviewed(planning.checkpoints[index - 1]?.id ?? '')} onClick={() => { const rows = planning.checkpoints.slice(); [rows[index - 1], rows[index]] = [rows[index]!, rows[index - 1]!]; changePlan({ ...planning, checkpoints: rows }); }}>Move up</button>
                  <button type="button" disabled={index === planning.checkpoints.length - 1 || reviewed(planning.checkpoints[index + 1]?.id ?? '')} onClick={() => { const rows = planning.checkpoints.slice(); [rows[index], rows[index + 1]] = [rows[index + 1]!, rows[index]!]; changePlan({ ...planning, checkpoints: rows }); }}>Move down</button>
                  <button type="button" disabled={planning.checkpoints.length === 1} onClick={() => changePlan({ ...planning, checkpoints: planning.checkpoints.filter((_, n) => n !== index) })}>Remove checkpoint</button></div>
              </fieldset>
            </section>)}
            <button type="button" disabled={planning.checkpoints.length >= 20} onClick={() => changePlan({ ...planning, checkpoints: [...planning.checkpoints, newCheckpoint()] })}>Add checkpoint</button>
            <div className="aos-row"><button type="button" disabled={!taskOffset} onClick={() => setTaskOffset(n => Math.max(0, n - 50))}>Previous Tasks</button><button type="button" disabled={!tasks?.hasMore} onClick={() => setTaskOffset(n => n + 50)}>Next Tasks</button></div>
            {taskError && <p role="alert">{taskError}</p>}
          </fieldset><button className="aos-primary" disabled={frozen} type="submit">{busy ? 'Saving…' : 'Save Mission plan'}</button>
        </form> : detail && mission ? <>
          <div className="aos-row"><h2>{mission.title}</h2><button disabled={frozen} onClick={close}>Close Mission</button></div>
          <p className="aos-phase" role="status">{detail.status.replaceAll('_', ' ')} · {detail.approvedCount}/{mission.checkpoints.length} checkpoints approved</p>
          <progress max={mission.checkpoints.length} value={detail.approvedCount} aria-label="Mission progress" />
          <p className="aos-prose">{mission.objective}</p>{mission.reason && <p className="aos-message aos-prose">{mission.reason}</p>}
          {detail.changedCheckpointIds.length > 0 && <div role="alert" className="aos-message aos-error">A reviewed Task changed. Reopen the earliest affected checkpoint before continuing.</div>}
          <div className="aos-row"><button disabled={frozen} onClick={() => setRefresh(n => n + 1)}>Refresh Mission</button>{['draft', 'paused'].includes(mission.phase) && <button disabled={frozen} onClick={edit}>Edit plan</button>}</div>
          <p className="aos-muted">Status is checked when you open or refresh. Pausing holds Mission progression; linked Tasks keep their own controls.</p>
          {mission.checkpoints.map((row, index) => {
            const task = detail.tasks[index], changed = detail.changedCheckpointIds.includes(row.id), reviewable = mission.phase === 'running' && index === detail.currentIndex && !detail.changedCheckpointIds.length && task?.status === 'done';
            return <section key={row.id} className="aos-checkpoint" aria-label={`Checkpoint ${index + 1}`}>
              <div className="aos-row"><h3>{index + 1}. {row.title}</h3><small>{changed ? 'Review invalidated' : row.review?.decision === 'approved' ? 'Approved' : index === detail.currentIndex ? 'Current checkpoint' : 'Upcoming'}</small></div>
              <p className="aos-prose">{row.acceptance}</p>{task ? <p><a href={`/${encodeURIComponent(prefix)}/issues/${encodeURIComponent(task.identifier ?? task.id)}`}>{task.identifier} {task.title}</a> · {task.status}</p> : <p className="aos-muted">{row.issueId ? 'Linked Task is no longer available.' : 'No Task linked yet.'}</p>}
              {row.review && <div className="aos-review"><strong>{row.review.decision === 'approved' ? 'Review evidence' : 'Rework requested'}</strong><p className="aos-prose">{row.review.evidence}</p></div>}
              <div className="aos-row">{reviewable && <><button disabled={frozen || !noteReady} onClick={() => command('approve', row.id)}>Approve checkpoint</button><button disabled={frozen || !noteReady} onClick={() => command('request_changes', row.id)}>Request changes</button></>}
                {mission.phase !== 'draft' && <button disabled={frozen || !noteReady} onClick={() => command('reopen', row.id)}>Reopen from here</button>}</div>
            </section>;
          })}
          <label className="aos-section">Evidence or reason<textarea aria-label="Evidence or reason" maxLength={4000} value={work.note} disabled={frozen} onChange={event => setWork(current => ({ ...current, note: event.target.value }))} placeholder="Record what you reviewed, or why the Mission needs to pause, reopen or stop." /></label>
          <div className="aos-row aos-section">
            {['draft', 'paused'].includes(mission.phase) && <button className="aos-primary" disabled={frozen} onClick={() => command('start')}>{mission.phase === 'draft' ? 'Start Mission' : 'Resume Mission'}</button>}
            {mission.phase === 'running' && <><button disabled={frozen || !noteReady} onClick={() => command('pause')}>Pause Mission</button><button className="aos-primary" disabled={frozen || !noteReady || detail.currentIndex >= 0} onClick={() => command('complete')}>Complete Mission</button></>}
            {!['completed', 'cancelled'].includes(mission.phase) && <button disabled={frozen || !noteReady} onClick={() => command('cancel')}>Cancel Mission</button>}
          </div>
          {mission.completion && <section className="aos-section"><h3>Completion evidence</h3><p className="aos-prose">{mission.completion.evidence}</p><time dateTime={mission.completion.at}>{new Date(mission.completion.at).toLocaleString()}</time></section>}
          {mission.activityPending && <div className="aos-message">Mission saved; activity delivery is pending.<button disabled={frozen} onClick={() => void perform({ path: `/missions/${mission.id}/activity`, body: {} })}>Retry Mission activity</button></div>}
          <section className="aos-section"><h3>Decision history</h3><ol className="aos-audit">{mission.history.slice().reverse().map(event => <li key={event.id}>{event.action.replaceAll('_', ' ')} · <time dateTime={event.at}>{new Date(event.at).toLocaleString()}</time>{event.note && <p className="aos-prose">{event.note}</p>}</li>)}</ol></section>
        </> : !work.selected && <div className="aos-empty"><h2>Give long-term work a clear path</h2><p>Set an objective, link native Tasks, and review evidence at each checkpoint.</p><button onClick={add}>Create a Mission</button></div>}
      </section>
    </div>
  </section>;
}
const missionStyles = `.aos-missions .aos-form>fieldset{display:grid;gap:18px}.aos-missions .aos-checkpoint{min-width:0;border:1px solid var(--border,#dce3df);padding:16px;border-radius:9px;margin:18px 0;display:grid;gap:12px}.aos-missions .aos-checkpoint fieldset{display:grid;gap:12px}.aos-missions h3{margin:0;font-size:16px;overflow-wrap:anywhere}.aos-missions .aos-prose{white-space:pre-wrap;overflow-wrap:anywhere}.aos-missions progress{width:100%;height:8px;accent-color:#20584e;margin:8px 0 16px}.aos-missions .aos-phase{text-transform:capitalize;margin-top:12px}.aos-missions .aos-review{border-left:3px solid #368478;padding-left:12px}.aos-missions label.aos-section{display:block}.aos-missions a{color:inherit;overflow-wrap:anywhere}`;
