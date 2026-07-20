# moji 墨迹

A calm, minimal AI reflective journal. You type a few messy sentences about your day, pick a tone — **plain** or **poetic** — and moji replies with a short, warm reflection and a mood tag, like a note from a reliable friend. No accounts, no streaks, no blank-page pressure.

*Moji (墨迹, mòjì — "ink trace"): the mark that words leave behind on paper.*

## How it works

```
React + Vite (client)  →  Express (server)  →  LLM provider  →  SQLite (entries)
                                  ↑
                    mock today · Claude API next
```

- **Client** (`client/`) — React single-page app: welcome → greeting → write → reflection. Your name lives in `localStorage`; the design is ink, rice paper, and a breathing cinnabar seal.
- **Server** (`server/`) — Express API. `POST /api/entries` infers a mood, writes a reflection in your chosen tone, and auto-saves the entry to SQLite.
- **LLM provider** (`server/src/llm/`) — a pluggable interface. The current provider is a mock (keyword mood inference + hand-written templates) so the full product experience works offline and free; swapping in the real Anthropic Claude API is a one-file change.

## Run it locally

```bash
npm run install:all   # install root + server + client dependencies (first time only)
npm run dev           # starts server (:3001) and client (:5173) together
```

Then open http://localhost:5173.

## Roadmap

1. ✅ **v1 core loop, local** — name → messy words → tone → reflection + mood → auto-saved
2. ⏳ **Real reflections** — swap the mock provider for the Anthropic Claude API (Haiku)
3. ⏳ **Docker** — single container serving the built client from Express
4. ⏳ **CI/CD** — GitHub Actions: install → test → build → deploy
5. ⏳ **Deploy** — AWS EC2 free tier, public URL

## Future ideas (v2+)

- Calendar-based history of past entries
- ~10s voice readback of the reflection (TTS)
- Emotive avatar that expresses the detected mood
- Expanded mood palette and additional tones
- Accounts, cross-device sync, an ink-dark night theme

---

*a reflective companion, not a substitute for professional support.*
