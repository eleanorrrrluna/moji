// LLM provider 的统一入口（provider 模式）。
// 现在只有 mock；接入真 Claude API 时新增 claude.js，在这里多加一个分支即可，
// 其余代码（路由、数据库、前端）一行都不用改。
import { reflect as mockReflect } from './mock.js';

const PROVIDER = process.env.MOJI_LLM || 'mock';

export const llmProvider = PROVIDER;

export async function reflect({ entry, tone, name }) {
  if (PROVIDER === 'mock') return mockReflect({ entry, tone, name });
  throw new Error(`unknown LLM provider: ${PROVIDER}`);
}
