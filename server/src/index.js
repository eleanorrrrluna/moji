import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { reflect, llmProvider } from './llm/index.js';
import { saveEntry, countEntries } from './db.js';

const app = express();
app.use(express.json());

// 健康检查：确认服务活着、在用哪个 LLM provider、已存了几条日记
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, llm: llmProvider, entries: countEntries() });
});

// 核心接口：收到日记 → 推断心情 + 生成回信 → 自动保存 → 返回给前端
app.post('/api/entries', async (req, res) => {
  try {
    const { entry, tone, name } = req.body ?? {};
    if (typeof entry !== 'string' || entry.trim() === '') {
      return res.status(400).json({ error: 'entry is required' });
    }
    const safeTone = tone === 'poetic' ? 'poetic' : 'plain';
    const result = await reflect({ entry: entry.trim(), tone: safeTone, name });
    const id = saveEntry({
      name: name || null,
      entry: entry.trim(),
      tone: safeTone,
      mood: result.mood.key,
      reflection: result.reflection,
    });
    res.json({ id, reflection: result.reflection, mood: result.mood });
  } catch (err) {
    console.error('reflection failed:', err);
    res.status(500).json({ error: 'reflection failed' });
  }
});

// 生产环境（Docker/AWS 阶段）：由同一个服务直接托管打包好的前端页面
const __dirname = path.dirname(fileURLToPath(import.meta.url));
app.use(express.static(path.join(__dirname, '..', '..', 'client', 'dist')));

// 用专属变量名 MOJI_SERVER_PORT：通用的 PORT 容易被开发工具（预览面板等）注入的值覆盖，
// 会把后端挤到和前端同一个端口上打架（部署阶段如需用 PORT 再调整）
const PORT = process.env.MOJI_SERVER_PORT || 3611; // 3001 太热门，容易被别的 dev server 撞
app.listen(PORT, () => {
  console.log(`moji server (llm: ${llmProvider}) → http://localhost:${PORT}`);
});
