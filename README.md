# MOJI

**Live at [mojimoonee.com](https://mojimoonee.com)** — a calm, minimal AI reflective journal.

You type a few messy sentences about your day, pick a tone — **plain** or **poetic** — and MOJI replies with a short, warm reflection and a mood tag, like a note from a reliable friend. No accounts, no streaks, no blank-page pressure.

*Message goes up to the moon. The moon reads. A water letter floats back.*

## How it works

```
React + Vite (client)  →  Express (server)  →  Anthropic Claude (Haiku)  →  SQLite (entries)
```

- **Client** (`client/`) — React single-page app: welcome → greeting → write → reflection → rest. Your name lives in `localStorage`; the design is a moonlit sea — a suspended moon, moonlight falling as rain, a water letter drifting back.
- **Server** (`server/`) — Express API. `POST /api/entries` infers a mood, writes a reflection in your chosen tone, and auto-saves the entry to SQLite.
- **LLM provider** (`server/src/llm/`) — a pluggable interface. The default provider is Anthropic Claude (Haiku); a mock provider is kept as an offline fallback (keyword mood inference + hand-written templates).

## Run it locally

```bash
npm run install:all   # install root + server + client dependencies (first time only)
npm run dev           # starts server (:3611) and client (:5173) together
```

Then open http://localhost:5173.

## Roadmap

1. ✅ **v1 core loop, local** — name → messy words → tone → reflection + mood → auto-saved
2. ✅ **Real reflections** — Anthropic Claude API (Haiku) as the default provider
3. ✅ **Docker** — single container serving the built client from Express
4. ✅ **CI** — GitHub Actions verifies the Docker image builds on every push
5. ✅ **Deploy** — AWS EC2 (Sydney) with Docker
6. ✅ **Domain + HTTPS** — Cloudflare DNS + Caddy reverse proxy + Let's Encrypt auto-renewal

## Future ideas (v2+)

- Continue-writing screen (a real "write a bit more" that keeps context)
- Calendar-based history of past entries
- ~10s voice readback of the reflection (TTS)
- Emotive avatar that expresses the detected mood
- Expanded mood palette and additional tones
- Accounts, cross-device sync, night theme

---

*a reflective companion, not a substitute for professional support.*
