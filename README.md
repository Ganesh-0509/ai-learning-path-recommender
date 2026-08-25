# AI-Powered Personalized Learning Path Recommender

A conversational assistant that turns a learner's stated goal into a structured, explained,
adaptive learning roadmap — built for the HCL/GUVI "AI-Powered Personalized Learning Path
Recommender" team challenge.

All AI/ML inference (intent parsing, explanations, embeddings) runs on a **locally-hosted
open-source model** — no third-party AI API is called anywhere in this product. See
[`docs/SECURITY.md`](docs/SECURITY.md) for why.

**Project status:** in active development — see [`PLAN.md`](PLAN.md) for the day-by-day build
plan and current progress. This README's setup steps reflect what's implemented so far and will
be kept current as features land.

## Documentation

- [`PLAN.md`](PLAN.md) — architecture decisions, tech stack, build schedule
- [`docs/PRD.md`](docs/PRD.md) — product requirements
- [`docs/SRS.md`](docs/SRS.md) — functional/non-functional requirements
- [`docs/TRD.md`](docs/TRD.md) — technical architecture, data model, API surface
- [`docs/SECURITY.md`](docs/SECURITY.md) — threat model and mitigations
- [`docs/TEST_PLAN.md`](docs/TEST_PLAN.md) — testing and stress-testing strategy
- [`docs/CODING_STANDARDS.md`](docs/CODING_STANDARDS.md) — style and review checklist

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

# 4. Run the dev server
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

Deployed to Render — see [`docs/TRD.md`](docs/TRD.md) §7 for the two-service setup (Next.js web
service + a private Ollama service). Deployed URL will be added here once live.

## Project structure

See [`PLAN.md`](PLAN.md) §4 for the full repo layout.
