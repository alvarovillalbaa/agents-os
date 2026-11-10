# Agents OS CRM: 20 checks passed

The CRM extension is implemented and distributed as version 0.1.0 for published
Paperclip 2026.1106.0. It adds company-scoped contacts, stages, follow-up dates,
notes, search/pagination, archive/restore and native task links. Stale writes keep
the draft; uncertain saves retain their original request for replay after reload.
Missions, shared-harness workflows and production hosting remain open.

[Accepted run42885925784](https://github.com/alvarovillalbaa/agents-os/actions/runs/42885925784)
checked source `009305c4cdc199144e4d9085359c5a97fa13dd3e` using workflow commit
`a713930b9abe0f76021562ba47fdff8c0d305d54`. One invocation passed all20 cases,
strict extension typecheck,build,actual npm pack/extraction and native package
installation. The surrounding older fork's application was preserved;its broad
build is not qualified by this published-host evaluation.

## Install the tested package

Download `agents-os-0.1.0.tgz` and `checksums.sha256` from the
[CRM release](https://github.com/alvarovillalbaa/agents-os/releases/tag/agents-os-crm-v0.1.0).
Its SHA256 is `0c06262af1082bcde820d9082c42ce320310953fe609cb6c543440776ffdd5b9`.
The [package inventory](agents-os-crm/packaged-files.json) records every packed
file,mode and digest plus npm SHA512 integrity. This is the exact222115-byte
archive installed in the accepted run;it has not been rebuilt or repacked.
Its README preserves the candidate's pre-acceptance wording;these results are
the subsequent acceptance record.

Use a trusted private/local Paperclip2026.1106.0 host with Node24.11+ and a backup
of its database. Extract the package into a dedicated retained directory,then
install that extracted directory through Paperclip's plugin manager or
`paperclipai plugin install /absolute/path/to/package`. The accepted fixture used
the native `/api/plugins/install` endpoint with that exact extracted directory.
Open the company's CRM page. The host applies migration001 only in the plugin's
own namespace. No npm publication or additional account is required.

The plugin is trusted host code. Board-authorized scoped APIs are the data
boundary;this release does not qualify untrusted plugins or public local_trusted
hosting. No production database,Auth setting or running service was changed.

## Actual acceptance

| Cases | Result |
| --- | --- |
| D01–D05 | Trim/multiline/calendar,invalid dates,email/limits,field scope/journal injection,and ID/revision/paging boundaries. |
| I01 | Actual archive extraction,namespace migration,plugin installation,ready health and real worker identity. |
| I02–I05 | Contact fields,invalid-input rollback,stable create/edit replay,changed-replay rejection,stale409,and one winner from concurrent revisions. |
| I06 | Two authored companies returned three scoped404s. A real disposable agent key read its native agent but received403 from both companies' CRM;the key was revoked. |
| I07–I09 | Native task link/unlink retained the issue;foreign task rejected;archive/restore and archived-edit rejection;31 real rows paged30+1 with literal search. |
| I10 | All eight journal events delivered to native host activity without contact fields. |
| I11 | Actual host/worker restart retained the same contact,revision,journal,task link and31 paging fixtures;the original worker was absent. |
| B01 | Desktop1280:actual create/save/link/reload and native task navigation/back. |
| B02 | Narrow390:actual edit/archive/filter/restore/reload,including a120-character name;no horizontal overflow. |
| B03 | Two real editors:one save,one expected409,stale draft retained,and explicit load of the saved version. |
| B04 | A real create committed before its response was deliberately lost. Reload restored the tab draft;identical request bytes replayed to the same contact/revision1 without duplication. |

All four original PNGs were [visually inspected](agents-os-crm/visual-review.json).
The accepted browser evidence contains eight DOM captures and four PNGs.
Only the authored B03 conflict and B04 transport loss are expected exceptions;
all other page,request and HTTP errors remained failures. This is Chromium
viewport emulation,not physical-device touch or an accessibility audit.

Drafts are scoped by actual host user and company in tab session storage. The
editor waits for that host identity before mounting. Contact mutations atomically
append a content-free durable journal event. Native host activity delivery is
at least once with a stable event ID;an uncertain acknowledgment can duplicate
that log event. No provider call,agent wakeup or autonomous timer is added.

## Evidence and cleanup

The release's `agents-os-crm-evidence.zip` retains all1338 safe original files /
14740707 uncompressed bytes from all11 attempts,including all10 failures and
their actual candidate archives. Its SHA256 is
`df2a7ab59eb58c80abbc0b1ab526e0ef58e537e96b3c1ec6e2242eb5528bf14e`.
Failed candidate archives are historical evidence,not installable releases.
The [release manifest](agents-os-crm/release-manifest.json) identifies every
original path, size, digest, run and source. Whenever a disposable agent key was
issued, its credential-bearing response was explicitly withheld; metadata and a
digest are retained instead. Disposable secrets were never published.

Independent verification checked every manifest and complete stream. For the
accepted run,it rebuilt canonical/export/working-source vectors from Git,
including symlink targets and modes,and checked actual tar members,modes,digests,
npm integrity,all20 cases,API/browser originals and teardown. See the
[review](agents-os-crm/independent-review.json),
[accepted receipt](agents-os-crm/accepted-receipt.json),and
[portable verifier](agents-os-crm/verify-packet.py). After extracting the evidence,
run the verifier against `attempt-11/` with the source/workflow SHAs above;pass
`--allow-failure` for an earlier attempt with its own recorded source SHA.

The pipeline used14 orchestrated commands/28 complete streams and seven full
source guards. Scratch measured2796459128 bytes/78175 files within4GiB/128000;
database30272659 bytes below256MiB. Original server groups and plugin workers
were absent,browser contexts/browser closed,the listener refused connections,
the marked fixture database was dropped after ownership recheck,and scratch
was removed. GitHub Actions then stopped the PostgreSQL service/container.

Temporary workflow413653648 was verified `disabled_manually` at19:34:34UTC on
10November2026 before removing its definition. Existing permanent workflows
and all1386 baseline blobs/modes are preserved. Checked source and workflow
ancestry are retained. Owned QA refs are retired only after publication.
Push commits use the documented GitHub skip marker to avoid the inherited
npm-release/lockfile push side effects;the explicit scoped CI ran all checks.

## Preserved failures

| Attempt | Source | Run | Failure |
| --- | --- | --- | --- |
| 1 |16fbddae|42877247881| Published shared package omitted its MIT file;exact pinned upstream license retained by the build. |
| 2 |bd894f22|42877777128| Helper expected an incorrect health status;actual host contract is ready/healthy. |
| 3 |42e70242|42878267473| Heading substring matched two headings;selector made exact. |
| 4 |0323edcb|42879093270| Populated task select had an ambiguous implicit label;explicit accessible labels added. |
| 5 |1db27756|42880077540| Host health preceded restarted plugin readiness;helper now waits for actual worker running state. |
| 6 |c03f79e5|42881108900| Populated textarea had an ambiguous implicit label;Notes explicitly labeled. |
| 7 |3cc91fe1|42882167346| Narrow flow completed positive assertions but cancelled pending reads. |
| 8 |e5bb4dbd|42883252381| Document load-state waits did not prove new SPA reads settled. |
| 9 |36e787ea|42884617010| Native task back navigation cancelled unfinished host reads. |
| 10 |737ce198|42885152862| Narrow reads still cancelled;fresh request-completion observation replaced sticky document-state waits. |

Each attempt's original packet,complete streams and cleanup receipt remains
unchanged in the release evidence. No failed invocation counts toward the20-case
pass. Candidate11 keeps the case scope and error rules;it observes fresh request
completion between asserted actions. The
[Playwright contract](https://playwright.dev/docs/api/class-page#page-wait-for-load-state)
explains why an already-reached document load state can resolve immediately.

No local install,build,server,browser or database ran because Storage Guard
failed its reserve. The older fork's full typecheck/tests/build,production
deployment,real-provider behavior and broad tenant/security qualification remain
unverified. The next implementation is durable Missions using native Tasks,
with explicit progress,review and recovery;Shared Harness follows.
