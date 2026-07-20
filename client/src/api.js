// 前端唯一需要跟后端说话的地方
export async function createEntry({ entry, tone, name }) {
  const res = await fetch('/api/entries', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ entry, tone, name }),
  });
  if (!res.ok) throw new Error(`request failed: ${res.status}`);
  return res.json();
}
