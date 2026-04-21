## Context

The bot currently handles @mention and reply-to-bot events through `src/handlers/chat.ts`, which calls `chatWithAI()` in `src/services/chat.ts`. The AI receives only the current user message plus a short in-memory conversation history (8 messages, 1h TTL). It has no visibility into the broader group conversation, causing replies that miss context and feel disconnected.

The "Minh" persona is defined by a system prompt in `chat.ts` plus a `postProcessResponse()` function that uses regex to replace formal Vietnamese phrases and randomly appends emoticons and filler strings. This approach is brittle: the regex can over-fire, the random appender produces inconsistent output, and the persona instructions in the system prompt are too sparse to reliably generate natural-sounding slang without post-processing.

The codebase already has two established patterns this change extends:
1. **XML injection defense** — `askQuestion()` in `services/summarizer.ts` wraps user-supplied conversation history in `<conversation>...</conversation>` tags before interpolating into the system prompt.
2. **Dependency injection via interface** — `query.ts` and `ask.ts` both accept narrow `{ method() }` interfaces rather than concrete service classes, which enables isolated unit testing.

## Goals / Non-Goals

**Goals:**
- Give the AI real group conversation context (last 50 messages) before answering @mention/reply queries.
- Rewrite the Minh persona system prompt so natural Vietnamese slang is expressed natively without regex post-processing.
- Decouple the chat handler from the concrete MTProto client via a typed interface.
- Degrade gracefully when MTProto fetch fails (continue with no context, no user-visible error).

**Non-Goals:**
- Not changing the conversation memory system (8-message, 1h TTL ring buffer) — that is a separate concern.
- Not fetching context for private messages (already rejected before the handler fires).
- Not adjusting max_tokens or rate limiting parameters.
- Not replacing `postProcessResponse()` phrase substitutions — those are kept as a low-risk safety net.
- Not streaming the AI response.

## Decisions

### D1: XML tags for group context injection

**Decision:** Append group context to the system prompt inside `<recent_chat>...</recent_chat>` tags.

**Rationale:** Consistent with the existing `<conversation>` tag pattern in `summarizer.ts`. XML delimiters clearly separate injected content from prompt instructions, reducing the risk of a malicious group message hijacking the prompt. Alternatives considered:
- Injecting as a user-turn message in the messages array — would pollute conversation history and affect follow-up turns.
- Plain string interpolation — no defence boundary, rejected.

### D2: Narrow interface for MTProto dependency

**Decision:** Define `ChatTelegramClient = { fetchMessages(chatId: number, limit: number): Promise<FetchedMessage[]> }` in `handlers/chat.ts` and pass the concrete client at the call site in `index.ts`.

**Rationale:** Same pattern as query/ask handlers. Keeps the handler unit-testable without spinning up GramJS. The concrete `telegramClient` object in `index.ts` already satisfies this shape — no adapter needed.

### D3: Format group context inline in the handler

**Decision:** Format fetched messages as `[HH:MM] username: text` directly in `chat.ts` handler, not by importing `formatMessages()` from `summarizer.ts`.

**Rationale:** `formatMessages()` includes logic and imports tied to the summarizer's `FetchedMessage` type. Copying the two-line format pattern inline avoids a cross-service dependency and keeps the handler self-contained. The format is simple enough to not warrant sharing.

### D4: Remove random emoticon/filler appender, keep phrase replacements

**Decision:** Delete the randomized portion of `postProcessResponse()` that appends emoticons and filler strings. Retain phrase substitutions (e.g., "anh/chị" → "mày/tao").

**Rationale:** The random appender produces non-deterministic output that is hard to test and sometimes feels jarring. With a well-written persona prompt, the AI should produce appropriate emoticons naturally. The phrase substitutions are a cheaper safety net and low-risk to keep.

### D5: Persona rewrite strategy

**Decision:** Rewrite `CHAT_SYSTEM_PROMPT` to explicitly describe Minh's slang vocabulary, sentence patterns, and when to reference `<recent_chat>` context. Do not add a separate "style" post-processing step.

**Rationale:** LLMs follow detailed persona instructions reliably. Embedding examples of natural phrases directly in the prompt ("say 'oke bạn ơi' not 'được rồi'") is more predictable than regex substitution. The `<recent_chat>` reference instruction tells the AI to actively use context rather than ignoring it.

## Risks / Trade-offs

- **MTProto latency adds to response time** — fetching 50 messages may add 200-500 ms. Mitigation: the fetch is non-blocking relative to Telegram delivery; users already expect a short pause for AI generation. If latency becomes an issue, message count can be reduced or the fetch can be parallelised with context retrieval.
- **Increased token usage** — injecting 50 messages into the system prompt increases input tokens per request. Mitigation: 50 short messages is typically under 2 000 tokens; Haiku's context window is large enough to absorb this without impacting max_tokens for the reply.
- **Persona rewrite may change tone** — existing users may notice differences. Mitigation: the rewrite targets more natural output, which is the goal; regression is unlikely to be worse than the current state.
- **Phrase replacement regex may conflict with new persona output** — Mitigation: the replacements target specific formal constructions that the new prompt instructs the AI to avoid anyway, so co-occurrence will be rare.

## Migration Plan

All changes are backward-compatible at runtime:
1. Deploy updated `services/chat.ts` (new signature with optional param — existing callers passing no context still work).
2. Deploy updated `handlers/chat.ts` (new interface param).
3. Deploy updated `index.ts` (pass `{ fetchMessages }` to the handler).
4. No configuration changes, no data migrations, no rollout flags needed.
5. Rollback: revert the three files; no state is persisted by this change.

## Open Questions

None — all decisions are grounded in existing codebase patterns and the plan is fully specified.
