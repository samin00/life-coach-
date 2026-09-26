# Audit

A brutalist AI life-coach app. Feed it your YouTube / Instagram data export (or describe your habits), and it maps your interests, asks you one uncomfortable question, helps you pick a goal, and builds a daily / weekly / monthly plan around it.

Single-page React 18 + Vite 5 app. No backend, no storage — everything lives in memory and resets on reload.

## Run

```bash
npm install
cp .env.example .env   # then paste your key into VITE_ANTHROPIC_API_KEY
npm run dev
```

Without a key, every AI step (analysis, goal suggestions, plan) uses built-in fallback content, so the full flow still works end to end.

## Security

`VITE_ANTHROPIC_API_KEY` is compiled into the client-side JavaScript. Anyone who opens the app can read it from the bundle or the network tab and spend on your account. This is fine for local use only. For anything deployed, put a small server proxy in front of the Anthropic API that holds the key and forward requests to it instead.
