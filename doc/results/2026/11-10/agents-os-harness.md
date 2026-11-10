# Shared Harness0.1.0 — verified companion

An opt-in native Paperclip companion now supplies one company skill, Mission
Planner and Mission Operator, and the Shared Harness page. Both agents select
the same native skill key. Explicit setup creates only missing resources and
preserves names, instruction edits, skill forks and deliberate deselection.
Agents start paused, or pending native hire approval, with both heartbeat flags
off. Native settings own hire review, provider, budget and enabling work.

[Source](../../../../extensions/agents-os-harness/README.md),
[plan](../../../plans/2026-11-10-agents-os-harness.md),
[release](https://github.com/alvarovillalbaa/agents-os/releases/tag/agents-os-harness-v0.1.0).
Use the checked release archive with published Paperclip2026.1106.0. Extract it
into its own directory and install that local package through Paperclip's normal
plugin flow. It is separate from the unchanged CRM/Missions0.2.0 plugin; the
host's capability-upgrade guard remains intact. No NPM publication is claimed.

The accepted check source is73ba33c407782e08b94b6ce0cc6f26af9617c5bf;
workflow344ac7aae367460296dfb4473b91533d00e0186b;
[run42908360229](https://github.com/alvarovillalbaa/agents-os/actions/runs/42908360229).
All27 cases passed on the actual packaged companion and unmodified published
host:12 unit,9 API,2 actual restart and4 desktop/narrow Chromium scenarios.
The exact public Missions0.2.0 archive was downloaded, hashed and installed
alongside it; one real fixture contact and Mission stayed unchanged through
Harness setup and host restart. All1455 baseline paths/modes/blobs are preserved.

- Native APIs resolved both agents to the same materialized company skill and
  supported skill snapshots. Initial role guidance and canonical board-edited
  instructions were read through native APIs; edited bytes survived restart.
- Native fork/edit/reassignment, deliberate deselection, concurrent setup,
  board-only access, two-company isolation and real pending-hire approval records
  passed. A valid disposable agent key was denied both plugin routes in both
  companies, then revoked; its one-time body is explicitly withheld with a hash.
- Browser flows passed explicit setup, native agent/Missions navigation, pending
  approval links,390px reload, native operator retirement/missing-only recreation
  with customized planner preservation, and a committed-but-lost setup response
  followed by reload and identical retry with the same resource IDs.
- All17 commands/34 complete streams and7 full canonical/export/working-source
  guards passed. Four contexts/browser closed; original/restarted workers and
  all owned processes/groups/listener disappeared. The31,089,167-byte disposable
  DB and2,798,509,072-byte/78,223-file runtime scratch were removed by nonce-bound
  ownership checks. No provider/model call or heartbeat run was made.

[Receipt](agents-os-harness/receipt.json),
[independent byte/source verification](agents-os-harness/independent-review.json),
[package vector](agents-os-harness/packaged-files.json),
[review and limits](agents-os-harness/review.md),
[all-attempt manifest](agents-os-harness/release-manifest.json).
The final packet has161 original files/2,449,941 bytes. All six attempts,
including five failures, retain682 safe originals/8,743,641 uncompressed bytes
in the separate evidence ZIP. Earlier failures remain evidence, not successes.

| Asset | Bytes | SHA256 |
| --- | ---: | --- |
| agents-os-harness-0.1.0.tgz |216942|26bc15b4a89264d347e740c82b14fa851355c6f7994f436d43932abc76a31c35|
| agents-os-harness-evidence.zip |4379968|77c6480f1e2602bba08d2f4e257e35d116a1396984083539ae65e47524d75e07|

[Checksums](agents-os-harness/checksums.sha256) also cover the release manifest.
To reverify an extracted attempt, run the portable
[verifier](agents-os-harness/verify-packet.py) with packet directory, exact source
SHA, workflow SHA and optional `--repo PATH`; use `--allow-failure` for attempts1–5.
The source objects must be available in the repository. This checks all member,
stream, source/mode, request, capture, package and outcome vectors.

All four final PNGs were visually inspected. Narrow capture deliberately scrolls
the page under native sticky chrome, so its heading is outside the captured
viewport; all eight DOM captures and navigation assertions are retained. These
are viewport/emulation checks, not physical-device or full-page visual proof.
Storage Guard failed locally, so no local install/build/server/browser/DB ran.
No real data, new account, paid service, production Auth/DB binding or host patch.
This qualifies shared native configuration/materialization and coordination;
model execution quality, public hosting and finished Agents OS remain open.

Publication is verified: [public byte readback](agents-os-harness/publication.json)
records four anonymous HTTP200 downloads, matching asset metadata/local bytes,
and every682 downloaded ZIP member. The release tag points to the accepted
commit. [Cleanup](agents-os-harness/cleanup.json) records temporary workflow
disable/removal, six QA refs retired atomically with exact leases, all five
permanent workflows still active, and699 verified duplicate/index files totaling
19,733,670 bytes removed after public proof and no-open-handle checks. All
originals remain in the verified public ZIP; all source ancestry remains in Git.
