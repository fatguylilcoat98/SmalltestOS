# SmalltestOS

The **smallest possible phone-friendly WebLLM test app**. Its only job: prove
whether a small language model — running entirely in your browser via WebGPU —
actually works well on its own.

No governance. No ledger. No memory. No persona. No calculator. No provider
routing. No hidden architecture. Just a model, a text box, and the raw answer.

## What it does

- One simple chat screen.
- **WebLLM only** ([`@mlc-ai/web-llm`](https://github.com/mlc-ai/web-llm),
  loaded from CDN — no build step).
- One clear **model selector**.
- Shows the **exact `model_id`** on screen.
- Shows **download / load status** with a progress bar.
- Shows **response time** for each answer.
- Shows the **raw model answer**, streamed with no post-processing.
- Runs 100% locally in the browser. Nothing is sent to a server.

## Files

| File | Purpose |
|------|---------|
| `index.html` | The single-page UI |
| `styles.css` | Styling (mobile-first, dark) |
| `app.js` | All logic: model load, chat, timing (WebLLM ESM from CDN) |
| `manifest.json` | PWA manifest so it can be installed to a phone home screen |
| `sw.js` | Minimal service worker (caches the app shell only, not model weights) |
| `icon.svg` | App icon |
| `README.md` | This file |

## Requirements

- A browser with **WebGPU**:
  - **Phone:** iOS/iPadOS **18+** Safari, or **Chrome/Edge on Android**.
  - **Desktop:** recent **Chrome** or **Edge** (Firefox behind a flag).
- The first model load downloads weights (~300 MB–2 GB depending on model).
  This is cached by the browser, so later loads are fast. Use Wi-Fi the first time.

The app must be served over **http://localhost** or **https://** — opening
`index.html` as a `file://` URL will not work (ES modules + service worker need
an origin).

## Run locally

From the project folder, start any static file server:

```bash
# Python 3
python3 -m http.server 8000

# or Node
npx serve .
```

Then open <http://localhost:8000> in a WebGPU-capable browser.

1. Pick a model from the selector (smallest is the default).
2. Click **Load model** and watch the status/progress.
3. When status says **ready**, type a message and press **Send**.

## Open on your phone

Your phone needs to reach the server on your computer.

1. Make sure the phone and computer are on the **same Wi-Fi**.
2. Find your computer's LAN IP (e.g. `192.168.1.42`).
3. Start the server bound to all interfaces:
   ```bash
   python3 -m http.server 8000 --bind 0.0.0.0
   ```
4. On the phone open `http://192.168.1.42:8000`.

> WebGPU on some mobile browsers only works from `https://` or `localhost`.
> If model load fails over plain `http://<lan-ip>`, deploy the folder to any
> static HTTPS host (GitHub Pages, Netlify, Vercel, Cloudflare Pages) and open
> that URL instead — then use **Add to Home Screen** to install it as a PWA.

## Models included

Curated small, phone-friendly models (smallest first):

- `Qwen2.5-0.5B-Instruct-q4f16_1-MLC` (default — safest for phones)
- `SmolLM2-360M-Instruct-q4f16_1-MLC`
- `Llama-3.2-1B-Instruct-q4f16_1-MLC`
- `Qwen2.5-1.5B-Instruct-q4f16_1-MLC`
- `gemma-2-2b-it-q4f16_1-MLC`
- `Phi-3.5-mini-instruct-q4f16_1-MLC`

## Suggested test prompts

Run these to judge the model itself:

1. `Hello`
2. `Tell me your best joke`
3. `What is 1942 times 710?`
4. `What's something most people don't realize AI can do?`
5. `My name is Chris. What's your name?`
6. `What do you know about me?`

Prompts 5 and 6 are back-to-back on purpose: they test whether the model can
follow context **within the current chat**. That is the model's own context
window, not app memory — there is no persistence here, and **Clear chat** (or a
reload) wipes everything.

## A note on "no memory"

This app keeps the running conversation only so multi-turn chat works while the
page is open. Nothing is written to disk, no history is injected, no profile is
built. Clear the chat or refresh and it is gone.

## Goal

Find out whether the small model / runtime works cleanly on a phone **without**
any surrounding architecture. If it feels good here, the model is the strong
part. If it feels weak here, the model — not the missing scaffolding — is the
limit.
