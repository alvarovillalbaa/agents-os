# Paperclip prerequisite: eight checks passed

Agents OS's explicit prerequisite to try Paperclip is complete for the bounded
evaluation below. CRM, long-horizon Missions and the finished Agents OS product
remain unimplemented. This is not a production deployment or AI-quality result.

[Accepted run 42868725319](https://github.com/alvarovillalbaa/agents-os/actions/runs/42868725319)
checked evaluator source `437831ce0d5f5637ec581d949a9cb6c3401b7dd2`, using temporary
workflow commit `f0f480e3f8849110ce957a5821819dc8c64cc63f`. Both parent the existing
personal fork baseline `fdb20d5d083ab943fb3ae252390b3a5e626fc3a7`. The published
Paperclip CLI/server 2026.1106.0 ran unmodified; this did not build or run the
older fork's application source.

## Observed behavior

| Case | Actual result |
| --- | --- |
| P01 | CLI/server npm integrity, versions and entrypoint hashes matched. Required Linux Sharp/libvips/esbuild packages were separately pinned and hashed. |
| P02 | Real API healthy and bundled UI served on 127.0.0.1:4315, local_trusted/private. Supported configuration disabled telemetry, announcements and update checks. |
| P03 | Authored company, goal, project and linked task created. The actual local board user owned the task through todo/in_progress/done; its comment persisted. |
| P04 | One actual process-adapter heartbeat succeeded, emitted its marker and received the expected company/agent/run IDs. The authored process made no network or model calls. |
| P05 | Pausing the agent caused a further invocation to return 409; one process execution and one run remained. |
| P06 | Actual server stop/restart retained the same six records and task comment in the disposable PostgreSQL database. |
| P07 | Desktop 1280x900 rendered task, agent/run, goals and skills routes; actual project navigation/back returned to the same task. No page/request/HTTP errors or document overflow. |
| P08 | Narrow 390x900 repeated those four routes and navigation/back, with no errors or document overflow. This was Chromium viewport emulation, not physical touch or an accessibility audit. |

All four original PNGs were visually inspected. The mobile task and succeeded
run were readable, and the avatar rendered after the required binary was added.
The shared-skills page rendered; skill authoring, installation and agent reuse
were not acceptance-tested here.

## Evidence and teardown

[Attempt 6 originals](paperclip-evaluation/attempt-6/packet-manifest.json) contain
64 files / 1,988,492 bytes: complete command streams, safe original API bodies,
the actual npm lock, eight DOM captures, four PNGs, receipt and manifest.
Independent verification checked every manifest/stream digest and rebuilt all
1,213 canonical and nine exported source entries from Git objects, including
symlink targets and modes, against all six source guards. See
[independent review](paperclip-evaluation/independent-review.json).

The passed pipeline used seven orchestrated commands / fourteen complete
streams. Both server process groups and the fixture worker were absent; browser
contexts/browser closed; listener refused connections; the nonce-owned database
was dropped after its ownership marker was rechecked; scratch was removed.
Runner scratch measured 2,695,403,955 bytes / 73,606 files, within the original
3 GiB / 100,000-file bound. Database size was 30,867,983 bytes, below 256 MiB.
The PostgreSQL service and its container were then stopped by GitHub Actions.

## Earlier attempts retained

| Attempt | Source | Run | Failure |
| --- | --- | --- | --- |
| 1 | e201c98a | [42865528995](https://github.com/alvarovillalbaa/agents-os/actions/runs/42865528995) | Omitting optionals excluded required Sharp binary. |
| 2 | b519da2c | [42866117008](https://github.com/alvarovillalbaa/agents-os/actions/runs/42866117008) | Including every optional dependency exceeded the original scratch bound; that limit was retained. |
| 3 | b3cfa7cd | [42866928912](https://github.com/alvarovillalbaa/agents-os/actions/runs/42866928912) | Verifier used a wrong, unversioned Sharp binary path. Official package contents corrected it. |
| 4 | ff94e51f | [42867501529](https://github.com/alvarovillalbaa/agents-os/actions/runs/42867501529) | Native 422 required an assignee for an in-progress task. Fixture now uses the company's actual board user. |
| 5 | ce86d576 | [42868071665](https://github.com/alvarovillalbaa/agents-os/actions/runs/42868071665) | P01-P06 passed; real desktop avatar requests returned 503 because the esbuild platform binary was missing. |

Each attempt has its unchanged safe originals under the corresponding
`paperclip-evaluation/attempt-N/` directory. All manifests/streams were independently
verified and all receipts prove owned-resource cleanup. No failure was turned
into a passing result, ignored HTTP error or upstream patch.

## Product decision and remaining work

Build Agents OS as a trusted Paperclip extension in this existing personal fork.
Reuse native Tasks, agents, skills and their control boundaries. Add a persistent
CRM and explicit long-horizon Mission flows rather than duplicating the host's
task/runtime system. Paperclip's [pinned authoring guide](https://github.com/paperclipai/paperclip/blob/d69631b01b9c658f80bf8bed389863dce82643e1/doc/plugins/PLUGIN_AUTHORING_GUIDE.md)
documents company-scoped plugin APIs, namespaced persistence and UI routes.
That is source evidence for the integration direction; plugin installation and
its persistence/security behavior still need actual checks before adoption.

The next ready implementation is the CRM foundation: company-scoped contacts,
editing/archive, task links and actual database/UI persistence checks against
the pinned host. Missions follow with durable progress, review and recovery.
Provider execution, tenant/security qualification, full shared-harness workflows,
distribution and production hosting remain open. No real account/contact data,
provider/model call, paid resource or production configuration was used.

The fork's broad typecheck/test/build were not run: its application files were
unchanged, and the host failed Storage Guard. This isolated published-package
evaluation does not qualify the older fork's build or deployment.
Source and report `git diff --check` passed. The complete evidence diff reports
two trailing-whitespace lines in attempt5's original captured HTML; those bytes
are preserved so its original manifest remains valid.

Temporary workflow 413582333 was verified `disabled_manually` on
10 November 2026 at 17:53:02 UTC, before definition removal. Existing workflows,
root docs, dependency locks and all 1,203 baseline blobs/modes are preserved.
Evaluation-only push commits use GitHub's documented
[skip marker](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/skip-workflow-runs)
to avoid the inherited npm-release/lockfile push side effects; the explicit
evaluation workflow ran all required checks.

After publication,all six owned QA refs were retired with atomic exact-lease
deletion;their source commits remain ancestors of the accepted evaluation.
The [cleanup receipt](paperclip-evaluation/cleanup.json) records removal of
190 verified duplicate/reproducible files (15,851,545 bytes). All 169 original
packet files (4,738,543 bytes) remain in this repository,including every failure.
The unpublished initial preparation remains preserved. See also the
[native-package inspection](paperclip-evaluation/native-package-inspection.json).
