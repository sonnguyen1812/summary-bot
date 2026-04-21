## [2026-04-21] Round 1 (from apply auto-verify)

### Verifier
- Fixed: `askQuestion()` in `src/services/summarizer.ts` was sending two consecutive `user` messages to the Anthropic API, which is invalid. Combined the conversation history and question into a single user message: `<conversation>...\n\nCâu hỏi: <question>`.
