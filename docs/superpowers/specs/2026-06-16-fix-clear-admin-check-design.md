# Design: Fix /clear admin-check bug — remove admin-only gate

**Ngày:** 2026-06-16
**Phạm vi:** `src/handlers/clear.ts`

## Context

Lệnh `/clear` báo lỗi `"Không thể kiểm tra quyền admin. Vui lòng thử lại sau."`
ngay cả khi admin chạy. Root cause: khối admin-only check gọi
`ctx.api.getChatMember(chatId, userId)` (clear.ts:25). Khi lời gọi này ném
exception, handler rơi vào nhánh `catch` (clear.ts:30-34) và trả về thông báo đó,
chặn luôn việc clear.

`getChatMember` ném lỗi trong các tình huống:
1. **Admin ẩn danh** (Remain Anonymous): `ctx.from` là `GroupAnonymousBot`
   (id 1087968824), không phải user thật trong nhóm → Telegram báo "user not
   found" → ném lỗi. Danh sách admin vẫn hiện tên thật nên khó nhận ra.
2. Lỗi mạng/timeout tạm thời khi gọi Bot API.

## Goals / Non-Goals

**Goals:**
- Loại bỏ thông báo lỗi "Không thể kiểm tra quyền admin" và cho `/clear` chạy
  được với mọi thành viên (gồm admin ẩn danh).

**Non-Goals:**
- Không thêm cơ chế phân quyền thay thế (whitelist, config bật/tắt admin-only).
- Không đổi logic fetch/xóa tin, không đổi rate-limit.

## Decision

Bỏ hẳn admin-only check (hướng C do user chọn).

Trong `src/handlers/clear.ts`, xóa toàn bộ khối:

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

Vì thông báo lỗi nằm chính trong `catch` của `getChatMember`, bỏ khối này thì
thông báo không còn xuất hiện, và admin ẩn danh cũng clear được.

**Giữ nguyên:**
- Guard group-only (private → từ chối).
- `if (!userId) return;` (clear.ts:21) — vẫn cần cho rate-limit key.
- Rate limiter 30s/user.
- Toàn bộ logic fetch `fetchBotRelatedMessageIds` + xóa theo batch 100 + xác nhận
  tự xóa sau 5s.

## Risks / Trade-offs

- **[Risk] Mọi thành viên đều chạy được `/clear`.** Blast radius hẹp: `/clear` chỉ
  xóa tin của chính bot + các tin lệnh (`/summary`, `/clear`, `/ask`, `/search`,
  `/query`), KHÔNG xóa tin nhắn thường của thành viên khác. Rate-limit 30s/user
  vẫn chặn spam. → Chấp nhận theo quyết định của user.

## Verify

- `yarn build` pass.
- `grep -n "getChatMember" src/handlers/clear.ts` → rỗng.
- `grep -n "Không thể kiểm tra quyền admin" src/` → rỗng.
- Đọc lại clear.ts: sau guard `if (!userId) return;` là phần rate-limit check,
  không còn khối admin.
