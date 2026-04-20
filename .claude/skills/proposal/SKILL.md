---
name: proposal
description: Create a new change with all artifacts needed for implementation. Automatically explores and clarifies when the request is vague before creating artifacts.
---

Before launching the subagent, gather context from the current conversation:

1. If there's a conversation plan (from /feat, /fix, etc. brainstorm):
   - Summarize: what was discussed, key decisions, requirements, scope, stress-test results
   - This gives the subagent full context to create accurate spec artifacts
2. If user provides explicit arguments (cold start):
   - Pass those directly — the subagent will explore and clarify as needed

Brief the user, then launch Agent tool with `subagent_type: "osf-proposal"`.

Pass context:
```
Plan summary: [what was discussed]
Context: [key decisions, requirements, scope]
```