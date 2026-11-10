import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fixtureClient, need } from './mission-api-client.mjs';
const mode = process.argv[2]; need(['prepare', 'activate'].includes(mode), 'upgrade_mode');
const { root, report, api, scoped, save, pluginKey, pass } = fixtureClient('upgrade-' + mode);
const identity = pid => { const stat = fs.readFileSync(`/proc/${pid}/stat`, 'utf8').split(') ').at(-1).split(' '); return { pid, start: stat[19], pgid: Number(stat[2]), sid: Number(stat[3]) }; };
async function ready() {
  for (let n = 0; n < 80; n++) {
    const dashboard = await api('GET', '/plugins/' + pluginKey + '/dashboard');
    if (dashboard.worker?.status === 'running' && Number.isInteger(dashboard.worker.pid)) return identity(dashboard.worker.pid);
    await new Promise(done => setTimeout(done, 250));
  }
  throw new Error('upgrade_worker_not_ready');
}
try {
  if (mode === 'prepare') {
    const installed = await api('POST', '/plugins/install', { packageName: process.env.AGENTS_OS_PLUGIN_PACKAGE, isLocalPath: true });
    need(installed.version === '0.1.0' && installed.status === 'ready', 'actual_previous_package_installed');
    const worker = await ready(); save('plugin-upgrade-original-worker-identity.json', worker);
    const company = await api('POST', '/companies', { name: 'Authored upgrade company' });
    const fields = { name: 'Preserved through upgrade', organization: 'Authored Upgrade Studio', email: 'upgrade@example.test', phone: '', stage: 'active', notes: 'Private authored upgrade note', nextStep: 'Retain original CRM data', followUpDate: null };
    const response = await scoped(company.id, 'POST', '/contacts', { id: randomUUID(), operationId: randomUUID(), ...fields });
    const state = { companyId: company.id, contact: response.contact, worker, pluginId: installed.id };
    fs.writeFileSync(path.join(root, 'upgrade-state.json'), JSON.stringify(state), { flag: 'wx' }); save('upgrade-state.json', state);
  } else {
    const state = JSON.parse(fs.readFileSync(path.join(root, 'upgrade-state.json')));
    const upgraded = await api('POST', '/plugins/' + pluginKey + '/upgrade', {});
    need(upgraded.version === '0.2.0' && upgraded.status === 'ready', 'actual_native_upgrade');
    const worker = await ready(); save('plugin-upgrade-current-worker-identity.json', worker);
    let originalAbsent = false;
    try { originalAbsent = identity(state.worker.pid).start !== state.worker.start; } catch (error) { if (error.code === 'ENOENT') originalAbsent = true; else throw error; }
    need(originalAbsent && (worker.pid !== state.worker.pid || worker.start !== state.worker.start), 'upgrade_old_worker_absent');
    const response = await scoped(state.companyId, 'GET', '/contacts/' + state.contact.id);
    need(JSON.stringify(response.contact) === JSON.stringify(state.contact), 'upgrade_preserves_actual_crm_record');
    const missions = await scoped(state.companyId, 'POST', '/missions/search', {}); need(missions.missions.length === 0, 'new_migration_available');
    pass('U01', { nativeUpgrade: '0.1.0 to 0.2.0', actualCrmRecordRetained: true, migration002Usable: true, originalWorkerAbsent: true, samePluginId: upgraded.id === state.pluginId });
    need(upgraded.id === state.pluginId, 'same_plugin_registration');
  }
  report.passed = mode === 'prepare' || report.cases.length === 1;
} catch (error) { report.errors.push(String(error.stack ?? error)); }
finally { save(`upgrade-${mode}.json`, report); }
if (!report.passed) process.exitCode = 1;
