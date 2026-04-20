---
name: verify
description: Verify implementation matches change artifacts. Use when the user wants to validate that implementation is complete, correct, and coherent before archiving.
---

Before launching the subagent, gather context from the current conversation:

1. If an OpenSpec change name exists (from a prior spec or implementation):
   - Pass the change name — the subagent reads spec artifacts automatically
2. If no spec but implementation was just done:
   - Summarize what was implemented and what the expected behavior should be
3. If user provides explicit arguments:
   - Pass those directly

Brief the user, then launch Agent tool with `subagent_type: "osf-verify"`.