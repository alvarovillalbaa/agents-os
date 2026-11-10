import { definePlugin, runWorker, type PluginContext } from '@paperclipai/plugin-sdk';
import { CrmError, uuid } from './domain.js';
import { createRepository } from './repository.js';

let context: PluginContext | undefined;
let repository: ReturnType<typeof createRepository> | undefined;
const plugin = definePlugin({
  async setup(ctx) { context = ctx; repository = createRepository(ctx); },
  async onApiRequest(input) {
    const headers = { 'Cache-Control': 'no-store' };
    try {
      if (!context || !repository) return { status: 503, headers, body: { error: 'CRM is starting. Try again shortly.' } };
      if (input.actor.actorType !== 'user') return { status: 403, headers, body: { error: 'Board access is required.' } };
      const companyId = uuid(input.companyId, 'Company ID');
      if (!await context.companies.get(companyId)) return { status: 404, headers, body: { error: 'Company not found.' } };
      if (input.routeKey === 'list') return { headers, body: await repository.list(companyId, input.body) };
      if (input.routeKey === 'tasks') return { headers, body: await repository.tasks(companyId, input.query) };
      if (input.routeKey === 'create') return { status: 201, headers, body: await repository.create(companyId, input.body, input.actor.actorId) };
      const id = uuid(input.params.contactId, 'Contact ID');
      if (input.routeKey === 'get') return { headers, body: await repository.get(companyId, id) };
      if (input.routeKey === 'activity') return { headers, body: await repository.retryActivity(companyId, id) };
      if (input.routeKey === 'edit' || input.routeKey === 'archive' || input.routeKey === 'link') {
        return { headers, body: await repository.mutate(companyId, id, input.routeKey, input.body, input.actor.actorId) };
      }
      return { status: 404, headers, body: { error: 'CRM route not found.' } };
    } catch (error) {
      if (error instanceof CrmError) return { status: error.status, headers, body: { error: error.message } };
      context?.logger.error('CRM operation could not be confirmed', { routeKey: input.routeKey });
      return { status: 503, headers, body: { error: 'Could not confirm this operation. Your draft is kept. Retry the same request or load the saved contact.' } };
    }
  },
  async onHealth() { return { status: repository ? 'ok' : 'error', message: repository ? 'Agents OS CRM ready' : 'CRM is starting' }; },
  async onIdleDrain() { return 'none' as const; },
});
export default plugin;
runWorker(plugin, import.meta.url);
