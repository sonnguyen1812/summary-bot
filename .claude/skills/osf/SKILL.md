---
name: osf
description: Launch any kit skill by name. Usage: /osf [skill] [args]
---

Available skills: feat, fix, chore, refactor, perf, docs, test, ci, docker, git, autopilot, research, browser, explain, analyze, apply, archive, proposal, verify, uiux-design, setup

Supporting subagents (used internally by skills):
- osf-analyze — Structural codebase analysis (dependencies, blast radius, call chains) via GitNexus + codebase-retrieval
- osf-apply — Implement tasks from spec or conversation plan
- osf-archive — Archive completed change to openspec/changes/archive/
- osf-proposal — Create spec (proposal, design, tasks) for implementation
- osf-researcher — Web research (technical docs, best practices, comparisons, security advisories)
- osf-uiux-designer — UI/UX design analysis and reports
- osf-verify — Verify implementation matches spec

Aliases:
- auto → autopilot

Dispatch rules:

1. If "$0" is present and matches a supported skill or alias, resolve the alias first, then use the Skill tool to invoke the resolved skill name.
2. If "$0" is empty or not in the supported skill list, infer the best matching skill from the user's request and invoke that instead.
3. Use the most specific match:
   - bug fix, broken behavior, error, regression, "sửa lỗi" → `fix`
   - new feature, enhancement, "thêm tính năng" → `feat`
   - refactor, cleanup without behavior change → `refactor`
   - performance, speed, latency, optimization → `perf`
   - docs, README, guide, comments → `docs`
   - tests, coverage, unit/integration/e2e tests → `test`
   - CI/CD, workflow automation, pipelines → `ci`
   - Docker, containers, images, compose → `docker`
   - git status/commit/pull/push/merge/rebase/log/changelog → `git`
   - browser reproduction, visual bug investigation, navigation → `browser`
   - explain how code works, teach-back, understanding flow → `explain`
   - impact analysis, dependency tracing, feasibility, blast radius → `analyze`
   - research docs, best practices, comparisons, advisories → `research`
   - project scaffolding, boilerplate, initial setup → `setup`
   - proposal/spec creation → `proposal`
   - implementation from plan/spec → `apply`
   - verification/review against spec → `verify`
   - archive completed change → `archive`
   - UI/UX review or design direction → `uiux-design`
   - fully autonomous end-to-end workflow → `autopilot`
4. If the request could reasonably map to multiple skills and no best match is clear, ask the user which skill to run. Do not guess when intent is ambiguous.

If the user provided additional arguments beyond the skill name, include them as context for the invoked skill.

ARGUMENTS: $ARGUMENTS