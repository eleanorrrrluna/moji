// LLM provider 的统一入口（provider 模式）。
// 通过环境变量 MOJI_LLM 切换：'mock'（默认，不花钱）或 'claude'（真 API）。
// 路由、数据库、前端调用点都不用改。
import { reflect as mockReflect } from './mock.js';
import { reflect as claudeReflect } from './claude.js';

const PROVIDER = process.env.MOJI_LLM || 'mock';

export const llmProvider = PROVIDER;

export async function reflect({ entry, tone, name }) {
  if (PROVIDER === 'mock') return mockReflect({ entry, tone, name });
  if (PROVIDER === 'claude') return claudeReflect({ entry, tone, name });
  throw new Error(`unknown LLM provider: ${PROVIDER}`);
}
