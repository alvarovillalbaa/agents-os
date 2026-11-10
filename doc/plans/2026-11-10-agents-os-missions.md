# Durable Missions

The owner brief lists long-horizon Missions after CRM and Tasks. CRM0.1.0 is
[published](../results/2026/11-10/agents-os-crm.md). Implement Missions in the same
trusted extension on pinned Paperclip2026.1106.0; preserve the host and CRM.

1. Persist mission objectives and ordered checkpoints linked to company Tasks.
   Require explicit evidence and review; a Task marked done alone cannot finish
   a Mission. Preserve decisions, rework, pause reasons and uncertain commands.
2. Add the native Missions page with planning, Task navigation, fresh status,
   pause/resume, review, explicit reopening and final completion. A changed Task
   invalidates its approval snapshot. Native Task execution retains its controls.
3. Verify the actual0.2.0 package on a disposable pinned host: additive migration,
   API/access/replay/concurrency, real Task changes, restart and desktop/narrow
   browser flows. Run the affected CRM regression scope. Publish the exact
   checked package and results; retire owned CI and fixtures.

Board-only scoped routes and parameterized plugin-namespace SQL remain the data
boundary. Native Tasks are read through the existing issues.read capability.
There is no duplicate Task runner or hidden wakeup. Mission progression has
explicit review gates; Shared Harness will connect agent execution separately.
The row state, command replay ledger and private review history change atomically
under revision CAS. Native activity receives only content-free event metadata.

Pinned SDK database client supports individual SELECT/INSERT/UPDATE/DELETE,
without a transaction API. Keep state, replay and history in the same row to
avoid partial commits. Read every linked Task before review/completion and
record its actual updatedAt snapshot; reads cannot lock concurrent native edits,
so later drift is visible and requires reopening. Do not claim a cross-system
transaction or verified outcome from a green Task status.

Standing all-work approval covers this implementation, own additive migration,
checks and bounded temporary free CI/publication. No new dependency, real data,
provider/model call, new account, paid service or production binding. Failed
Storage Guard means no local install/build/server/browser/database.

Primary contracts: [SDK types](https://github.com/paperclipai/paperclip/blob/d69631b01b9c658f80bf8bed389863dce82643e1/packages/plugin-sdk/src/types.ts),
[database restrictions](https://github.com/paperclipai/paperclip/blob/d69631b01b9c658f80bf8bed389863dce82643e1/server/src/services/plugin-database.ts).

Completed coordination scope: [51-case results and distribution](../results/2026/11-10/agents-os-missions.md).
Shared Harness and production hosting remain separate unfinished work.
