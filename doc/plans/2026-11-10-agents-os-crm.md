# Agents OS CRM

The [Paperclip prerequisite](../results/2026/11-10/paperclip-evaluation.md) passed
at published host2026.1106.0. Build the requested CRM as an additive trusted
extension in `extensions/agents-os/`. Preserve the older fork's existing code,
locks and workflows. Its root build is not this extension's runtime.

1. Implement company-scoped contacts with validation, optimistic revisions,
   replay-safe mutations, archive/restore and a durable content-free audit journal.
2. Add the real CRM page, search/pagination, contact editor and native task links.
   Preserve failed/uncertain saves and reject stale writes without forcing them.
3. Build/install the actual package into an isolated pinned host. Verify native
   migration installation, API/access boundaries, restart persistence, audit and
   desktop/narrow UI flows with authored data. Preserve failures and teardown.
4. Publish source, actual results and an installable candidate artifact. Keep
   Missions, provider quality and production hosting open until implemented.

The manifest exposes only board-authorized, company-resolved scoped JSON APIs.
No bridge data/action handler exposes contact records. The host derives the
plugin namespace; SQL parameters carry all record data. Native task reads go
through the supported issue client. No core schema or production Auth changes.

Contact edits and their audit journal entry commit in the same row mutation.
The host activity log receives content-free events from that durable journal;
unconfirmed delivery remains visibly pending and can be retried. Delivery is at
least once, with a stable event ID; it does not pretend an uncertain log call
never happened. No timer, background provider call or agent wakeup is required.

Standing all-work approval covers this implementation, dependencies, additive
plugin migration and isolated free CI/checks/publication. No real data, model
call, new account or paid service. Storage Guard currently reports17.0GiB free
against34.0GiB required; no local installation/build/server/browser/database.

Primary contracts: pinned [authoring guide](https://github.com/paperclipai/paperclip/blob/d69631b01b9c658f80bf8bed389863dce82643e1/doc/plugins/PLUGIN_AUTHORING_GUIDE.md),
[database validation](https://github.com/paperclipai/paperclip/blob/d69631b01b9c658f80bf8bed389863dce82643e1/server/src/services/plugin-database.ts),
[scoped routes](https://github.com/paperclipai/paperclip/blob/d69631b01b9c658f80bf8bed389863dce82643e1/server/src/routes/plugins.ts).

Completed CRM scope: [20-case results and distribution](../results/2026/11-10/agents-os-crm.md).
Missions and shared-harness workflows follow as separate implementation scopes.
