# AI-Powered Personalized Learning Path Recommender

A conversational assistant that turns a learner's stated goal into a structured, explained,
adaptive learning roadmap — built for the HCL/GUVI "AI-Powered Personalized Learning Path
Recommender" team challenge.

All AI/ML inference (intent parsing, explanations, embeddings) runs on a **locally-hosted
open-source model** — no third-party AI API is called anywhere in this product. See
[`docs/SECURITY.md`](docs/SECURITY.md) for why.

**Project status:** feature-complete for submission — see
[`docs/SUBMISSION_READINESS.md`](docs/SUBMISSION_READINESS.md) for the full requirements
checklist and [`PLAN.md`](PLAN.md) for the day-by-day build history.

## Documentation

- [`PLAN.md`](PLAN.md) — day-by-day build log: architecture decisions, tech stack, what broke and
  why, in the order it actually happened
- [`docs/PRD.md`](docs/PRD.md) — product requirements
- [`docs/SRS.md`](docs/SRS.md) — functional/non-functional requirements
- [`docs/TRD.md`](docs/TRD.md) — technical architecture, data model, API surface
- [`docs/SECURITY.md`](docs/SECURITY.md) — threat model and mitigations
- [`docs/TEST_PLAN.md`](docs/TEST_PLAN.md) — testing and stress-testing strategy
- [`docs/CODING_STANDARDS.md`](docs/CODING_STANDARDS.md) — style and review checklist
- [`docs/SOLUTION_DOCUMENTATION.md`](docs/SOLUTION_DOCUMENTATION.md) — problem understanding,
  solution approach, architecture, AI/ML techniques, features, challenges faced (submission
  deliverable #3)
- [`docs/SUBMISSION_READINESS.md`](docs/SUBMISSION_READINESS.md) — requirements gap-check against
  the brief and a self-assessed score estimate per judging criterion
- [`docs/TECHNICAL_REPORT.md`](docs/TECHNICAL_REPORT.md) — full engineering deep-dive: system
  architecture, every algorithm and formula actually used, AI/ML component analysis, measured
  performance data, and the full security threat model
- [`docs/DEMO_VIDEO_SCRIPT.md`](docs/DEMO_VIDEO_SCRIPT.md) — storyboard for the required demo
  video (submission deliverable #4)
- [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) — Render deployment steps, cost expectations,
  fallback options if the LLM service's RAM requirement is a blocker

## Prerequisites

- Node.js 20+ and npm
- [Ollama](https://ollama.com) installed and running locally, with a model pulled:
  ```bash
  ollama pull llama3.2:3b
  ollama serve
  ```
- No other accounts, API keys, or external services are required.

## Local setup

```bash
# 1. Install dependencies
npm install

# 2. Configure environment (defaults are already correct for local dev)
cp .env.example .env

# 3. Set up the database
npx prisma generate
npx prisma migrate dev

# 4. Seed the course/project/assessment catalog (from the committed
#    data/courses.seed.json — no LLM call needed for this step)
npm run seed

# 5. Run the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Testing

Playwright is the project's sole verification tool — see `docs/TEST_PLAN.md`.

```bash
# Install browsers once
npx playwright install --with-deps chromium

# Functional end-to-end tests
npm run test:e2e

# Stress/concurrency tests
npm run test:stress

# Both
npm test
```

## Code quality

```bash
npm run lint          # ESLint, gts-based config (docs/CODING_STANDARDS.md)
npm run format:check  # Prettier check
npm run typecheck     # tsc --noEmit
```

## Deployment

No paid hosting is used — see [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) for why (every option
that can run the LLM continuously requires a paid tier). Two free access paths instead:

1. **This "Local setup" section above** — always available, and explicitly accepted by the
   submission guidelines in place of a deployed URL.
2. **An on-demand public URL via Cloudflare Tunnel**, free and no account required:
   ```bash
   npm run dev        # terminal 1
   npm run tunnel      # terminal 2 — prints a live https://*.trycloudflare.com URL
   ```

`render.yaml` and `Dockerfile` are also included, prepared and verified working (see
`docs/DEPLOYMENT.md`), in case a free always-on host becomes available later.

## Project structure

- `app/` — Next.js App Router pages and API route handlers
- `components/` — React client components (chat, dashboard, markdown rendering)
- `lib/` — shared server logic (ranking, path generation, LLM/embedding clients, session, rate limiting)
- `scripts/` — one-time catalog generation/seeding tools
- `prisma/` — database schema and migrations
- `data/` — the committed course/project/assessment catalog
- `tests/` — unit, end-to-end, and stress test suites
- `docs/` — see the Documentation section above
