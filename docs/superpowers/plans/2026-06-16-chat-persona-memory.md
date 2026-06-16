# Chat Persona Memory Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cải thiện flow chat (@mention/reply) — lưu tên người vào memory, nhớ lâu/nhiều hơn, giảm trùng context, bỏ regex postProcess, dọn tên "Minh" khỏi docs.

**Architecture:** Sửa 3 file trong `src/` (chat-memory, chat service, chat handler) theo thiết kế tối thiểu — prefix tên vào *content* tin user (không đổi role API), tăng hằng số memory, xóa hàm postProcess và bù vào persona prompt. Dọn docs openspec.

**Tech Stack:** TypeScript (ESM/NodeNext), Anthropic SDK, grammY. Dự án không có test framework — verify bằng `yarn build` và script `tsx` tạm thời cho logic thuần.

**Spec:** `docs/superpowers/specs/2026-06-16-improve-chat-persona-memory-design.md`

---

## Task 1: chat-memory — lưu tên người + tăng dung lượng/TTL

**Files:**
- Modify: `src/services/chat-memory.ts`
- Test (tạm, sẽ xóa): `src/services/chat-memory.test.mts`

- [ ] **Step 1: Viết test thất bại**

Tạo `src/services/chat-memory.test.mts`:

```typescript
import assert from "node:assert";
import { addToMemory, getRecentContext } from "./chat-memory.js";

// 1. Tin user có name -> prefix "Tên: nội dung"
addToMemory(1, "user", "alo bot", "Nam");
addToMemory(1, "assistant", "gì đó");
const ctx = getRecentContext(1);
assert.deepStrictEqual(ctx, [
  { role: "user", content: "Nam: alo bot" },
  { role: "assistant", content: "gì đó" },
]);

// 2. Tin user KHÔNG có name (caller /ask, /search) -> giữ nguyên
addToMemory(2, "user", "[/ask] hôm nay bàn gì");
const ctx2 = getRecentContext(2);
assert.deepStrictEqual(ctx2, [{ role: "user", content: "[/ask] hôm nay bàn gì" }]);

console.log("PASS");
```

- [ ] **Step 2: Chạy test, xác nhận FAIL**

Run: `yarn tsx src/services/chat-memory.test.mts`
Expected: FAIL (AssertionError — `getRecentContext` hiện trả `"alo bot"` không prefix tên)

- [ ] **Step 3: Sửa `chat-memory.ts`**

Sửa interface `StoredMessage` (thêm `name?`):

```typescript
interface StoredMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  name?: string;
}
```

Đổi 3 hằng số:

```typescript
const MAX_MEMORY_PER_CHAT = 50;
const MEMORY_TTL_MS = 24 * 60 * 60 * 1000;
```

(giữ nguyên `MAX_CHATS = 500`, `MAX_MEMORY_CONTENT = 2000`)

Sửa `getRecentContext` — đoạn `return fresh.map(...)`:

```typescript
  return fresh.map(({ role, content, name }) => ({
    role,
    content: role === "user" && name ? `${name}: ${content}` : content,
  }));
```

Sửa chữ ký + thân `addToMemory` (thêm param `name?`):

```typescript
export function addToMemory(chatId: number, role: "user" | "assistant", content: string, name?: string): void {
  const truncated = content.length > MAX_MEMORY_CONTENT
    ? content.slice(0, MAX_MEMORY_CONTENT) + "…"
    : content;

  if (!chatMemory.has(chatId)) {
    chatMemory.set(chatId, []);
  }
  const messages = chatMemory.get(chatId)!;
  messages.push({ role, content: truncated, timestamp: Date.now(), name });
```

(phần còn lại của hàm — `while` shift + cleanup `MAX_CHATS` — giữ nguyên)

- [ ] **Step 4: Chạy test, xác nhận PASS**

Run: `yarn tsx src/services/chat-memory.test.mts`
Expected: in ra `PASS`

- [ ] **Step 5: Xóa file test tạm + build**

Run: `rm src/services/chat-memory.test.mts && yarn build`
Expected: build pass, không lỗi TypeScript

- [ ] **Step 6: Commit**

```bash
git add src/services/chat-memory.ts
git commit -m "feat(chat-memory): store sender name and extend memory limits"
```

---

## Task 2: chat service — bỏ postProcess, tinh chỉnh persona prompt

**Files:**
- Modify: `src/services/chat.ts`

- [ ] **Step 1: Xóa hàm `postProcessResponse`**

Xóa toàn bộ khối từ `export function postProcessResponse(text: string): string {` đến dấu `}` đóng hàm (dòng 102-135 hiện tại), gồm cả mảng `replacements`.

- [ ] **Step 2: Thêm dòng cấm cụm cứng vào prompt**

Trong `CHAT_SYSTEM_PROMPT`, mục "CẤM TUYỆT ĐỐI", thêm 1 gạch đầu dòng (sau dòng `- Kết thúc bằng "Tóm lại"...`):

```
- Cụm trang trọng — tránh ngay khi viết, dùng bản nói: "tuy nhiên"→"nhưng mà", "vì vậy"→"nên là", "ví dụ"→"kiểu", "theo quan điểm của tôi"→"thấy là", "có lẽ"→"chắc", "ngoài ra"→"với lại", "đương nhiên"→"tất nhiên"
```

- [ ] **Step 3: Thêm dòng nhận diện format tên vào mục context**

Trong mục "SỬ DỤNG CONTEXT CUỘC TRÒ CHUYỆN", thêm 1 gạch đầu dòng MỚI (chèn trước backtick đóng template literal, sau dòng cuối `- Không nhắc đến việc mày đang đọc "recent chat"...`):

```
- Tin trong hội thoại có dạng "Tên: nội dung" — đó là người đang nói, gọi tên người ta khi hợp lý. Phần "Tên:" chỉ ở input; mày trả lời thì KHÔNG tự thêm tiền tố tên
```

> Cú pháp: chỉ chèn 1 dòng text mới vào *bên trong* template literal. Backtick `\`` + `;` đóng chuỗi (cuối dòng 60 hiện tại) giữ nguyên — không thêm/bớt backtick.

- [ ] **Step 4: Build**

Run: `yarn build`
Expected: build pass (lúc này `handlers/chat.ts` vẫn import `postProcessResponse` → SẼ LỖI; đó là tín hiệu chuyển Task 3. Nếu muốn build sạch, làm Task 3 trước khi build).

> Lưu ý thứ tự: Task 2 và Task 3 cùng đụng `postProcessResponse`. Làm Task 2 (xóa) rồi Task 3 (bỏ caller) liền nhau, build 1 lần ở cuối Task 3.

- [ ] **Step 5: Commit**

```bash
git add src/services/chat.ts
git commit -m "feat(chat): remove regex postProcess, bake casual tone into persona prompt"
```

---

## Task 3: chat handler — truyền tên người, lọc tin bot, bỏ postProcess

**Files:**
- Modify: `src/handlers/chat.ts`

- [ ] **Step 1: Sửa import (bỏ `postProcessResponse`)**

Dòng 2 đổi từ:

```typescript
import { chatWithAI, postProcessResponse, MAX_INPUT_CHARS } from "../services/chat.js";
```

thành:

```typescript
import { chatWithAI, MAX_INPUT_CHARS } from "../services/chat.js";
```

- [ ] **Step 2: Tính senderName từ ctx.from**

Sau dòng `const chatId = ctx.chat.id;` (dòng 36), thêm:

```typescript
    const senderName = ctx.from?.first_name || ctx.from?.username || "ai đó";
```

- [ ] **Step 3: Lọc tin bot khỏi `<recent_chat>`**

Trong khối format groupContext, sửa `.filter(...)` để loại tin của bot (so username, case-insensitive). Đổi:

```typescript
        const lines = recentMessages
          .filter((m) => m.text.trim().length > 0)
```

thành:

```typescript
        const botUsernameLower = botUsername?.toLowerCase();
        const lines = recentMessages
          .filter((m) => m.text.trim().length > 0)
          .filter((m) => !botUsernameLower || m.username?.toLowerCase() !== botUsernameLower)
```

> Kiểm tra: nếu `telegram-client.ts extractMessage()` đã skip tin bot theo `botUserId` thì bước này là phòng thủ (no-op). Vẫn giữ để an toàn khi username trùng. Báo lại kết quả quan sát trong phần verify.

- [ ] **Step 4: Bỏ postProcess, dùng thẳng aiResponse + truyền tên vào memory**

Đổi khối dòng 120-124 hiện tại:

```typescript
      const processed = postProcessResponse(aiResponse);
      addToMemory(chatId, "user", cleanText.length > MAX_INPUT_CHARS ? cleanText.slice(0, MAX_INPUT_CHARS) : cleanText);
      addToMemory(chatId, "assistant", processed);

      await ctx.api.editMessageText(chatId, reply.message_id, processed);
```

thành:

```typescript
      addToMemory(chatId, "user", cleanText.length > MAX_INPUT_CHARS ? cleanText.slice(0, MAX_INPUT_CHARS) : cleanText, senderName);
      addToMemory(chatId, "assistant", aiResponse);

      await ctx.api.editMessageText(chatId, reply.message_id, aiResponse);
```

- [ ] **Step 5: Build (sạch — gồm cả Task 2)**

Run: `yarn build`
Expected: build pass, không còn tham chiếu `postProcessResponse`

- [ ] **Step 6: Verify không còn postProcess trong codebase**

Run: `grep -rn "postProcessResponse" src/`
Expected: không có kết quả

- [ ] **Step 7: Commit**

```bash
git add src/handlers/chat.ts
git commit -m "feat(chat): pass sender name to memory, filter bot from recent context"
```

---

## Task 4: Dọn tên "Minh" khỏi openspec docs

**Files:**
- Modify: `openspec/specs/chat-persona-rewrite/spec.md`
- Modify: `openspec/changes/archive/2026-04-21-improve-chat-group-context-and-persona/design.md`
- Modify: `openspec/changes/archive/2026-04-21-improve-chat-group-context-and-persona/proposal.md`
- Modify: `openspec/changes/archive/2026-04-21-improve-chat-group-context-and-persona/specs/chat-persona-rewrite/spec.md`

- [ ] **Step 1: Sửa active spec**

Trong `openspec/specs/chat-persona-rewrite/spec.md` dòng 7, đổi:

```
- **WHEN** the AI generates a reply under the Minh persona
```

thành:

```
- **WHEN** the AI generates a reply under the in-group persona
```

- [ ] **Step 2: Sửa các file archive**

Trong 3 file archive, thay mọi cụm `Minh persona` / `"Minh"` / `Minh's` bằng `in-group persona` / `the persona` / `the persona's` cho hợp ngữ cảnh. Cụ thể:

`.../archive/.../specs/chat-persona-rewrite/spec.md` dòng 7:
- `under the Minh persona` → `under the in-group persona`

`.../archive/.../design.md`:
- dòng 5: `The "Minh" persona is defined` → `The in-group persona is defined`
- dòng 15: `Rewrite the Minh persona system prompt` → `Rewrite the in-group persona system prompt`
- dòng 56: `describe Minh's slang vocabulary` → `describe the persona's slang vocabulary`

`.../archive/.../proposal.md`:
- dòng 3: `The "Minh" persona also relies` → `The in-group persona also relies`
- dòng 7: `natural "Minh" persona with slang` → `natural in-group persona with slang`
- dòng 16: `Rewrite the "Minh" chat persona` → `Rewrite the in-group chat persona`

`.../archive/.../tasks.md` dòng 5:
- `give Minh a vivid personality` → `give the persona a vivid personality`

- [ ] **Step 3: Verify không còn "Minh" persona (chỉ còn Ho_Chi_Minh)**

Run: `grep -rin "minh" openspec/`
Expected: không còn kết quả (openspec không chứa `Ho_Chi_Minh`)

Run: `grep -rin "minh" src/`
Expected: không có kết quả

- [ ] **Step 4: Commit**

```bash
git add openspec/
git commit -m "docs: remove Minh persona name, use nameless in-group persona"
```

---

## Final Verification

- [ ] `yarn build` pass.
- [ ] `grep -rn "postProcessResponse" src/` → rỗng.
- [ ] `grep -rin "minh" src/` → rỗng.
- [ ] Đọc lại `getRecentContext`: tin user có name cho ra `"Tên: nội dung"`, tin assistant + tin không name giữ nguyên.
- [ ] `MAX_MEMORY_PER_CHAT === 50`, `MEMORY_TTL_MS === 24h`.
- [ ] `CHAT_SYSTEM_PROMPT` có dòng cấm cụm cứng + dòng nhận diện format `"Tên:"`.

