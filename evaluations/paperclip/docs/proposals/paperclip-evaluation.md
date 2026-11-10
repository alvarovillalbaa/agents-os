# Model-free Paperclip prerequisite evaluation

Standing owner approval covers this necessary free evaluation,authored checks,
existing personal fork and one temporary public CI job per changed candidate. No
new confirmation is needed. Data tiers:T2 authored workflows/process output
and T3 a newly created,nonce-owned disposable PostgreSQL database.

Freeze upstream release `v2026.1106.0`,commit
`d69631b01b9c658f80bf8bed389863dce82643e1`. The published CLI and server packages
both use version2026.1106.0. Verify their actual package-lock integrity against:

| Package | Public npm SHA512 integrity |
| --- | --- |
| paperclipai |jcZrSB5DItxeDJGO7TccI0WcYca2IbBJxpbaKZN6kZp+isNIbVF2AgmfFQq394mjXD+TTHwS5P3AT6jjpqXbng==|
| @paperclipai/server |OqG0qydn5Pky3iHmTgL3fvAh47m77CYgkuM3CgV6ciw6tY/AmBgkO3greyr0LinLFk7x1FdLkF1sfVVukZo/YA==|

Use Node24.22.2/Ubuntu24.04,Playwright1.65.0 and postgres client3.4.9 in owned
runner scratch. PostgreSQL17.6-alpine image manifest digest:
`sha256:ef257d85f76e48da1c64832459b59fcaba1a4dac97bf5d7450c77753542eee94`.
No local dependency install,server,browser or DB:StorageGuard11.5/34GiB failed.
Install the published package with its optional platform binaries included;
Sharp needs its Linux binary even though npm classifies it as optional. Keep
lifecycle scripts disabled. Retain the first omitted-binary failure separately.

Eight required cases:

1. Exact published CLI/server versions and integrity,owned install/config and
   actual server package entrypoint. No upstream source rebuild or patch.
2. Actual healthy HTTP API and bundled UI on127.0.0.1 only,local_trusted/private
   mode,telemetry/announcements/updates off. No provider credentials/service.
3. Create/read/update an authored company,company goal,project and linked task.
   Manually move the task through todo/in_progress/done and retain its comment.
   This tests operator task control,not AI completion.
4. Create a process-adapter agent using only an owned deterministic Node script.
   Invoke one actual heartbeat,observe its succeeded status,captured marker and
   injected company/agent/run identities. The fixture makes no network/model call.
5. Pause that agent,verify a further manual invocation is rejected because it
   is paused and no new process fixture execution occurs. Do not alter upstream
   authorization or bypass a refused operation.
6. Stop/restart the actual server against the same disposable DB and owned
   config;verify the same company,goal,project,task/comment,agent and run persist.
7. Desktop1280px:render the actual task,agent/run,goals and shared-skills routes,
   capture four DOM states/twoPNG and usable navigation without app mocks.
8. Narrow390px:same four routes/fourDOM/twoPNG,actual readable controls and no
   document horizontal overflow. This is not physical-touch or accessibility proof.

Eight DOM/fourPNG total. Preserve complete original commands and safe API bodies;
never include Authorization headers,API tokens or generated signing/master keys
in public evidence. A secret-bearing capture fails publication rather than
silently becoming a claimed complete original. All fixtures stay disposable.
The prepared pipeline has seven orchestrated commands/fourteen complete streams
and six complete canonical/entire-export guards. Server shutdown must record its
authorized SIGTERM,complete streams and actual original-group/listener absence.

Server startup uses the published startServer entrypoint used by its CLI. Run
upstream migrations only on a new uniquely named fixture database. Record its
nonce ownership as a database comment,check it before teardown,and drop only
that database after server/worker groups are absent. Preserve HOME and put
PAPERCLIP_HOME/config/storage/logs/temp/cache in owned scratch. No installed
service,public tunnel,new account,provider/key setup,paid service or real data.

Finite prospective bounds:20minute job/17minute work,2000canonical files/64MiB
total/file2MiB/export4MiB;runtime scratch3GiB/DB256MiB;packet16MiB/stream1MiB/
DOM2MiB/PNG1MiB. Reject source mutation and unclosed child groups/streams,
browser contexts,browser,listener or owned database. Preserve failure evidence.
Preserve canonical symlink targets and modes without following them. Export only
this evaluator folder. Pin actions and disable the temporary workflow before removing its definition.
Retain all checked source ancestry;clean only verified duplicate transfers.
The fork's automatic push workflows include upstream npm publishing and lockfile
mutation. Evaluation-only commits use GitHub's documented [skip ci] marker to
avoid those unrelated push side effects; the exact explicit workflow_dispatch
checks remain required. No existing workflow or failed check is disabled.

After a complete pass,record requirement-by-requirement observations and make
the product decision. The evaluation does not complete Agents OS,CRM,Missions,
shared-harness execution,AI quality,production Auth/persistence or hosting.

Primary references:[upstream release](https://github.com/paperclipai/paperclip/releases/tag/v2026.1106.0),
[pinned config](https://github.com/paperclipai/paperclip/blob/d69631b01b9c658f80bf8bed389863dce82643e1/packages/shared/src/config-schema.ts),
[pinned runtime configuration](https://github.com/paperclipai/paperclip/blob/d69631b01b9c658f80bf8bed389863dce82643e1/server/src/config.ts),
[process adapter](https://docs.paperclip.ing/reference/adapters/process/),
[API contracts](https://github.com/paperclipai/paperclip/tree/d69631b01b9c658f80bf8bed389863dce82643e1/ui/src/api).
