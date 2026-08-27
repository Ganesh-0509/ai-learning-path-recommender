# AI-Powered Personalized Learning Path Recommender

A conversational assistant that turns a learner's stated goal — in plain, everyday language —
into a structured, explained, adaptive learning roadmap. Built for the HCL/GUVI "AI-Powered
Personalized Learning Path Recommender" hackathon.

> **Zero third-party AI.** Every AI feature (understanding your goal, ranking content, writing
> explanations) runs on a model hosted on your own machine — nothing is sent to OpenAI, Anthropic,
> Google, or any other AI vendor. See [Why local-only AI](#why-local-only-ai) below.

**Project status:** feature-complete and submission-ready. See
[`docs/SUBMISSION_READINESS.md`](docs/SUBMISSION_READINESS.md) for the full requirements
checklist.

---

## Contents

- [What it does](#what-it-does)
- [How it works](#how-it-works)
- [What makes it different](#what-makes-it-different)
- [Tech stack](#tech-stack)
- [Getting started](#getting-started)
- [Testing](#testing)
- [Code quality](#code-quality)
- [Project structure](#project-structure)
- [Deployment](#deployment)
- [Why local-only AI](#why-local-only-ai)
- [Full documentation](#full-documentation)

---

## What it does

You type what you want to learn — for example, *"I want to become a backend developer using
Node.js"* — like you're texting a friend. No forms, no dropdowns. The app then:

1. **Understands your goal**, your skill level, and any specific interests you mentioned.
2. **Searches a catalog of 106 items** (courses, hands-on projects, and skill-check assessments)
   for the ones that actually match what you're trying to learn — by meaning, not just keywords.
3. **Builds you a roadmap**, automatically pulling in prerequisites and grouping everything into
   three stages: **Foundations → Core Skill → Applied Practice**.
4. **Explains why** each item was picked, in plain language grounded in real facts about it.
5. **Adapts as you go** — mark something complete and it drops out of future suggestions; say a
   course was "too easy" or "too hard" and the app quietly recalibrates what it recommends next.

Think of it as a personal tutor that builds you a study plan, instead of handing you a giant list
of courses and leaving you to figure out where to start.

## How it works

```
 You type a goal              The app understands it            It searches & ranks
┌──────────────────┐        ┌──────────────────────┐        ┌──────────────────────────┐
│ "I want to learn  │  ───▶  │ goal · level ·        │  ───▶  │ 106 courses/projects/    │
│  machine learning"│        │ interests extracted   │        │ assessments, ranked by   │
└──────────────────┘        │ by a local LLM         │        │ meaning-similarity       │
                             └──────────────────────┘        └──────────────────────────┘
                                                                          │
                                                                          ▼
 You track & adjust            You see why                    A roadmap is generated
┌──────────────────┐        ┌──────────────────────┐        ┌──────────────────────────┐
│ Mark complete /   │  ◀───  │ Plain-language        │  ◀───  │ Foundations → Core Skill │
│ "too hard/easy"    │        │ explanation per item  │        │ → Applied Practice       │
└──────────────────┘        └──────────────────────┘        └──────────────────────────┘
```

| Part | What it does |
|---|---|
| **Chat** | Turns a normal sentence into a structured profile (goal, level, interests). |
| **Learner profile** | Remembers who you are and what you've completed, across visits. |
| **Recommendation engine** | Ranks the catalog by meaning-similarity to your goal. |
| **Path builder** | Orders recommendations into a sensible, prerequisite-aware roadmap. |
| **Explainer** | Writes a grounded, plain-language "why this was picked" per item. |
| **Dashboard** | Shows progress, lets you mark things complete, and collects feedback. |

For a no-jargon walkthrough of the whole thing, see
[`docs/PROJECT_EXPLAINED_SIMPLY.md`](docs/PROJECT_EXPLAINED_SIMPLY.md).

## What makes it different

Beyond the six capabilities above, five extra features make the experience more transparent and
more useful:

- **⚡ Zero-cloud proof badge** — every AI response shows its elapsed time and "0 external calls,"
  so the local-only claim is something you *see* happen, not just something you read about.
- **"What if" path preview** — instantly preview your roadmap at a different skill level, without
  saving or changing anything.
- **Resume/portfolio blurb** — once you've completed something, generate a short, grounded summary
  you can drop straight into a resume or LinkedIn profile.
- **Content-type preference** — tell the app to lean toward courses, hands-on projects, or
  assessments, and it'll bias future recommendations accordingly.
- **Voice input (disclosed)** — an optional mic button for the chat box. Unlike everything else in
  this app, most browsers send this audio to their own vendor's cloud to transcribe it — so it
  ships with a clear, persistent disclosure rather than a silent exception.

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router), React 19, TypeScript |
| Styling | Tailwind CSS |
| Database | SQLite via Prisma 7 |
| Local LLM | [Ollama](https://ollama.com) running `llama3.2:3b` |
| Local embeddings | `@huggingface/transformers` (all-MiniLM-L6-v2), on-device |
| Validation | Zod, at every API boundary |
| Testing | Playwright (unit, end-to-end, and stress suites) |
| Linting/formatting | ESLint (`gts`), Prettier |

## Getting started

### Prerequisites

- Node.js 20+ and npm
- [Ollama](https://ollama.com) installed and running locally, with a model pulled:
  ```bash
  ollama pull llama3.2:3b
  ollama serve
  ```
- No accounts, API keys, or external services required — everything runs on your machine.

### Setup

```bash
# 1. Install dependencies
npm install

# 2. Configure environment (defaults already work for local dev)
cp .env.example .env

# 3. Set up the database
npx prisma generate
npx prisma migrate dev

# 4. Seed the course/project/assessment catalog
#    (uses the committed data/courses.seed.json — no LLM call needed)
npm run seed

# 5. Run the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and try typing a learning goal.

## Testing

Playwright is the project's sole verification tool — see
[`docs/TEST_PLAN.md`](docs/TEST_PLAN.md) for the full strategy.

```bash
# Install browsers once
npx playwright install --with-deps chromium

npm run test:unit    # fast, pure-logic unit tests
npm run test:e2e     # functional end-to-end tests
npm run test:stress  # concurrency/load tests
npm test              # e2e + stress, sequentially
```

## Code quality

```bash
npm run lint          # ESLint, gts-based config — see docs/CODING_STANDARDS.md
npm run format:check  # Prettier check
npm run typecheck     # tsc --noEmit
```

## Project structure

```
app/            Next.js App Router pages and API route handlers
components/     React client components (chat, dashboard, markdown rendering)
lib/            Shared server logic — ranking, path generation, LLM/embedding
                clients, session handling, rate limiting
scripts/        One-time catalog generation/seeding tools
prisma/         Database schema and migrations
data/           The committed course/project/assessment catalog
tests/          Unit, end-to-end, and stress test suites
docs/           Requirements, architecture, security, and testing documentation
```

## Deployment

No paid hosting is used — every host that can run the LLM continuously requires a paid tier (see
[`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) for the full reasoning). Two free ways to access the
app instead:

1. **Run it locally** — the [Getting started](#getting-started) steps above. This is explicitly
   accepted by the submission guidelines in place of a hosted URL.
2. **Share it temporarily** via a free Cloudflare Tunnel, no account required:
   ```bash
   npm run dev      # terminal 1
   npm run tunnel   # terminal 2 — prints a live https://*.trycloudflare.com URL
   ```

A `Dockerfile` and `render.yaml` are also included and verified working, in case a free always-on
host becomes available later.

## Why local-only AI

Every AI capability in this app — intent parsing, recommendation ranking, and explanations — runs
on a model hosted on your own machine (Ollama + Llama 3.2, and a local embedding model). No
learner data, goal, or message is ever sent to a third-party AI API. This was a deliberate
constraint, not a limitation worked around: see [`docs/SECURITY.md`](docs/SECURITY.md) for the
full threat model and reasoning.

The one disclosed exception is the optional voice-input feature, which uses the browser's own
built-in speech recognition — most browsers transcribe this via their vendor's cloud service, not
on-device. It's clearly labeled in the UI for exactly this reason.

## Full documentation

| Document | What's in it |
|---|---|
| [`docs/PROJECT_EXPLAINED_SIMPLY.md`](docs/PROJECT_EXPLAINED_SIMPLY.md) | No-jargon walkthrough — start here if the rest feels too dense |
| [`docs/PRD.md`](docs/PRD.md) | Product requirements |
| [`docs/SRS.md`](docs/SRS.md) | Functional and non-functional requirements |
| [`docs/TRD.md`](docs/TRD.md) | Technical architecture, data model, API surface |
| [`docs/SECURITY.md`](docs/SECURITY.md) | Threat model and mitigations |
| [`docs/TEST_PLAN.md`](docs/TEST_PLAN.md) | Testing and stress-testing strategy |
| [`docs/CODING_STANDARDS.md`](docs/CODING_STANDARDS.md) | Style guide and review checklist |
| [`docs/SOLUTION_DOCUMENTATION.md`](docs/SOLUTION_DOCUMENTATION.md) | Problem understanding, solution approach, architecture, features (submission deliverable) |
| [`docs/SUBMISSION_READINESS.md`](docs/SUBMISSION_READINESS.md) | Requirements gap-check and self-assessed score estimate |
| [`docs/TECHNICAL_REPORT.md`](docs/TECHNICAL_REPORT.md) | Full engineering deep-dive: architecture, algorithms, measured performance, security |
| [`docs/DEMO_VIDEO_SCRIPT.md`](docs/DEMO_VIDEO_SCRIPT.md) | Storyboard for the demo video (submission deliverable) |
| [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) | Deployment steps, cost expectations, fallback options |
| [`PLAN.md`](PLAN.md) | Day-by-day build log — architecture decisions, what broke and why, in order |
