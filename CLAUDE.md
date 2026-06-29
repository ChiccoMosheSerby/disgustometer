# Project notes for Claude Code

**מד הגועל / Disgustometer** — a voice-or-typed "disgust meter". The user names
random ingredients; Claude rates how disgusting the combo is (0–100) and the UI
shows an animated gauge. The whole UI is in Hebrew (RTL).

## Architecture
- `client/` — Vite + React app (port 5173). All UI lives in `src/App.jsx`.
  Voice uses the browser Web Speech API (`webkitSpeechRecognition`, lang `he-IL`).
  Calls `POST /api/rate` with `{ text }`.
- `server/` — Express (port 3001). Holds the Anthropic API key in `.env` and
  proxies to the Anthropic SDK in `index.js`. Endpoint `/api/rate` returns
  `{ score, verdict, ingredients }`.
- Vite dev proxy (`client/vite.config.js`) forwards `/api/*` → `:3001`.

## Hard rules
- **Never put the Anthropic API key in client code.** It stays server-side in `.env`.
- The server parses Claude's reply as JSON; keep the prompt asking for raw JSON only.
- Model is set via `CLAUDE_MODEL` env (default `claude-sonnet-4-6`).

## Run
```bash
npm run install:all      # installs root, server, client
# add server/.env from server/.env.example
npm run dev              # runs both
```

## Likely next tasks the user may ask for
- Persist a history of verdicts → add MongoDB (`mongoose`) in the server, save on /api/rate.
- A "share my score" feature, a session leaderboard, or sound effects.
- Deploy: build client (`npm run build`) and serve `client/dist` from Express.
