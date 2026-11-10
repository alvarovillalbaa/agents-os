# Shared Harness

The owner brief asks for shared agents and skills alongside CRM, Tasks and
long-horizon Missions. Ship an opt-in companion plugin on the already qualified
published Paperclip2026.1106.0 host. The host rejects added capabilities during
plugin upgrade; installing this independently declared companion uses its normal
permission boundary and preserves the released CRM/Missions plugin unchanged.

1. Package one company skill and two native managed agents, Mission Planner and
   Mission Operator. Both select the same canonical skill key. Start paused,
   with scheduled and on-demand heartbeats disabled; native hire approvals apply.
2. Add a company-scoped Shared Harness page showing missing resources, shared
   selection, changed instructions and native agent/skill links. Explicit setup
   creates only missing resources. Partial or uncertain setup is safely retried
   through native stable bindings; never reset operator changes or wake agents.
3. Verify inputs, DTO privacy, retry/partial failure, actual package installation,
   native skill materialization, company/board isolation, customization/restart
   and desktop/narrow UI. Check coexistence with the exact published Missions
   package. Publish the checked package/evidence and retire temporary CI.

Setup is a fixed declarative ensure operation, not a configurable transaction.
Its request names the exact pack version; native managed bindings are durable
receipts. Each resource is resolved before reconciliation. Missing resources may
be created in order; an error preserves earlier native progress. Concurrent
requests in the one native plugin worker serialize per company. A later retry
reads current state and only creates missing resources; it cannot restore a
previously customized or deliberately deselected resource. The page makes these
limits visible. No automatic dispatch or Mission approval is granted by setup.

No additional dependency, migration, production binding, provider/model call,
new account or paid service. Existing exact build/tool pins apply. Storage Guard
fails: all heavy checks run in an owned disposable public CI job capped at20
minutes, with a17-minute controller and complete failure/cleanup evidence.

Primary source at immutable host commit
[d69631b](https://github.com/paperclipai/paperclip/tree/d69631b01b9c658f80bf8bed389863dce82643e1):
[managed agents](https://github.com/paperclipai/paperclip/blob/d69631b01b9c658f80bf8bed389863dce82643e1/server/src/services/plugin-managed-agents.ts),
[managed skills](https://github.com/paperclipai/paperclip/blob/d69631b01b9c658f80bf8bed389863dce82643e1/server/src/services/plugin-managed-skills.ts),
[skill selection](https://github.com/paperclipai/paperclip/blob/d69631b01b9c658f80bf8bed389863dce82643e1/packages/adapter-utils/src/server-utils.ts),
[manifest](https://github.com/paperclipai/paperclip/blob/d69631b01b9c658f80bf8bed389863dce82643e1/packages/shared/src/types/plugin.ts),
[upgrade guard](https://github.com/paperclipai/paperclip/blob/d69631b01b9c658f80bf8bed389863dce82643e1/server/src/services/plugin-loader.ts).
