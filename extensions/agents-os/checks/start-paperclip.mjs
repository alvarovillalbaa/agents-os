// Copied beside the explicit tool owner's node_modules in isolated CI.
import { startServer } from '@paperclipai/server';
const started = await startServer();
if (started.host !== '127.0.0.1' || started.listenPort !== 4315) {
  await started.shutdown('SIGTERM');
  throw new Error('loopback_binding_required');
}
console.log('AGENTS_OS_SERVER_READY ' + started.host + ':' + started.listenPort);
// The actual published server installs its own ordered SIGINT/SIGTERM teardown.
