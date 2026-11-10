import { useEffect, useRef, useState } from 'react';
import { useHostContext, type PluginPageProps } from '@paperclipai/plugin-sdk/ui';
import { PACK_VERSION, PLUGIN_ID, type HarnessState } from '../model.js';

const styles = `
.aos-harness{max-width:1040px;margin:auto;padding:28px;color:var(--foreground,#202326);font:14px/1.6 system-ui,sans-serif}
.aos-harness *{box-sizing:border-box}.aos-harness h1{font-size:30px;letter-spacing:-.8px;margin:0}.aos-harness h2{font-size:18px;margin:0 0 8px}
.aos-harness header{display:flex;justify-content:space-between;gap:20px;align-items:start;margin-bottom:24px}.aos-harness p{margin:8px 0 16px}
.aos-harness .muted{color:var(--muted-foreground,#657078)}.aos-harness .cards{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}
.aos-harness article,.aos-harness .panel{border:1px solid var(--border,#d8dce0);border-radius:12px;padding:20px;margin-bottom:16px;min-width:0;overflow-wrap:anywhere}
.aos-harness .tag{display:inline-block;padding:2px 9px;background:var(--muted,#eef1f3);border-radius:20px;font-size:12px;margin:0 5px 6px 0}
.aos-harness button{border:1px solid var(--border,#c6cdd2);border-radius:7px;padding:9px 13px;background:var(--background,#fff);color:inherit;font:inherit;cursor:pointer}
.aos-harness button:disabled{opacity:.55;cursor:default}.aos-harness .primary{background:#244e43;color:#fff;border-color:#244e43}
.aos-harness button:focus-visible,.aos-harness a:focus-visible{outline:3px solid #6dbaa4;outline-offset:3px}.aos-harness a{color:var(--primary,#246f59);text-underline-offset:3px;overflow-wrap:anywhere}
.aos-harness .row{display:flex;align-items:center;gap:12px;flex-wrap:wrap}.aos-harness [role=alert]{border-color:#b56a51;background:var(--background,#fff8f5)}
.aos-harness dl{display:grid;grid-template-columns:auto minmax(0,1fr);gap:4px 16px}.aos-harness dd{margin:0;overflow-wrap:anywhere}.aos-harness dt{color:var(--muted-foreground,#657078)}
@media(max-width:600px){.aos-harness{padding:18px 12px}.aos-harness header{flex-direction:column;gap:8px}.aos-harness .cards{grid-template-columns:minmax(0,1fr)}.aos-harness article,.aos-harness .panel{padding:16px}.aos-harness h1{font-size:26px}}
`;
export function HarnessPage({ context }: PluginPageProps) {
  const host = useHostContext();
  if (!context.companyId) return <div className="aos-harness"><p>Select a company to open Shared Harness.</p></div>;
  if (!host.userId) return <div className="aos-harness" role="status">Loading Shared Harness for your session…</div>;
  return <Harness company={context.companyId} prefix={context.companyPrefix ?? context.companyId} user={host.userId} key={`${host.userId}:${context.companyId}`} />;
}
function Harness({ company, prefix, user }: { company: string; prefix: string; user: string }) {
  const storageKey = `agents-os:harness:${PACK_VERSION}:${user}:${company}`;
  const [state, setState] = useState<HarnessState | null>(null), [loading, setLoading] = useState(true);
  const [error, setError] = useState(''), [notice, setNotice] = useState(''), [busy, setBusy] = useState(false);
  const [pending, setPending] = useState(() => { try { return sessionStorage.getItem(storageKey) === 'pending'; } catch { return false; } });
  const [refresh, setRefresh] = useState(0), alive = useRef(true), busyRef = useRef(false);
  async function api(route: string, signal?: AbortSignal): Promise<HarnessState> {
    const response = await fetch(`/api/plugins/${PLUGIN_ID}/api/${route}?companyId=${encodeURIComponent(company)}`, {
      method: route === 'setup' ? 'POST' : 'GET', credentials: 'same-origin', cache: 'no-store', signal,
      ...(route === 'setup' ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ packVersion: PACK_VERSION }) } : {}) });
    const result = await response.json() as HarnessState & { error?: string };
    if (!response.ok) throw new Error(result.error ?? 'Shared Harness is unavailable. Try again.');
    return result;
  }
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError('');
    api('status', controller.signal).then(result => { if (!controller.signal.aborted) setState(result); })
      .catch(err => { if (!controller.signal.aborted) { setState(null); setError((err as Error).message); } })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [refresh]);
  async function setup() {
    if (busyRef.current || loading || !state) return;
    busyRef.current = true; setBusy(true); setError(''); setNotice('');
    try { sessionStorage.setItem(storageKey, 'pending'); }
    catch { setError('Browser storage is unavailable. Enable session storage before setup so interrupted work can be recovered.'); busyRef.current = false; setBusy(false); return; }
    setPending(true);
    try {
      const result = await api('setup');
      sessionStorage.removeItem(storageKey);
      if (alive.current) { setState(result); setPending(false); setNotice('Setup saved. Review each agent’s provider, budget and approval before activating it in Paperclip.'); }
    } catch (err) { if (alive.current) setError((err as Error).message || 'Setup could not be confirmed. Refresh or retry to create only missing resources.'); }
    finally { if (alive.current) { setBusy(false); busyRef.current = false; } }
  }
  const native = (route: string) => `/${encodeURIComponent(prefix)}/${route}`;
  return <section className="aos-harness" aria-label="Shared Harness" aria-busy={loading || busy}>
    <style>{styles}</style>
    <header><div><h1>Shared Harness</h1><p className="muted">A common way to plan, carry out and hand off Mission work.</p></div>
      <button disabled={busy || loading} onClick={() => setRefresh(n => n + 1)}>Refresh status</button></header>
    {loading && <p role="status">Loading company resources…</p>}
    {error && <div className="panel" role="alert">{error}</div>}
    {notice && <div className="panel" role="status">{notice}</div>}
    {pending && <div className="panel" role="status"><strong>Setup may have partially completed.</strong><p>Existing resources are kept. Refresh status or retry setup to create only what is missing.</p></div>}
    {!loading && !state && <button onClick={() => setRefresh(n => n + 1)}>Retry loading</button>}
    {state && <>
      <div className="panel"><h2>{state.missingCount ? 'Set up your shared team' : 'Your shared team'}</h2>
        <p>{state.missingCount ? `${state.missingCount} resource${state.missingCount === 1 ? '' : 's'} to create: one shared company skill and two native agents make up this pack.` : 'The shared skill and both agents are present. Operator changes are preserved.'}</p>
        <p className="muted">New agents start paused, with scheduled and on-demand heartbeats off. Paperclip may require hire approval. Set their provider and budget, then activate them through native agent settings when ready.</p>
        {(state.missingCount > 0 || pending) && <button className="primary" disabled={busy || loading} onClick={() => void setup()}>{busy ? 'Setting up…' : pending ? 'Retry setup' : 'Create missing resources'}</button>}
      </div>
      <article aria-label="Shared skill"><span className="tag">Company skill</span><h2>{state.skill.name}</h2>
        <p>Bounded checkpoints, explicit evidence and review, and recoverable handoffs.</p>
        <p>{state.skill.id ? 'Available in this company’s skill library.' : 'Not created yet.'} {state.skill.customized && <strong>Customized skill content is preserved.</strong>}</p>
        {state.skill.id && <a href={native('skills')}>Open skill library</a>}
      </article>
      <div className="cards">{state.agents.map(agent => <article key={agent.key} aria-label={agent.name}>
        <span className="tag">{agent.status.replaceAll('_', ' ')}</span><h2>{agent.name}</h2>
        <p>{agent.key === 'mission-planner' ? 'Proposes objectives, ordered checkpoints and evidence criteria.' : 'Carries out an assigned native Task and leaves evidence for review.'}</p>
        <dl><dt>Shared skill</dt><dd>{agent.skillSelected ? 'Selected' : agent.id ? 'Not selected — configure in Paperclip' : 'Selected on creation'}</dd>
          <dt>Adapter</dt><dd>{agent.adapterType ?? 'Company-compatible local adapter'}</dd></dl>
        {agent.instructionsCustomized && <p>Customized instructions are preserved.</p>}
        {agent.id && <a href={native(`agents/${encodeURIComponent(agent.id)}`)}>Configure {agent.key === 'mission-planner' ? 'planner' : 'operator'}</a>}
        {agent.approvalId && <p><a href={native(`approvals/${encodeURIComponent(agent.approvalId)}`)}>Review hire approval</a></p>}
      </article>)}</div>
      <div className="panel"><h2>Use the team with Missions</h2><p>Create or review a Mission, then assign its linked native Tasks to the configured agents. Checkpoint review and final completion stay with the board. Setting up this pack does not assign or start work.</p>
        <div className="row"><a href={native('missions')}>Open Missions</a><a href={native('issues')}>Open Tasks</a></div>
      </div>
    </>}
  </section>;
}
