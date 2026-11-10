# Agents OS

A personal operating system for coordinating agents, long-horizon work and
customer relationships. This existing Paperclip fork owns Alvaro's Agents OS project. This folder owns
only its additive prerequisite evaluation; existing fork code is preserved.

The full brief requires CRM, Tasks, Missions and a shared harness for agents
and skills. It explicitly asks to try Paperclip before building. The first
workstream is therefore a real, isolated evaluation of a pinned Paperclip
release. The requested Agents OS extensions are **not implemented yet**.

See [requirements and source](docs/spec.md), the
[implementation sequence](../../doc/plans/2026-11-10-agents-os-paperclip.md) and the
[frozen evaluation](docs/proposals/paperclip-evaluation.md).

No local installation or production hosting is required for the evaluation.
It uses authored data and a deterministic process adapter in a disposable CI
environment. It makes no model/provider calls and qualifies no autonomous AI
performance. A local trusted evaluation must never be exposed publicly.

All eight prerequisite checks passed in run42868725319. Read the
[results and remaining product work](../../doc/results/2026/11-10/paperclip-evaluation.md).
CRM and Mission implementation are next; the requested app remains unfinished.
