# Audit

A brutalist AI life-coach app. Feed it your YouTube / Instagram data export (or describe your habits), and it maps your interests, asks you one uncomfortable question, helps you pick a goal, and builds a daily / weekly / monthly plan around it.

Single-page React 18 + Vite 5 app. No backend, no storage — everything lives in memory and resets on reload.

## Run

```bash
npm install
cp .env.example .env   # then paste your key (see below)
npm run dev
```

Without a key, every AI step (analysis, goal suggestions, plan) uses built-in fallback content, so the full flow still works end to end.

## Choosing the AI provider

Set these in `.env`:

| Variable | Purpose |
| --- | --- |
| `VITE_AI_PROVIDER` | `anthropic` (default) or `openai` |
| `VITE_ANTHROPIC_API_KEY` | Key used when the provider is `anthropic` |
| `VITE_OPENAI_API_KEY` | Key used when the provider is `openai` |
| `VITE_OPENAI_MODEL` | Optional OpenAI model, default `gpt-4o-mini` |

If the selected provider has no key, the app uses the built-in fallback content.

## Security

`VITE_ANTHROPIC_API_KEY` (and likewise `VITE_OPENAI_API_KEY`) is compiled into the client-side JavaScript. Anyone who opens the app can read it from the bundle or the network tab and spend on your account. This is fine for local use only. For anything deployed, put a small server proxy in front of the Anthropic or OpenAI API that holds the key and forward requests to it instead.
