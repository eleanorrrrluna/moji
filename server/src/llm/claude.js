// —— 真·Claude provider ——
// 用 Anthropic Claude API（Haiku，PRD 第 7/8 节指定：快、便宜、够用）
// 推断心情 + 生成回信。输入输出格式与 mock 完全一致，方便无缝替换：
//   输入 { entry, tone, name } → 输出 { reflection, mood: { key, emoji, label } }
//
// 🔒 key 从不写死在这里：运行时由 SDK 自动从环境变量 ANTHROPIC_API_KEY 读取。
import Anthropic from '@anthropic-ai/sdk';
import { MOODS } from '../moods.js';

const MODEL = 'claude-haiku-4-5'; // PRD 指定 Haiku 级
const MOOD_KEYS = Object.keys(MOODS); // ['at_peace','thrilled','warm','meh','overloaded','sad','frustrated','drained']
const CJK_RE = /[㐀-䶿一-鿿]/;

// 懒加载：只有真的用到 claude 时才创建客户端。
// 这样即使跑 mock（没有 key），import 这个文件也不会因为缺 key 报错。
let _client = null;
function client() {
  return (_client ??= new Anthropic()); // 自动读 process.env.ANTHROPIC_API_KEY
}

function detectLang(entry) {
  return CJK_RE.test(entry) ? 'zh' : 'en';
}

// 系统提示：把 PRD 第 7 节的"两步 + 声音基调 + 短输入兜底"讲给模型听
function buildSystem(tone, lang) {
  const language = lang === 'zh' ? 'Chinese (中文)' : 'English';
  const toneDesc =
    tone === 'poetic'
      ? 'poetic and understated, with gentle ink-and-paper imagery'
      : 'plain, warm, and conversational';
  return [
    'You are the quiet, reflective voice of Moji, a calm journaling app.',
    'A user has written a short, possibly messy journal entry about their day. Do two things:',
    `1. Infer their mood. Choose EXACTLY ONE mood key from: ${MOOD_KEYS.join(', ')}.`,
    '   If the entry is too short or ambiguous to read their mood with confidence, choose "meh" rather than guessing.',
    '2. Write a SHORT reflection (2–4 sentences) in the voice of a warm, encouraging mentor or reliable friend:',
    '   first gently acknowledge the feeling, then offer a little comfort or perspective. Calm and mindful, never preachy or clinical.',
    `Write the reflection in ${language}. Style: ${toneDesc}.`,
    'Do NOT give advice lists, diagnoses, or clinical language. Keep it human and brief.',
  ].join('\n');
}

export async function reflect({ entry, tone, name }) {
  const lang = detectLang(entry);
  const userContent = `${name ? `The user's name is ${name}. ` : ''}Their journal entry:\n\n${entry}`;

  const response = await client().messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: buildSystem(tone, lang),
    messages: [{ role: 'user', content: userContent }],
    // 结构化输出：强制模型返回 { mood_key, reflection }，前端才能可靠地渲染心情标签（PRD 第 7 节）
    output_config: {
      format: {
        type: 'json_schema',
        schema: {
          type: 'object',
          properties: {
            mood_key: { type: 'string', enum: MOOD_KEYS },
            reflection: { type: 'string' },
          },
          required: ['mood_key', 'reflection'],
          additionalProperties: false,
        },
      },
    },
  });

  const text = response.content.find((b) => b.type === 'text')?.text;
  if (!text) throw new Error('claude: empty response');
  const data = JSON.parse(text);

  // 兜底：万一模型给了不在库里的 key，退回 meh（读不出情绪时宁可坦白，不瞎猜）
  const key = MOODS[data.mood_key] ? data.mood_key : 'meh';
  const m = MOODS[key];
  return {
    reflection: String(data.reflection).trim(),
    mood: { key, emoji: m.emoji, label: lang === 'zh' ? m.zh : m.label },
  };
}
