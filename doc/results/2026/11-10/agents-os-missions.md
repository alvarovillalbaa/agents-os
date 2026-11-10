# Missions 0.2.0: 51 checks passed

Agents OS now has persistent Missions with ordered native Task checkpoints,
acceptance criteria, version-bound reviews, evidence history, pause/resume,
replanning, cancellation, reopening and explicit final completion. Reviewed
Tasks that later change invalidate their approval. A lost response keeps the
original command and draft so retry can confirm the saved operation.

[Run 42898322307](https://github.com/alvarovillalbaa/agents-os/actions/runs/42898322307)
passed all 51 checks in one invocation against source
`a12df8a64efd1e7c82256527d6d397606c9f4a37`, using workflow
`4fd92a089a5834da462b942c53c29de39c174fac`. This includes the actual 0.1.0-to-0.2.0
native upgrade, strict extension typecheck, build/pack/extraction, Missions and
the affected CRM regression scope on published Paperclip 2026.1106.0.

This is a Mission coordination layer. Native Tasks retain their execution,
assignment and pause controls. Shared Harness, real-provider execution and
production hosting remain unfinished; the overall Agents OS product is open.

## Install or upgrade

The [Missions release](https://github.com/alvarovillalbaa/agents-os/releases/tag/agents-os-missions-v0.2.0)
contains the exact installed `agents-os-0.2.0.tgz`, not a rebuild. Verify it with
the accompanying `checksums.sha256`. The archive is 230638 bytes, SHA256
`354c175bb5ca7739e7c0dd70e44e3b08b18762ad49fa943ea8970136264a2cda`.
[Package inventory](agents-os-missions/packaged-files.json) binds all nine files,
archive modes, byte digests and npm SHA512 integrity to the checked source.
The packaged README retains its candidate/pre-acceptance wording; this guide
records the subsequent accepted result.

Use a trusted private/local Paperclip 2026.1106.0 host with Node 24.11+ and a
database backup. Extract with fresh modification times (`tar -mxzf`) into a
dedicated retained directory. A new installation uses Paperclip's plugin
manager or `paperclipai plugin install /absolute/path/to/package`.

For the checked local-path upgrade, retain the old package directory, place the
new extracted package at its configured path, then use the native plugin
upgrade operation (`POST /api/plugins/alvarovillalbaa.agents-os/upgrade`, `{}`).
The host deactivates the old worker, applies the additive plugin migration and
starts the new worker. The same plugin registration and existing CRM contact
were retained. Migration001 and the old archive remain unchanged.

Fresh timestamps matter when replacing an extracted npm archive at the same
path. The pinned host's [manifest loader](https://github.com/paperclipai/paperclip/blob/d69631b01b9c658f80bf8bed389863dce82643e1/server/src/services/plugin-loader.ts)
uses file modification time in its import-cache key. Npm archives normalize
that time. The accepted installation used `tar -m` and recorded distinct old/new
manifest times in [placement evidence](agents-os-missions/upgrade-placement.json).
The package bytes and native host source were unchanged.

Open the company's Missions page. Save an objective and 1–20 checkpoints, each
with criteria and a distinct company Task. Tasks can be linked later while the
plan is a draft; every checkpoint needs an available Task before starting.
When the current Task is done, record evidence and approve it or request rework.
Rework requires an actual Task change before approval. Completing all reviews
still requires a separate final completion action and outcome evidence.

Pausing holds Mission progression. Edit future checkpoints while paused;
reopen reviewed work before changing its criteria or the objective. Reopening
clears that checkpoint's and all later approvals, retaining decision history.
Refresh/reopen the page to read current native Task status. Changing Tasks after
completion shows `needs review`; prior approvals are not silently reused.

## Actual checks

| Cases | Result |
| --- | --- |
| D01–D05 | Unchanged CRM input-boundary regressions. |
| M01–M05 | Plan size/text/identity bounds, duplicate Tasks, scope/review injection rejection and action-specific command validation. |
| M06–M13 | Required Tasks, ordered and version-bound review, rework, pause/resume, frozen reviewed criteria/objective, explicit completion, Task drift and downstream reopening. |
| U01 | Downloaded the exact released CRM0.1.0, installed it natively, persisted an authored contact, upgraded to the actual packed0.2.0; same plugin/contact, new migration usable and original worker absent. |
| I01–I11 | CRM API/company/agent boundaries, fields, replay, CAS/concurrency, task links, archive,31-row pagination, activity and actual restart on upgraded0.2.0. |
| N01–N05 | Actual Mission creation/validation, case-normalized IDs, create/command/older replay without rollback, changed-intent rejection, concurrency/stale revisions, company404s and a valid agent receiving two403s with key revoked. |
| N06–N09 | Unfinished/stale-Task review rejected; real review/rework; final completion; later Task drift; reopening retains evidence; replanning preserves the approved prefix and freezes the reviewed objective. |
| N10–N13 | Real31-row pagination/literal search, content-free host activity, paused review history, actual host restart retaining state/Task versions/command ledger and resumption at the next checkpoint. |
| B01–B04 | Unchanged CRM desktop/narrow/conflict/lost-response browser regressions. |
| MB01 | Desktop two-checkpoint plan/start/review/final completion/reload and actual native Task navigation/back. |
| MB02 | Narrow390, accepted120-character title, pause/reload/resume/cancel/reopen without horizontal overflow. |
| MB03 | Two real editors: one expected409, stale objective retained, explicit saved-version load. |
| MB04 | Actual create committed before the response was deliberately lost; reload restored the plan, identical bytes replayed to the same Mission/revision1 without duplication. |

All eight original PNGs were [visually inspected](agents-os-missions/visual-review.json).
Sixteen original DOM captures accompany them. Only the authored conflict and
lost-response exceptions were accepted; unexpected page/request/HTTP errors
remained failures. These are Chromium viewport checks, not physical touch or an
accessibility audit. The [frozen scope](../../../../extensions/agents-os/checks/MISSIONS.md)
lists the prospective case and resource bounds.

## Persistence and proof limits

Only board-authorized company-resolved scoped APIs expose Missions. State,
the durable operation replay ledger and private decision history change in one
row under revision CAS. An older command replay returns current state, preserving
later work. Native activity receives content-free IDs/actions, not objectives,
criteria or review notes. Its durable pending delivery is at least once, with
stable event IDs. Tab drafts are keyed by actual user and company.

Reviews compare the exact Task timestamp shown to the operator with a fresh
native read; completion rechecks all approval snapshots. Native Task changes and
plugin-row writes are separate transactions. Later changes are surfaced as
invalidated reviews; there is no claim of a cross-system lock or that a Task's
done status proves its work. No hidden Task runner, agent wakeup or provider call
was added to this coordination layer.

## Originals, failures and teardown

The release's `agents-os-missions-evidence.zip` retains all 381 safe original
files / 6233259 uncompressed bytes from four attempts. Its SHA256 is
`ffa4b9855535bc9fb752402519f311920abc3681283c2091d1f5ce019f3ff13a`.
The [release manifest](agents-os-missions/release-manifest.json) binds every
original path, size, digest, source and run. The accepted packet contains 302
files / 4351726 bytes. Two generated credential-bearing bodies are explicitly
withheld with digest/metadata; they are not presented as retained originals.
Failed candidate archives are historical evidence; install the standalone
0.2.0 asset rather than an archive found inside an earlier packet.

The [independent review](agents-os-missions/independent-review.json) checked every
manifest/stream and all recorded Git vectors, including symlinks and modes.
For the accepted run it also checked all 18 named TAP cases, 51 case identities,
22 commands/44 complete streams,11 canonical/export/working-source guards,
actual package tar members/modes/SRI, previous0.1.0 identity, API/browser originals
and teardown. See the [accepted receipt](agents-os-missions/accepted-receipt.json)
and [portable verifier](agents-os-missions/verify-packet.py). Extract the evidence
and run that verifier on `attempt-4/` with the source/workflow SHAs above;
earlier packets require their own source SHA and `--allow-failure`.

Scratch measured2800699058 bytes/78377 files within4GiB/128000;database30772371
bytes within256MiB. Server groups and all tracked old/upgraded/restarted plugin
workers were absent; browsers closed; the listener refused connections. The
marked fixture database was dropped after ownership recheck and scratch removed.
GitHub Actions then stopped its PostgreSQL service/container.

| Attempt | Source | Run | Actual failure |
| --- | --- | --- | --- |
| 1 |07847797|42896842850| Strict typecheck caught a missing JSX closing brace. No tests, server or database. |
| 2 |b50c9184|42897245317| Strict typecheck caught a test fixture's UUID template type being too narrow for case normalization. No tests, server or database. |
| 3 |820c1358|42897667221| All18 domain checks/build/package/old0.1.0 install passed; native upgrade reused the old manifest because both archives had the same normalized mtime. |

All failures and their safe originals remain unchanged. Candidate4 corrects
extraction timestamps and normalizes creation operation IDs consistently;
it retains the full scope and all error rules. Every attempt's owned teardown
was independently verified.

Temporary workflow413786944 was verified `disabled_manually` at20:50:39UTC on
10November2026 before definition removal. Existing permanent workflows and
host application files remain unchanged. Publication commits use the GitHub
skip marker to avoid inherited npm-release/lockfile push side effects; this
explicit dispatch executed every scoped check. Checked ancestry is preserved.

Storage Guard reported7.6GiB free against34GiB required, so no local install,
build, server, browser or database ran. The older fork's broad build, production
deployment, real providers, physical devices and full shared-harness workflows
remain unverified. Next: Shared Harness integration on the native agent/skill
surfaces, followed by production qualification.
