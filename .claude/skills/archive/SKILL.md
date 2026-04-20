---
name: archive
description: Archive a completed change in the experimental workflow. Use when the user wants to finalize and archive a change after implementation is complete.
---

Before launching the subagent, gather context from the current conversation:

1. If an OpenSpec change name exists (from a prior spec/implementation/verification):
   - Pass the change name — the subagent auto-detects artifacts to archive
2. If user provides explicit arguments:
   - Pass those directly

Brief the user, then launch Agent tool with `subagent_type: "osf-archive"`.