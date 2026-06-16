# Design: Fix rude chat persona — bỏ xưng tao/mày, mềm giọng

**Ngày:** 2026-06-16
**Phạm vi:** `src/services/chat.ts` (chỉ `CHAT_SYSTEM_PROMPT`)

## Context

Khi @mention/reply, bot trả lời "láo" — xưng "tao/mày" với người dùng. Root cause
nằm ngay trong `CHAT_SYSTEM_PROMPT` (chat.ts dòng 21-25): prompt **chủ động cho
phép** xưng tao/mày khi nhóm "chill", và dạy bot "match energy". Bot đọc
`<recent_chat>`, thấy nhóm thoải mái → tự xưng tao/mày. Đây là lỗi thiết kế
persona, không phải hệ quả của lần sửa chat memory trước.

Đã loại giả thuyết khác: `senderName` truyền vào chỉ là tiền tố `"Tên:"` ở input,
dòng 62 đã cấm bot tự thêm tiền tố — không gây ra xưng hô sai.

## Goals / Non-Goals

**Goals:**
- Bot mặc định xưng "mình", gọi người dùng "bạn" (hoặc gọi tên); nới nhẹ sang
  "bạn ơi", "cậu/tớ" khi nhóm rất chill. TUYỆT ĐỐI không tao/mày.
- Mềm giọng tổng thể: giảm châm chọc/phang, bỏ slang nặng/tục.

**Non-Goals:**
- Không thêm config chọn persona / mức độ thân mật.
- Không đụng logic `chat.ts` hay `handlers/chat.ts`.
- Không đổi cấu trúc prompt ngoài các điểm nêu dưới.

## Decision

Sửa 5 điểm trong `CHAT_SYSTEM_PROMPT`:

1. **Dòng 21-25 (xưng hô):** thay bảng "Xưng hô linh hoạt" (có nhánh tao/mày,
   bro) bằng:
   ```
   - Xưng hô: mặc định xưng "mình", gọi người dùng là "bạn" (hoặc gọi tên nếu biết). Khi nhóm rất chill có thể nới nhẹ sang "bạn ơi", "cậu/tớ". TUYỆT ĐỐI KHÔNG xưng "tao/mày".
   ```

2. **Dòng 10 (câu mở):** bỏ "không ngại nói thẳng" gắt, giữ cá tính nhưng thân
   thiện hơn.

3. **Dòng 14-15 (TÍNH CÁCH):** mềm "Thẳng thắn: không đồng ý thì nói thẳng..." và
   "Có quan điểm... không ngại tranh luận nhẹ" thành bản lịch sự, nhẹ nhàng.

4. **Dòng 28 (viết tắt):** bỏ `vcl` khỏi danh sách; giữ viết tắt vô hại (ko, dc,
   vs, btw, tbh, ngl).

5. **CẤM TUYỆT ĐỐI (sau dòng 49):** thêm 1 dòng cấm xưng tao/mày và cấm chửi
   tục/xúc phạm người dùng.

**Giữ nguyên:** mục HUMOR, TÌNH HUỐNG ĐẶC BIỆT, SỬ DỤNG CONTEXT (gồm dòng nhận
diện `"Tên:"` dòng 62), dòng cấm cụm trang trọng (dòng 49).

## Risks / Trade-offs

- **[Risk] Mềm giọng quá → mất cá tính, thành "trợ lý ảo".** Mitigation: chỉ
  giảm phần gây khó chịu (tao/mày, chửi tục, phang gắt), GIỮ tò mò, dry wit,
  câu ngắn tự nhiên, slang vô hại. Mục CẤM (giọng báo cáo/trợ lý ảo) vẫn còn.
- **[Regression] Rất thấp** — chỉ đổi text trong một string literal, không đổi
  code path. Build pass vì chỉ là string.

## Verify

- `yarn build` pass.
- `grep -n "tao/mày" src/services/chat.ts` → chỉ còn trong dòng CẤM (ngữ cảnh
  cấm), không còn trong nhánh "cho phép".
- `grep -n "vcl" src/services/chat.ts` → rỗng.
- Đọc lại prompt: mục xưng hô mặc định mình/bạn; có dòng cấm tao/mày + chửi tục.
