import type { PaperclipPluginManifestV1 } from '@paperclipai/plugin-sdk';
import { PLUGIN_ID } from './model.js';

const routes = [
  ['list', 'POST', '/contacts/search'], ['get', 'GET', '/contacts/:contactId'],
  ['create', 'POST', '/contacts'], ['edit', 'PATCH', '/contacts/:contactId'],
  ['archive', 'POST', '/contacts/:contactId/archive'],
  ['link', 'POST', '/contacts/:contactId/tasks'],
  ['activity', 'POST', '/contacts/:contactId/activity'], ['tasks', 'GET', '/tasks'],
] as const;
const manifest: PaperclipPluginManifestV1 = {
  id: PLUGIN_ID, apiVersion: 1, version: '0.1.0', minimumHostVersion: '2026.1106.0',
  displayName: 'Agents OS', description: 'Company contacts and native task links.', author: 'Alvaro Villalba Perez',
  categories: ['ui', 'automation'],
  capabilities: ['api.routes.register', 'database.namespace.migrate', 'database.namespace.read',
    'database.namespace.write', 'companies.read', 'issues.read', 'activity.log.write', 'ui.page.register'],
  entrypoints: { worker: './dist/worker.js', ui: './dist/ui' },
  database: { namespaceSlug: 'agents_os', migrationsDir: 'migrations', coreReadTables: ['companies'] },
  apiRoutes: routes.map(([routeKey, method, path]) => ({ routeKey, method, path, auth: 'board',
    capability: 'api.routes.register', companyResolution: { from: 'query', key: 'companyId' } })),
  ui: { slots: [{ type: 'page', id: 'crm', displayName: 'CRM', exportName: 'CrmPage', routePath: 'crm' }] },
};
export default manifest;
