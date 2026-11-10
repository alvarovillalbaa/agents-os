# Agents OS extension

A company CRM inside Paperclip: contacts, organizations, stages, follow-up dates,
notes and native task links. Contact edits have optimistic revisions; stale
writes retain the draft. Archive/restore is reversible. An unconfirmed request
keeps its original operation ID so retry can confirm the saved result.

This is the CRM implementation workstream. Missions and full Agents OS delivery
remain unfinished. Build, installation and acceptance results are pending.

## Host and installation

Requires Node24.11+ and the published Paperclip2026.1106.0 host. The older
surrounding fork is preserved and has not been upgraded or qualified as this
extension's host. Use an existing trusted Paperclip instance and a reviewed
candidate package; do not expose local_trusted mode publicly.

From this directory,when storage allows:

```sh
npm install
npm run typecheck
npm test
npm run build
npm pack --ignore-scripts
```

The build emits the manifest,worker and UI. A trusted local installation uses
Paperclip's plugin manager or `paperclipai plugin install /absolute/plugin/path`.
Open the company's CRM page. The host applies the additive plugin namespace
migration before starting the worker. Actual installation and candidate
distribution must be verified before these steps are reported as accepted.
No npm publication or new account is configured by this private package.

## Data and controls

Only board-authorized scoped APIs expose CRM data. The host resolves company
access; every row read/write also includes that company ID. No data/action bridge
handler exposes contact records. Search terms use JSON bodies rather than URLs.
Task links read actual native issues through the supported SDK and never start
an agent,send a message or modify/delete the task.

Every change atomically appends a content-free event to the contact's durable
journal. Host activity delivery uses that journal and a stored acknowledgment.
Unconfirmed delivery stays pending and can be retried. It is at least once:
an ambiguous acknowledgment can produce a duplicate host activity event with
the same stable event ID. Contact edits themselves use revision checks and
request replay protection. Journal entries contain no contact fields.

Unsaved drafts stay in memory and,when a host user identity is available,in
this tab's session storage under that user/company key. Saved contacts live in
the host database. Other companies' drafts are not opened by switching scope.
No contact data is sent to providers. Trusted host/plugin code shares the
origin;this extension does not claim a sandbox for untrusted plugins.

Source and acceptance scope:
[CRM plan](https://github.com/alvarovillalbaa/agents-os/blob/master/doc/plans/2026-11-10-agents-os-crm.md),
[Paperclip prerequisite](https://github.com/alvarovillalbaa/agents-os/blob/master/doc/results/2026/11-10/paperclip-evaluation.md).

The build retains third-party license texts in the package. The published
Paperclip shared2026.1106.0 omits its MIT file;the included source copy is from
the exact [pinned upstream license](https://github.com/paperclipai/paperclip/blob/d69631b01b9c658f80bf8bed389863dce82643e1/LICENSE).
