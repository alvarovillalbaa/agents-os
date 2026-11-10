import { definePlugin, runWorker, type PluginContext } from '@paperclipai/plugin-sdk';
import { companyId, createHarness, HarnessError } from './service.js';
let context: PluginContext | undefined;
let harness: ReturnType<typeof createHarness> | undefined;
const plugin = definePlugin({
  async setup(ctx) { context = ctx; harness = createHarness(ctx); },
  async onApiRequest(input) {
    const headers = { 'Cache-Control': 'no-store' };
    try {
      if (!context || !harness) return { status: 503, headers, body: { error: 'Shared Harness is starting. Try again shortly.' } };
      if (input.actor.actorType !== 'user') return { status: 403, headers, body: { error: 'Board access is required.' } };
      const company = companyId(input.companyId);
      if (!await context.companies.get(company)) return { status: 404, headers, body: { error: 'Company not found.' } };
      if (input.routeKey === 'status') return { headers, body: await harness.status(company) };
      if (input.routeKey === 'setup') return { headers, body: await harness.setup(company, input.body) };
      return { status: 404, headers, body: { error: 'Harness route not found.' } };
    } catch (error) {
      if (error instanceof HarnessError) return { status: error.status, headers, body: { error: error.message } };
      context?.logger.error('Shared Harness operation could not be confirmed', { routeKey: input.routeKey });
      return { status: 503, headers, body: { error: 'Could not confirm setup. Resources already created are kept. Refresh or retry setup to create only missing resources.' } };
    }
  },
  async onHealth() { return { status: harness ? 'ok' : 'error', message: harness ? 'Shared Harness ready' : 'Shared Harness is starting' }; },
  async onIdleDrain() { return 'none' as const; },
});
export default plugin;
runWorker(plugin, import.meta.url);
