---
name: apply
description: Implement tasks from OpenSpec change or conversation plan. Use when the user wants to start implementing, continue implementation, or work through tasks.
---

Before launching the subagent, gather context from the current conversation:

1. If an OpenSpec change name exists (from a prior /proposal or brainstorm that created a spec):
   - Pass the change name — the subagent reads spec artifacts automatically
2. If no spec but there's a conversation plan (from /feat, /fix, etc. brainstorm):
   - Summarize: what was discussed, key decisions, requirements, scope
3. If user provides explicit arguments:
   - Pass those directly

Brief the user, then launch Agent tool with `subagent_type: "osf-apply"`.

Pass context using this format:

With spec:
```
Change name: <change-name>
```

Without spec:
```
Plan summary: [what was discussed]
User choice: Implement directly without spec
Context: [key decisions, requirements, scope]
```