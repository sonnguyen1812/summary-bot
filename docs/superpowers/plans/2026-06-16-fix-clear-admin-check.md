# Fix /clear Admin-Check Bug Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bỏ khối admin-only check trong `/clear` để lệnh chạy được với mọi thành viên (gồm admin ẩn danh), loại bỏ thông báo lỗi "Không thể kiểm tra quyền admin".

**Architecture:** Xóa khối `try/catch` gọi `getChatMember` (clear.ts:23-34) — chính nơi ném lỗi và sinh thông báo. Giữ nguyên group-only guard, `userId` guard (cần cho rate-limit key), rate limiter, và toàn bộ logic fetch/xóa tin.

**Tech Stack:** TypeScript (ESM/NodeNext), grammY. Dự án không có test framework — verify bằng `yarn build` + grep.

**Spec:** `docs/superpowers/specs/2026-06-16-fix-clear-admin-check-design.md`

---

## File Structure

| File | Trách nhiệm | Hành động |
|------|-------------|-----------|
| `src/handlers/clear.ts` | Handler lệnh `/clear` | Modify: xóa khối admin-only check (dòng 23-34) |

---

## Task 1: Bỏ admin-only check trong /clear

**Files:**
- Modify: `src/handlers/clear.ts`

- [ ] **Step 1: Xóa khối admin-only check**

Trong `src/handlers/clear.ts`, xóa NGUYÊN khối sau (hiện ở dòng 23-34), gồm cả comment `// Admin-only check` và dòng trống đứng trước phần rate-limit:

```typescript
    // Admin-only check
    try {
      const member = await ctx.api.getChatMember(chatId, userId);
      if (member.status !== "administrator" && member.status !== "creator") {
        await ctx.reply("Chỉ admin mới có thể xóa tin nhắn bot.");
        return;
      }
    } catch (err) {
      console.warn("[Clear] Failed to check admin status:", err);
      await ctx.reply("Không thể kiểm tra quyền admin. Vui lòng thử lại sau.");
      return;
    }
```

Sau khi xóa, đoạn từ `if (!userId) return;` phải liền mạch xuống phần rate-limit. Kết quả mong muốn (clear.ts từ dòng 19 trở đi):

```typescript
    const chatId = ctx.chat.id;
    const userId = ctx.from?.id;
    if (!userId) return;

    const remaining = rateLimiter.check(userId.toString());
    if (remaining !== null) {
      await ctx.reply(`Vui lòng chờ ${remaining} giây trước khi dùng lệnh này lại.`);
      return;
    }
```

KHÔNG đụng: group-only guard (dòng 14-17), `if (!userId) return;`, rate limiter, logic fetch `fetchBotRelatedMessageIds`, vòng xóa batch, confirm tự xóa 5s.

- [ ] **Step 2: Verify khối admin đã hết**

Run: `grep -n "getChatMember\|kiểm tra quyền admin\|Admin-only" src/handlers/clear.ts`
Expected: không có kết quả (rỗng)

- [ ] **Step 3: Build**

Run: `yarn build`
Expected: build pass, không lỗi TypeScript (đặc biệt `userId` vẫn được dùng ở rate-limit nên không có cảnh báo "unused")

- [ ] **Step 4: Commit**

```bash
git add src/handlers/clear.ts
git commit -m "fix(clear): remove admin-only check that blocked anonymous admins"
```

---

## Final Verification

- [ ] `yarn build` pass.
- [ ] `grep -rn "getChatMember" src/handlers/clear.ts` → rỗng.
- [ ] `grep -rn "Không thể kiểm tra quyền admin" src/` → rỗng.
- [ ] Đọc lại `clear.ts`: sau `if (!userId) return;` là rate-limit check, không còn khối admin; các phần còn lại (fetch, xóa batch, confirm) nguyên vẹn.
