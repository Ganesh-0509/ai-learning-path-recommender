# Deployment Guide (Render)

`render.yaml` (repo root) is a Render Blueprint defining both services this app needs — see
`docs/TRD.md` §7 for why it's two services, not one. This doc is the human steps around it: things
only an account holder can do (create the account, authorize the spend, click deploy).

## What gets created

| Service | Type | Plan | Why |
|---|---|---|---|
| `learning-path-web` | Web service (Node) | Starter | Runs the Next.js app; Starter is the cheapest plan with a persistent disk (needed for the SQLite file). |
| `learning-path-llm` | Private service (Docker) | Standard | Runs Ollama + `llama3.2:3b`. Needs Standard (not Starter) for enough RAM — see `PLAN.md` §8's note on why the free/Starter tier isn't enough for a 3B model. |

Both plans cost money on a monthly basis (billed while the services exist, not per-request). This
is real spend — the reason this step needed sign-off rather than being run automatically.

## Steps

1. **Create a Render account** (or sign in) at [render.com](https://render.com) — this has to be
   done by a human; an AI agent can't create accounts.
2. **New → Blueprint**, connect the `Ganesh-0509/ai-learning-path-recommender` GitHub repo. Render
   reads `render.yaml` from the repo root and shows both services it will create — review the
   plans/cost shown before confirming.
3. Render provisions both services and links them via the internal-network env var
   (`LLM_HOST`) that `render.yaml` sets up. First deploy will take longer than usual: the Ollama
   service pulls the ~2GB model on first boot before it can serve anything.
4. **Verify `LLM_HOST` actually resolved.** Render Blueprint's `fromService` linking syntax is the
   part of `render.yaml` most likely to need a manual tweak on a first deploy — if the web
   service's logs show it can't reach Ollama, check the `learning-path-llm` service's dashboard
   page for its actual internal address and set `LLM_HOST` on `learning-path-web` directly if
   the automatic linking didn't resolve as expected.
5. Once both services show "Live," open the web service's URL and run through the demo flow
   (chat → dashboard → explain → mark complete) to confirm it works end to end before recording
   the demo video or submitting.
6. **Add the URL** to `README.md`'s "Deployment" section and to the submission form.

## If the Ollama service's cost/RAM requirement is a blocker

Options, in order of how much they preserve the "local model" architecture:

1. **Pull a smaller model** instead of `llama3.2:3b` — e.g. `qwen2.5:0.5b` (much smaller, weaker
   reasoning/explanation quality) or `qwen2.5:1.5b`. Update `render.yaml`'s `dockerCommand` and
   `.env`'s `LLM_MODEL` to match, and re-verify the explainability/prompt-injection Playwright
   specs still pass against the smaller model before relying on it.
2. **Run Ollama on a different always-on machine you control** (a home server, a cheap VPS) and
   point `LLM_HOST` at it — still self-hosted/local-model, just not colocated with the web
   service. Requires that machine to be reachable from Render, which usually means exposing it
   through a tunnel (e.g. Cloudflare Tunnel, Tailscale) rather than a raw public port.
3. Deploy only the web service and demo the LLM-dependent features against a local `ollama serve`
   during the recorded demo/live walkthrough, with the deployed URL serving the non-LLM parts
   (dashboard structure, static content) — a fallback, not the intended architecture, and worth
   noting explicitly in the solution documentation if used.

## Local setup remains fully unaffected

None of the above changes local development — `README.md`'s existing "Local setup" section
(`npm run dev` + a locally running `ollama serve`) works regardless of what's decided here.
