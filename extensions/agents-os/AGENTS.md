# Agents OS extension

This folder owns Alvaro's CRM/Missions extension, not Paperclip's host runtime.
Read README.md and ../../doc/plans/2026-11-10-agents-os-crm.md. Reuse the pinned
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

Do not commit dependencies, dist, archives, DB files or secrets. Publish package
artifacts separately after actual package installation and hash verification.
Keep all failures and retire temporary CI/owned fixtures after verification.
