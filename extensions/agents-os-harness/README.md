# Agents OS Shared Harness0.1.0

An opt-in Paperclip companion with a shared company skill, Mission Planner and
Mission Operator, and a Shared Harness page. Both native agents select the same
company skill. Instructions cover bounded Task work, evidence, review and
recovery. Native Tasks and Missions keep their existing execution/review rules.

Build with the exact SDK2026.1106.0 and this folder's pinned dependencies. Install
the resulting package through Paperclip's normal plugin installation flow on
published host2026.1106.0. Approve its declared managed-agent/skill capabilities
as a separate plugin. Existing Agents OS CRM/Missions0.2.0 stays unchanged.

Open Shared Harness in a company, inspect the proposed team and choose **Create
missing resources**. New agents start paused; heartbeat scheduling and on-demand
wakes are disabled. Complete any required native hire approval, then configure
each agent's provider, credentials and budget before enabling work in Paperclip.
A default budget of zero in Paperclip means unset,
not a zero-spend cap. This plugin does not activate agents or call models.

Role guidance is supplied as native initial prompt configuration. The pinned
host rejects managed instruction-bundle writes for pending hires, so setup does
not attempt a post-creation configuration change. The initial prompt remains
visible through native instruction APIs. After approval, the board can save
instructions through Paperclip's versioned editor; setup preserves that edit.

The native company skill library is the shared source. Agent settings select
that skill by canonical key. Paperclip makes the packaged catalog skill read-only:
fork it in the native library, edit that fork and select it for the agents that
should share the customization. Edit instructions in native agent settings.
The page reports alternative selections and skill deselection and links to
native settings for reviewing instructions;
setup preserves those choices and creates only missing resources. Selecting a
skill does not prove execution quality, and this release does not claim it.

Setup may partially succeed. Its fixed versioned ensure request uses durable
native managed bindings, reads each resource and creates only missing ones.
Earlier progress remains after an error; refresh or retry setup. Pending setup
is retained per browser session/user/company. There is no cross-resource
transaction, automatic reset, automatic dispatch, credential broker or Task
runner. Recreating retired or deleted resources requires explicit setup again.

Board-only company-resolved routes expose narrow status DTOs. No agent adapter
configuration, runtime secret, instruction path or raw skill body is returned.
There is no plugin database, outbound-HTTP capability or migration. Packaged
third-party licenses are retained. See checks/README.md for the bounded scope.
