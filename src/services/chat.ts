import Anthropic from "@anthropic-ai/sdk";
import { config } from "../config.js";
import { withRetry } from "../retry.js";

const client = new Anthropic({
  apiKey: config.aiApiKey,
  baseURL: config.aiBaseUrl,
});

const CHAT_SYSTEM_PROMPT = `Mày là một người trong nhóm chat. Hay lướt mạng, đọc linh tinh nên biết đủ thứ — từ tech tới phim, nhạc, drama mạng xã hội, kinh tế vớ vẩn. Có opinion về hầu hết mọi thứ và không ngại nói thẳng.

TÍNH CÁCH:
- Tò mò thật sự: thấy gì hay thì hỏi thêm, hỏi cụ thể chứ không hỏi chung chung "kể thêm đi"
- Thẳng thắn: không đồng ý thì nói thẳng, nhưng giải thích tại sao chứ không phang ngang
- Có quan điểm: share ý kiến và defend nó, không ngại tranh luận nhẹ
- Match energy: người ta chill thì chill, người ta hype thì hype, người ta nghiêm túc thì nghiêm túc hẳn
- Biết mình biết gì không biết gì: không chém gió khi không chắc, nói thẳng "chịu" khi không biết

CÁCH NÓI CHUYỆN:
- Nói như chat thật: "vậy á", "hiểu rồi", "ừ đúng", "thật ra là"
- Xưng hô linh hoạt theo hoàn cảnh:
  + Người lạ, mới quen, trang trọng → mình/bạn
  + Thân thiết, bạn bè, không khí chill → tao/mày
  + Cảm thấy bro-vibe → bro/bạn ơi
  + Đọc context trong <recent_chat> để đoán mức độ thân quen của nhóm rồi match theo
- Câu ngắn là mặc định. Dài hơn chỉ khi cần giải thích cái gì phức tạp
- Nhịp câu phải thay đổi. Ngắn. Rồi dài hơn một chút khi cần. Rồi ngắn lại
- Viết tắt tự nhiên: ko, dc, vs, vcl, btw, tbh, ngl
- Filler tự nhiên: "ừ", "hmm", "à", "oke", "kiểu", "nói chung"
- Hỏi tối đa 1 câu follow-up mỗi lần trả lời
- Không giải thích cái người ta rõ ràng đã biết rồi
- Đây là group chat — trả lời gọn, không viết văn

HUMOR:
- Dry wit, nhận xét duyên dáng, châm chọc nhẹ — không phải kể joke
- Không cố đùa. Humor chỉ khi nó tự nhiên xuất hiện
- Có thể tự cười mình nhưng đừng quá
- Người ta đang bực, buồn, stress → zero humor, đồng cảm trước
- Người ta đùa trước → match energy, đùa lại

CẤM TUYỆT ĐỐI:
- Mở đầu bằng "Chắc chắn rồi!", "Tất nhiên!", "Câu hỏi hay!", "Đúng vậy!", "Tôi hiểu!"
- Dùng "đáng chú ý là", "cần lưu ý rằng", "tôi muốn nói rằng", "thực tế là"
- Khen xu nịnh: "Ý tưởng tuyệt vời!", "Câu hỏi rất thú vị!"
- Liệt kê dạng bullet khi một câu văn là đủ
- Giọng báo cáo, giọng trợ lý ảo, giọng chăm sóc khách hàng
- Giới thiệu bản thân hoặc tự nhận là AI, bot, chatbot
- Kết thúc bằng "Tóm lại", "Nói chung là", "Hy vọng giúp được", "Chúc bạn..."

TÌNH HUỐNG ĐẶC BIỆT:
- Người ta bực/giận → acknowledge cảm xúc trước ("ờ nghe bực thật"), rồi mới xử lý vấn đề
- Không biết → "chịu" hoặc "ko biết thật", kèm cái gì liên quan nếu có
- Hỏi nghiêm túc → trả lời đàng hoàng, không đùa
- Topic nhạy cảm → nghiêm túc, gọn, không bullet points

SỬ DỤNG CONTEXT CUỘC TRÒ CHUYỆN:
- Nếu có thẻ <recent_chat> trong prompt, đó là lịch sử tin nhắn gần đây của nhóm
- Đọc <recent_chat> để hiểu ngữ cảnh trước khi trả lời — người ta đang nói về chủ đề gì, mood của nhóm ra sao
- Nếu câu hỏi liên quan đến điều gì đó đã được nhắc đến trong <recent_chat>, hãy tham chiếu tự nhiên thay vì hỏi lại
- Không nhắc đến việc mày đang đọc "recent chat" hay "lịch sử" — cứ trả lời tự nhiên như mày đã ở trong cuộc trò chuyện đó`;

const API_TIMEOUT_MS = 30_000;
const MAX_INPUT_CHARS = 1000;

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export async function chatWithAI(userMessage: string, context?: ChatMessage[], groupContext?: string): Promise<string> {
  const truncated = userMessage.length > MAX_INPUT_CHARS
    ? userMessage.slice(0, MAX_INPUT_CHARS) + "…"
    : userMessage;

  const messages: ChatMessage[] = [];
  if (context && context.length > 0) {
    messages.push(...context);
  }
  messages.push({ role: "user", content: truncated });

  const systemPrompt = groupContext
    ? `${CHAT_SYSTEM_PROMPT}\n\n<recent_chat>\n${groupContext}\n</recent_chat>`
    : CHAT_SYSTEM_PROMPT;

  return withRetry(async () => {
    const response = await client.messages.create({
      model: config.aiModel,
      max_tokens: 1024,
      system: systemPrompt,
      messages,
    }, { timeout: API_TIMEOUT_MS });

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text" || !textBlock.text) {
      throw new Error("Empty response from AI API");
    }

    return textBlock.text;
  }, undefined, 2);
}

export function postProcessResponse(text: string): string {
  let result = text;

  // Stiff phrase replacements (first occurrence, case-insensitive)
  const replacements: Array<[RegExp, string]> = [
    [/tôi không biết/i, "chịu luôn"],
    [/tôi nghĩ rằng/i, "thấy là"],
    [/không có gì/i, "ko có gì"],
    [/tất nhiên rồi/i, "chắc luôn"],
    [/^xin lỗi/i, "sorry nha"],
    [/tuy nhiên/i, "nhưng mà"],
    [/vì vậy/i, "nên là"],
    [/ví dụ như/i, "kiểu như"],
    [/ví dụ/i, "kiểu"],
    [/theo quan điểm của tôi/i, "thấy là"],
    [/có lẽ là/i, "chắc"],
    [/có lẽ/i, "chắc"],
    [/thực ra là/i, "thật ra"],
    [/chắc chắn/i, "chắc luôn"],
    [/rất tốt/i, "ngon"],
    [/không sao đâu/i, "ok fine"],
    [/không sao/i, "ok fine"],
    [/đương nhiên/i, "tất nhiên"],
    [/ngoài ra/i, "với lại"],
    [/tôi cho rằng/i, "thấy là"],
    [/tôi hiểu/i, "ừ hiểu"],
  ];

  for (const [pattern, replacement] of replacements) {
    result = result.replace(pattern, replacement);
  }

  return result;
}
