# Agents OS extension

This folder owns Alvaro's CRM/Missions extension, not Paperclip's host runtime.
Read README.md, ../../doc/plans/2026-11-10-agents-os-crm.md and the Missions plan
../../doc/plans/2026-11-10-agents-os-missions.md. Reuse the pinned
published Paperclip2026.1106.0 host/SDK; preserve the surrounding fork and locks.

Keep contacts company-scoped. Only host-authorized board scoped API requests may
read/write CRM records. Never add a bridge handler that bypasses that boundary.
Use parameterized namespace SQL and native issue APIs, optimistic revisions and
stable request IDs. Preserve uncertain mutations/drafts and pending audit work.
Do not log contact names, email, phone, notes or request bodies.

Standing owner approval includes implementation, exact dependencies, the additive
plugin migration, authored tests, bounded public CI and publication. No new
confirmation for this scope. No real data, model/provider call, paid resource,
new account or production Auth/DB/configuration change. No subagents.

No host install/build/runtime while Storage Guard fails. Build/typecheck/tests
and actual plugin/DB/browser checks run in owned isolated CI. Source changes
need appropriate checks; docs-only changes need diff validation. Report limits.
Never claim Missions or full Agents OS complete from CRM checks.

Missions owns objective/checkpoints, review evidence, durable command replay and
recovery. Native Tasks remain authoritative for execution and status. Review
must bind the Task version shown to the reviewer; changed Tasks invalidate
approval. Pause/reopen controls hold Mission progression and never silently
change a Task or agent. Preserve both immutable migration001 and published CRM
results. All Missions scope gates and tests are covered by standing approval.

Do not commit dependencies, dist, archives, DB files or secrets. Publish package
artifacts separately after actual package installation and hash verification.
Keep all failures and retire temporary CI/owned fixtures after verification.
