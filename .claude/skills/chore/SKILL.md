---
name: chore
description: Plan maintenance work. Explore scope, assess impact, then implement with optional spec creation.
---

You are planning maintenance work. This command helps you explore the scope, assess impact, and decide on the best implementation path.

BEFORE PROCEEDING: You MUST use the Skill tool to invoke "explore". This loads the shared explore mode behavior (stance, verification, workflow, subagent protocols, OpenSpec awareness, guardrails) that this command depends on. Do not proceed without loading it first.

---

## What You Might Do

**Explore the problem space**
- Feynman Echo — restate the maintenance work in the simplest possible language, then ask user to confirm or correct
- Ask clarifying questions that emerge from what they said
- Challenge assumptions
- Reframe the problem
- Find analogies

**Investigate the codebase**
- Map existing architecture relevant to the maintenance work
- Find integration points
- Identify patterns already in use
- Surface hidden complexity

**Compare options**
- Brainstorm multiple approaches
- Build comparison tables
- Sketch tradeoffs
- Recommend a path (if asked)

**Visualize**
```
┌─────────────────────────────────────────┐
│     Use ASCII diagrams liberally        │
├─────────────────────────────────────────┤
│   System diagrams, dependency graphs,   │
│   before/after comparisons              │
└─────────────────────────────────────────┘
```

**Research external knowledge**
- When discussion involves technology choices, best practices, or security concerns → delegate to osf-researcher

**Look up API documentation**
- When discussion needs precise API usage → delegate to osf-researcher for web research

**Surface risks and unknowns**
- Identify what could go wrong
- Find gaps in understanding
- Suggest spikes or investigations

---

## Stress-test Questions

Resolve these before ending discovery. Self-answer by exploring the codebase. Only surface items to the user that are genuinely ambiguous or require a personal/team style choice:

1. Impact assessment:
   "Could this maintenance work affect anything:
    A. No — isolated change
    B. Maybe — need to check related code
    C. ★ Likely — need comprehensive testing
    D. Khác/Other: ___"

2. Scope clarity:
   "What's included in this maintenance:
    A. Just this component
    B. This component + related dependencies
    C. ★ Full audit and update across codebase
    D. Khác/Other: ___"

3. Test strategy:
   "Test level needed:
    A. Manual verification only
    B. Unit tests for changed code
    C. ★ Unit + integration tests
    D. Khác/Other: ___"

4. Architecture decisions:
   "Approach for this maintenance:
    A. Minimal changes, keep existing patterns
    B. Modernize while maintaining compatibility
    C. ★ Follow existing project pattern: [detected pattern]
    D. Khác/Other: ___"

---

## Zero-Fog Checklist (additions)

- [ ] Scope is specific enough for a verifier to objectively check
- [ ] All affected areas are explicitly named (not "update related code" — which files?)
- [ ] Impact assessment is clear (what could break?)
- [ ] Test strategy decided (unit? integration? regression? which functions need edge case tests?)

The following is the user's request: