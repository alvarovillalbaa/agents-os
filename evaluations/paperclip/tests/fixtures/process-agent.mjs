// Authored deterministic process. It never calls a model, API or external service.
import fs from 'node:fs';
import path from 'node:path';
const root = process.env.AGENTS_OS_EVAL_ROOT, nonce = process.env.AGENTS_OS_EVAL_NONCE;
if (!root || !path.isAbsolute(root) || !nonce || fs.readFileSync(path.join(root, '.owner'), 'utf8') !== nonce) throw new Error('owned_fixture_required');
for (const key of ['OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'OPENROUTER_API_KEY', 'GOOGLE_API_KEY', 'GEMINI_API_KEY']) {
  if (process.env[key]) throw new Error('provider_credential_present');
}
const ids = Object.fromEntries(['COMPANY', 'AGENT', 'RUN'].map(key => [key.toLowerCase() + 'Id', process.env['PAPERCLIP_' + key + '_ID']]));
if (!Object.values(ids).every(value => /^[a-f0-9-]{36}$/.test(value ?? ''))) throw new Error('injected_identities_required');
const fields = fs.readFileSync('/proc/self/stat', 'utf8').split(') ').at(-1).split(' ');
const event = { ...ids, pid: process.pid, pgid: Number(fields[2]), sid: Number(fields[3]), start: fields[19], apiCredentialInjected: Boolean(process.env.PAPERCLIP_API_KEY) };
fs.appendFileSync(path.join(root, 'worker/events.jsonl'), JSON.stringify(event) + '\n', { mode: 0o600 });
console.log('AGENTS_OS_PROCESS_OK ' + Object.values(ids).join(' '));
