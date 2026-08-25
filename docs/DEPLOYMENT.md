# Deployment

**Decision (2026-08-25): no paid hosting.** Every option that can run the LLM continuously —
Render, Hugging Face Spaces (Docker), Fly.io, Railway — requires a paid tier; that's not a
workaround-able limitation, it's how those platforms price persistent compute. Given a hard
zero-budget constraint, this project uses two genuinely free access paths together, so there's
always a working way in regardless of whether a live URL happens to be up at the moment someone
checks:

1. **Local setup** (always available) — `README.md`'s "Local setup" section, which the
   submission guidelines explicitly accept in place of a deployed URL: *"If not deployed, provide
   clear instructions for local setup and execution."*
2. **On-demand public URL via Cloudflare Tunnel** (when the machine is running) — free, no
   account, no card, gives a real `https://` URL in seconds. Use this for the demo video and for
   any window where live access matters; fall back to #1 the rest of the time.

## Using the tunnel

```bash
# Terminal 1 — the app (dev or production build, either works)
npm run dev
# or: npm run build && npm run start

# Terminal 2 — the tunnel
npm run tunnel
```

`npm run tunnel` prints a URL like `https://some-words-here.trycloudflare.com` — that's live and
publicly reachable for as long as both terminals stay open. It's a fresh random URL each time
it's started (no account = no stable custom domain), so share whichever one is current, not one
from a previous run.

**Requires `cloudflared` installed once** (already done on this machine via
`winget install --id Cloudflare.cloudflared -e`) — on a machine without it, install it from
[Cloudflare's docs](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/)
first. Verified end-to-end on 2026-08-25: app running locally, tunnel started, public URL reached
`/`, and a real API request (`POST /api/profile`) round-tripped through the tunnel correctly.

## What was evaluated and ruled out, and why

| Option | Verdict | Why |
|---|---|---|
| Render (2-service Blueprint, `render.yaml`) | Prepared, not used | Needs a paid Standard-tier private service for Ollama's RAM (`llama3.2:3b` needs ~4-6GB; Render's free tier caps at 512MB). |
| Hugging Face Spaces (Docker, `Dockerfile`) | Prepared, built, run, and verified locally — not deployed | HF's free tier only allows Static Spaces; any Docker/Gradio (compute) Space requires a PRO plan ($9/mo), confirmed from HF's own docs. |
| Oracle Cloud "Always Free" (24GB RAM, genuinely free forever) | Considered, declined | Would actually fit the workload for $0 ongoing, but requires a credit card at signup for identity verification — declined given the zero-payment constraint, even though the free-tier resources themselves aren't charged. |

## What's still here and verified working, for later

- **`Dockerfile` + `docker-entrypoint.sh` + `.dockerignore`** — a single container running both
  Ollama and the Next.js app, built with `docker build .` and run with `docker run` on this
  machine: model pull, Prisma migration, catalog seeding, and `npm run start` all completed
  successfully, and a smoke request (`POST /api/profile`) returned a correct response. If a free,
  always-on, sufficient-RAM host becomes available later, this image is ready to push to it.
- **`render.yaml`** — the two-service Blueprint, ready if a paid Render deploy is ever wanted.
