import { useState } from 'react';
import { createEntry } from '../api.js';

export default function Home({ name, onReflection }) {
  const [entry, setEntry] = useState('');
  const [tone, setTone] = useState('plain');
  const [status, setStatus] = useState('idle'); // idle | sending | error

  async function submit() {
    if (!entry.trim() || status === 'sending') return;
    setStatus('sending');
    try {
      const result = await createEntry({ entry, tone, name });
      // 把日记原文和名字一并带去回信屏——「下载信件」需要信的两面
      onReflection({ ...result, entry: entry.trim(), name });
    } catch {
      setStatus('error');
    }
  }

  const displayName = name.charAt(0).toUpperCase() + name.slice(1);

  return (
    <div className="screen">
      <h1 className="greeting">Welcome home, {displayName}.</h1>
      <p className="subgreeting">How are you? A few messy words are enough.</p>

      <textarea
        className="entry-input"
        value={entry}
        onChange={(e) => setEntry(e.target.value)}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') submit();
        }}
        placeholder="Anything. Everything. One word is fine."
        autoFocus
      />

      <div className="actions">
        <div className="tones" role="radiogroup" aria-label="tone">
          <button
            type="button"
            className={tone === 'plain' ? 'tone selected' : 'tone'}
            onClick={() => setTone('plain')}
          >
            Plain
          </button>
          <span className="dot">·</span>
          <button
            type="button"
            className={tone === 'poetic' ? 'tone selected' : 'tone'}
            onClick={() => setTone('poetic')}
          >
            Poetic
          </button>
        </div>
        <button className="primary" onClick={submit} disabled={!entry.trim() || status === 'sending'}>
          {status === 'sending' ? 'the moon is reading…' : 'Reflect'}
        </button>
      </div>

      {status === 'error' && <p className="error">the network's under the weather — the moon's on the way to check on it.</p>}
    </div>
  );
}
