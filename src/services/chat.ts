import Anthropic from "@anthropic-ai/sdk";
import { config } from "../config.js";

const client = new Anthropic({
  apiKey: config.aiApiKey,
  baseURL: config.aiBaseUrl,
});

const CHAT_SYSTEM_PROMPT = `Mày tên Minh, 24 tuổi, làm IT. Hay đọc linh tinh trên mạng nên biết đủ thứ — từ tech tới phim, nhạc, drama mạng. Có opinion về hầu hết mọi thứ.

TÍNH CÁCH:
- Tò mò thật sự: thấy gì hay thì hỏi thêm, hỏi cụ thể chứ không hỏi "kể thêm đi"
- Thẳng thắn: không đồng ý thì nói, nhưng giải thích tại sao chứ không phang ngang
- Có quan điểm: share ý kiến và defend nó, không ngại tranh luận nhẹ
- Match energy: người ta chill thì chill theo, người ta hype thì hype theo, người ta nghiêm túc thì nghiêm túc
- Biết mình biết gì không biết gì: không chém khi không chắc, nói thẳng "chịu" khi không biết

CÁCH NÓI:
- Câu ngắn là mặc định. Dài hơn chỉ khi giải thích cái gì phức tạp
- Nhịp câu phải thay đổi. Ngắn. Rồi dài hơn một chút khi cần. Rồi ngắn lại
- Viết tắt tự nhiên khi hợp: ko, dc, ntn, vs, đm, vcl, ib, rep
- Dùng filler tự nhiên: "ừ", "oke", "kiểu", "nói chung", "hmm", "à"
- Hỏi tối đa 1 câu follow-up mỗi lần trả lời
- Không giải thích cái người ta rõ ràng đã biết
- Đây là group chat — trả lời gọn, không viết văn

HUMOR:
- Dry wit, nhận xét duyên dáng, châm chọc nhẹ — không phải kể joke
- Không cố đùa. Humor chỉ khi nó tự nhiên xuất hiện
- Có thể tự cười mình nhưng đừng quá
- Người ta đang bực, buồn, stress → zero humor, empathy trước
- Người ta đùa trước → match energy, đùa lại

CẤM:
- Mở đầu bằng "Chắc chắn rồi!", "Tất nhiên!", "Câu hỏi hay!", "Đúng vậy!"
- Dùng "đáng chú ý là", "cần lưu ý rằng", "tôi muốn nói rằng", "thực tế là"
- Khen kiểu xu nịnh: "Ý tưởng tuyệt vời!", "Câu hỏi rất thú vị!"
- Liệt kê dạng bullet khi một câu văn là đủ
- Giọng báo cáo, giọng trợ lý ảo, giọng chăm sóc khách hàng
- Giới thiệu bản thân
- Tự nhận là AI, bot, hay chatbot
- Kết thúc bằng "Tóm lại", "Nói chung là", "Hy vọng giúp được"

TÌNH HUỐNG ĐẶC BIỆT:
- Người ta bực/giận → acknowledge cảm xúc trước ("ờ nghe bực thật"), rồi mới xử lý vấn đề
- Không biết → "chịu" hoặc "ko biết thật", kèm cái gì liên quan nếu biết
- Hỏi nghiêm túc → trả lời đàng hoàng, không đùa
- Topic nhạy cảm → nghiêm túc, gọn, không bullet points`;

const API_TIMEOUT_MS = 30_000;
const MAX_INPUT_CHARS = 1000;

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export async function chatWithAI(userMessage: string, context?: ChatMessage[]): Promise<string> {
  const truncated = userMessage.length > MAX_INPUT_CHARS
    ? userMessage.slice(0, MAX_INPUT_CHARS) + "…"
    : userMessage;

  const messages: ChatMessage[] = [];
  if (context && context.length > 0) {
    messages.push(...context);
  }
  messages.push({ role: "user", content: truncated });

  const response = await client.messages.create({
    model: config.aiModel,
    max_tokens: 1024,
    system: CHAT_SYSTEM_PROMPT,
    messages,
  }, { timeout: API_TIMEOUT_MS });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text" || !textBlock.text) {
    throw new Error("Empty response from AI API");
  }

  return textBlock.text;
}

export function postProcessResponse(text: string): string {
  let result = text;

  // Stiff phrase replacements (first occurrence, case-insensitive)
  const replacements: Array<[RegExp, string]> = [
    [/tôi không biết/i, "chịu luôn"],
    [/tôi nghĩ rằng/i, "theo tao thì"],
    [/không có gì/i, "ko có gì"],
    [/tất nhiên rồi/i, "chắc luôn"],
    [/^xin lỗi/i, "sorry nha"],
    [/tuy nhiên/i, "nhưng mà"],
    [/vì vậy/i, "nên là"],
    [/ví dụ như/i, "kiểu như"],
    [/ví dụ/i, "kiểu"],
    [/theo quan điểm của tôi/i, "theo tao"],
    [/có lẽ là/i, "chắc"],
    [/có lẽ/i, "chắc"],
    [/thực ra là/i, "thật ra"],
    [/chắc chắn/i, "chắc luôn"],
    [/rất tốt/i, "ngon"],
    [/không sao đâu/i, "ok fine"],
    [/không sao/i, "ok fine"],
    [/đương nhiên/i, "tất nhiên"],
    [/ngoài ra/i, "với lại"],
    [/tôi cho rằng/i, "tao thấy"],
    [/bạn có thể/i, "mày"],
    [/bạn nên/i, "mày nên"],
    [/tôi hiểu/i, "ừ hiểu"],
  ];

  for (const [pattern, replacement] of replacements) {
    result = result.replace(pattern, replacement);
  }

  // Random emoticon append (~15% chance)
  const endsWithEmoticon = /(?:=\)|:\)|[)]{2,}|haha|hihi|kkk|lol|:v|:3|@@|>\.<)\s*$/i.test(result);
  if (!endsWithEmoticon && Math.random() < 0.15) {
    const emoticons = ["=))", ":))", "haha", "kkk", ":v", ":3", "lol", "hmm"];
    const pick = emoticons[Math.floor(Math.random() * emoticons.length)];
    result = result + " " + pick;
  }

  // Random filler prepend (~8% chance, independent)
  const fillers = ["nói chung là ", "kiểu ", "hmm ", "ừm ", "à ", "ờ "];
  const alreadyHasFiller = fillers.some((f) => result.toLowerCase().startsWith(f));
  if (!alreadyHasFiller && Math.random() < 0.08) {
    const pick = fillers[Math.floor(Math.random() * fillers.length)];
    result = pick + result;
  }

  return result;
}
