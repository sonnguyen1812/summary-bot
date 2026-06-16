# Design: Cải thiện flow Chat / Persona

**Ngày:** 2026-06-16
**Phạm vi:** `src/services/chat-memory.ts`, `src/services/chat.ts`, `src/handlers/chat.ts` + dọn docs.

## Context

Flow chat (@mention / reply-to-bot) hiện có 3 điểm đau:

1. **Nhớ ngữ cảnh kém** — `chat-memory.ts` lưu theo `chatId`, mọi user gộp chung
   role `user`, không lưu tên người nói. Nhóm đông thì AI không phân biệt được ai
   hỏi gì.
2. **Giọng chưa tự nhiên** — `postProcessResponse()` dùng regex thay cụm trang
   trọng bằng slang *sau khi* AI sinh text. Persona prompt đã dạy nói suồng sã rồi
   nên regex dễ phản tác dụng, thay máy móc giữa câu tạo câu gượng.
3. **Tên "Minh" sót trong docs** — code runtime đã nameless ("Mày là một người
   trong nhóm chat"), nhưng openspec docs còn nhắc persona "Minh".

## Goals / Non-Goals

**Goals:**
- Lưu tên người hỏi vào memory để AI phân biệt người nói khi nhóm đông.
- Giảm trùng lặp giữa `<recent_chat>` (MTProto) và chat-memory.
- Nhớ lâu hơn, nhiều hơn (30→50 tin, 12h→24h).
- Bỏ hẳn regex postProcess, để persona prompt lo giọng điệu từ gốc.
- Dọn tên "Minh" khỏi openspec docs.

**Non-Goals:**
- Không thêm DB / lưu trữ bền (memory vẫn in-memory).
- Không đổi cấu trúc role của Anthropic API.
- Không đổi rate-limit, không đặt tên mới cho bot (giữ nameless).
- Không đụng `Asia/Ho_Chi_Minh` (múi giờ, không phải persona).

## Decisions

### D1: Lưu tên người vào *nội dung* tin, không đổi role API

Anthropic API chỉ nhận role `user`/`assistant`. Để AI biết ai nói mà không phá
cấu trúc message, prefix tên vào content của tin user: `"Nam: nội dung"`. Tin
`assistant` giữ nguyên (là bot).

- `chat-memory.ts`:
  - `StoredMessage` thêm field optional `name?: string`.
  - `addToMemory(chatId, role, content, name?)` — thêm tham số thứ 4 **optional**.
    Caller `/ask` (ask.ts:59-60) và `/search` (search.ts:55-56) gọi thiếu param
    vẫn chạy nguyên → không cần sửa 2 file đó.
  - `getRecentContext()`: khi map ra `ChatMessage[]`, tin role `user` có `name`
    thì trả `content = "${name}: ${content}"`. Tin không có `name` giữ nguyên.
- `handlers/chat.ts`: lấy tên người hỏi `senderName = ctx.from.first_name ||
  ctx.from.username || "ai đó"`, truyền vào `addToMemory(chatId, "user", text,
  senderName)`.

**Alternative cân nhắc:** truyền name riêng cho `chatWithAI` để prefix tin hiện
tại. Bỏ — tin hiện tại đã có trong context qua memory ở lượt sau; lượt hiện tại
AI vẫn đọc được tên qua `<recent_chat>`. Giữ thay đổi tối thiểu.

### D2: Lọc tin bot khỏi `<recent_chat>` để bớt trùng

Bot reply đã nằm trong chat-memory (role `assistant`). Nếu `<recent_chat>` cũng
chứa nó → lặp, nhiễu. Trong `chat.ts` handler khi format 50 tin MTProto, lọc bỏ
tin có `username === botUsername`.

**Lưu ý:** `telegram-client.ts` `extractMessage()` đã skip tin bot theo
`botUserId` (dòng 85). Thực tế recent_chat hiện có thể đã sạch tin bot. Khi code
sẽ kiểm tra lại — nếu đã sạch thì bước lọc này là phòng thủ (no-op), sẽ báo lại.

### D3: Tăng dung lượng & TTL memory

- `MAX_MEMORY_PER_CHAT`: 30 → 50
- `MEMORY_TTL_MS`: 12h → 24h

Token an toàn: cap 2000 ký tự/tin, model Haiku context 200k.

### D4: Bỏ regex postProcess, bù vào prompt

- Xóa hàm `postProcessResponse()` khỏi `services/chat.ts`.
- `handlers/chat.ts`: bỏ import + bỏ lời gọi, dùng thẳng `aiResponse` cho cả
  `editMessageText` và `addToMemory`.
- Bù vào `CHAT_SYSTEM_PROMPT`:
  - Mục "CẤM TUYỆT ĐỐI": thêm dòng liệt kê cụm cứng cần tránh ngay khi sinh
    (tuy nhiên→nhưng mà, vì vậy→nên là, ví dụ→kiểu, theo quan điểm của tôi→thấy
    là, v.v.).
  - Mục context: thêm dòng "Tin trong hội thoại có dạng `Tên: nội dung` — biết ai
    đang nói, gọi tên người ta khi hợp lý."

### D5: Dọn tên "Minh" khỏi docs

`openspec/specs/chat-persona-rewrite/spec.md` và các bản archive còn nhắc "Minh".
Đổi sang mô tả nameless ("persona trong nhóm chat"). **Không** đụng
`Asia/Ho_Chi_Minh` trong `fly.toml`, `.claude/CLAUDE.md`, `.claude/rules/CLAUDE.md`.

## Blast Radius

| Symbol | Caller | Ảnh hưởng |
|--------|--------|-----------|
| `addToMemory` | chat.ts, ask.ts, search.ts | Thêm param optional → 2 caller cũ an toàn |
| `getRecentContext` | chat.ts | Chỉ đổi nội dung tin user (prefix tên) |
| `chatWithAI` | chat.ts | Không đổi chữ ký |
| `postProcessResponse` | chat.ts (handler) | Xóa hẳn, bỏ 1 import + 1 lời gọi |

## Risks / Trade-offs

- **[Risk] Prefix tên làm AI tự bắt chước prefix khi trả lời** → Mitigation: tin
  `assistant` không prefix; prompt nói rõ format là của input, không phải output.
- **[Risk] Bỏ postProcess khiến giọng cứng hơn nếu prompt chưa đủ** → Mitigation:
  bổ sung danh sách cụm cấm vào prompt; persona prompt vốn đã chi tiết.
- **[Trade-off] TTL 24h giữ memory lâu hơn, tốn RAM hơn chút** → chấp nhận: cap 50
  tin × 500 chat, vẫn nhỏ.

## Verify

- `yarn build` pass (không lỗi TypeScript).
- Đọc lại `getRecentContext` cho ra `"Tên: nội dung"` cho tin user có name.
- `grep -i minh src/` không còn kết quả persona (chỉ còn `Ho_Chi_Minh` ngoài src).
- `postProcessResponse` không còn trong codebase.
