# AI-Powered Personalized Learning Path Recommender — Build Plan

Status: CONFIRMED — building. Repo: `Ganesh-0509/ai-learning-path-recommender` (public).
Deadline: 2026-08-31, 11:59pm IST (6 days from plan date 2026-08-25).

**Hard constraint:** every AI capability in this product runs on a locally-hosted open-source
model. No call to any hosted/proprietary AI vendor's API, and no reference to any such vendor's
name anywhere in code, config, comments, env vars, docs, README, or the demo video/script. See
§3a for naming rules.

## 1. What we're building (from the brief)

Six required capabilities, each maps to a system component:

| # | Brief requirement | Component |
|---|---|---|
| 1 | Conversational interface, natural language goals | Chat UI + local-LLM intent parser |
| 2 | Learner profiling engine (interests, level, history, objectives) | Profile store, built up via chat + onboarding form |
| 3 | Recommendation engine (courses/projects/resources) | Embedding similarity over course catalog |
| 4 | Learning path generator (prerequisites, milestones) | Prerequisite graph + topological path builder |
| 5 | AI assistant explaining recommendations, answering queries | RAG-grounded explainer (local LLM reasons over retrieved evidence, doesn't invent) |
| 6 | Dashboard (progress, skill development, milestones, next actions) | Dashboard UI reading profile + progress state |

## 2. Link to Round 1 (confirmed)

Round 1 was a HackerEarth ML assessment titled the same — **"Personalized Learning Path
Recommender"** — almost certainly the GUVI/HCL screening round feeding into this team round.
Archived at `C:\hcl\archive_2026-08-25\`.

- **Reused:** `train.csv` — 109,776 synthetic reviews across **80 course names** (React Native,
  Deep Learning with TensorFlow, PostgreSQL Database Design, Git and GitHub Mastery, Blockchain
  Development, etc.). We mine this for the course catalog seed: course names + topic keywords
  pulled from review text (e.g. "JSX components, StyleSheet, Flexbox layout" for React Native).
- **Not reused:** Round 1's actual task (reverse-engineering a hidden answer key from leaderboard
  score deltas, documented in `archive_2026-08-25/pack/`) shares zero engineering approach with
  building a working product. Nothing from that pipeline carries over except the raw course names.
- Course metadata not present in Round 1 data (skill level, prerequisites, skills taught) will be
  synthesized: derive keywords from review text programmatically, then run a one-time local-LLM
  batch pass to assign level/prerequisites/skills-taught per course, human-spot-checked.

## 3. Tech stack (decided — optimizing for a working deployed app in 6 days)

- **Framework:** Next.js 14 (App Router), TypeScript, Tailwind CSS — single repo, frontend + API
  routes together, deploys in minutes, satisfies "deployed application URL" deliverable with the
  least infra work.
- **Database:** SQLite (via Prisma ORM) for learner profiles, progress, course catalog. Prisma
  makes swapping to Postgres later a config change, not a rewrite, if the chosen host needs it.
- **Embeddings:** local, via `@huggingface/transformers` (all-MiniLM-L6-v2) run in a seed script —
  no external API key, no per-request cost, deterministic, works offline for the demo. Computed
  once at seed time and cached in the DB; recommendation matching is cosine similarity at request
  time over cached vectors.
- **LLM (local, self-hosted):** Ollama serving `llama3.2:3b` (already pulled locally — 2.0GB
  quantized, no download needed for dev). Used for: (a) parsing free-text learner goals into
  structured intent, (b) generating explanations grounded in retrieved course matches (RAG
  pattern — the model explains evidence handed to it, it does not free-generate recommendations),
  (c) conversational Q&A. All calls go to `http://localhost:11434` (or `OLLAMA_HOST` in prod) —
  never to a third-party AI API.
- **Prerequisite graph:** small hand-curated JSON (course → category, skills taught, level,
  prerequisite course IDs), generated from the 80 seeded courses + one local-LLM pass, used for
  topological path ordering and milestone breakdown.
- **Deployment:** Render, two services — a Node web service for the Next.js app, and a private
  Render service running Ollama (Docker image `ollama/ollama`) with `llama3.2:3b` pulled at
  container start, reached over Render's internal network. Avoids the serverless
  ephemeral-filesystem problem SQLite would hit on Vercel.
  **Risk flagged in §8:** a 3B model needs ~4-6GB RAM comfortably; Render's free tier (512MB) will
  not run it — this needs at least a paid Starter/Standard instance for the Ollama service.

## 3a. No-vendor-reference rule (hard constraint)

Nothing in this repo — code, identifiers, comments, env var names, README, PRD/SRS/TRD, or the
demo video/script — names a proprietary AI vendor or their products. Concretely:

- Module/file naming: `lib/llm.ts`, `lib/embeddings.ts` — never `lib/claude.ts` or similar.
- Env vars: `LLM_HOST`, `LLM_MODEL`, `EMBEDDING_MODEL` — never a vendor-branded key name.
- Docs describe the approach generically: "a locally-hosted open-source instruction-tuned LLM
  (served via Ollama)" — the specific model name (`llama3.2:3b`) is fine to state since it's an
  open-weight Meta release being self-hosted, not a vendor API; what's disallowed is any
  proprietary API/vendor reference (i.e. no OpenAI/Anthropic/Google/etc. naming) or implication
  that a hosted third-party AI service was called.
- Before each commit that touches AI logic or docs, grep the diff for vendor names as a check.

## 4. Repo structure

```
C:\hcl\
  PLAN.md
  README.md
  .env.example
  docs/
    PRD.md                    Product Requirements Document
    SRS.md                    Software Requirements Specification
    TRD.md                    Technical Requirements Document
    SECURITY.md                Threat model, OWASP-mapped mitigations, secure-by-default rules
    TEST_PLAN.md               Test pyramid, Playwright E2E strategy, stress-test approach
    CODING_STANDARDS.md        Google-style (gts) TypeScript/React conventions, review checklist
  tests/
    e2e/                      Playwright functional specs (one per user flow / FR)
    stress/                   Playwright-driven concurrency/load specs
  playwright.config.ts
  app/
    page.tsx                 landing + chat entry
    dashboard/page.tsx
    api/
      chat/route.ts
      profile/route.ts
      recommend/route.ts
      path/route.ts
      progress/route.ts
  components/
    Chat/
    Dashboard/
  lib/
    db.ts
    embeddings.ts             local sentence-embedding model, no vendor API
    llm.ts                   local Ollama client, no vendor API
    recommend.ts
    prereq-graph.ts
  data/
    courses.seed.json        generated once by scripts/generate-course-catalog.ts, committed
  prisma/
    schema.prisma
  scripts/
    lib/
      mine-train-csv.ts       parses archive_2026-08-25/train.csv
      course-categories.ts    deterministic course -> category lookup (not an LLM call)
      slugify.ts
    generate-course-catalog.ts  dev-time only: mines CSV, one local-LLM pass per
                                 category for level/description/skills, builds
                                 prerequisites deterministically, embeds, writes
                                 data/courses.seed.json — NOT run at deploy time
    seed-db.ts                fast + deterministic: reads courses.seed.json,
                               upserts into the DB — this IS what runs at deploy time
  public/
```

Prerequisites live directly on each `Course` row (`prerequisites: string[]` of course ids) rather
than in a separate graph file — `lib/prereq-graph.ts` builds the in-memory adjacency it needs from
`Course` rows at request time, so a standalone `prereq-graph.json` would just be a stale
duplicate.

## 5. Day-by-day plan (Aug 25 → Aug 31 IST)

Security and tests are not a Day-6 add-on — each day's feature work ships with its Playwright
spec and its input-validation/authz pass the same day (see §9, §10).

- **Day 1 (Aug 25):** This plan + PRD/SRS/TRD/SECURITY/TEST_PLAN/CODING_STANDARDS. Create GitHub
  repo, scaffold Next.js repo with `gts`-based lint/format config, Playwright installed and
  configured, Prisma schema, security headers/middleware skeleton. Mine `train.csv` for the 80
  courses, generate course metadata (skills/level/prereqs) via local-LLM batch pass, build
  `prereq-graph.json`, seed DB + embeddings.
- **Day 2 (Aug 26):** Learner profiling engine — onboarding flow + chat-based intent extraction
  into a structured profile (interests, level, completed courses, goal). Zod-validated API
  input on every route touched. Playwright spec: onboarding → profile persisted.
- **Day 3 (Aug 27):** Recommendation engine (embedding cosine match, filtered by level) + path
  generator (topological sort over prereq graph into milestones). Playwright spec: goal →
  recommendations → ordered path with prerequisites respected.
- **Day 4 (Aug 28):** RAG-grounded explainer/Q&A chat; dashboard UI (progress %, skills
  radar/list, milestone timeline, next recommended action). Run the `impeccable` skill against
  the chat + dashboard UI once built, fix what it flags. Playwright spec: explanation + Q&A +
  dashboard render correctly.
- **Day 5 (Aug 29):** Feedback loop (path re-adapts on progress/feedback). Full OWASP-mapped
  security pass against SECURITY.md checklist. Playwright stress spec: N concurrent simulated
  learners hitting chat/recommend/progress endpoints, verify no data corruption/crash and record
  latency under load. Seed 2-3 demo learner personas for the video.
- **Day 6 (Aug 30):** Deploy to Render, write README with local setup + execution steps, run
  full Playwright suite (functional + stress) against the deployed URL, record 3-5 min demo
  video, finalize solution documentation (PDF/PPT).
- **Aug 31 (buffer):** Final review of all 5 deliverables, submit before 11:59pm IST.

## 6. Deliverables checklist (all 5 required)

- [ ] Source code ZIP (exclude `node_modules`, `.next`, build artifacts)
- [ ] GitHub repo, commit history reflecting real development (not one squash commit)
- [ ] Solution documentation PDF/PPT
- [ ] Demo video (3-5 min) — hosted, URL submitted
- [ ] Deployed application URL + local setup README

## 7. Judging weight → where the effort goes

| Criterion | Weight | Plan coverage |
|---|---|---|
| Problem Understanding & Solution Design | 20% | This plan + documentation deliverable |
| Functionality & Feature Completeness | 25% | All 6 components in §1, built end to end |
| AI/ML Implementation | 20% | Embeddings + RAG-grounded LLM explainer + skill-gap logic |
| Innovation & Creativity | 15% | Adaptive feedback loop, explainability layer |
| User Experience & Interface | 10% | Chat + dashboard, not a bare form |
| Performance & Code Quality | 10% | TypeScript, Prisma-typed data layer, clean structure |

## 8. Open decisions / risks to flag before building further

- **Render RAM for the Ollama service:** `llama3.2:3b` needs more than Render's free-tier 512MB.
  Needs a paid Starter/Standard instance for that service specifically, or fall back to a smaller
  local model (already-pulled options: none smaller than 2GB locally; would need to pull one, e.g.
  `qwen2.5:0.5b`) if budget/RAM is tight at deploy time.
- Local dev requires Ollama running (`ollama serve`) with `llama3.2:3b` pulled — already true on
  this machine.
- Team GitHub repo: created at `Ganesh-0509/ai-learning-path-recommender` (public).

## 9. Security (full detail in `docs/SECURITY.md`)

Security is a build goal, not a pre-submission checklist item. Summary of what applies to every
route/component as it's built:

- All API input validated with `zod` schemas — no route trusts a request body/query as typed.
- Prisma parameterized queries only — no raw SQL string interpolation, which would reopen SQL
  injection.
- React's default output escaping relied on for XSS; no `dangerouslySetInnerHTML` unless a
  specific case is justified and sanitized.
- Security headers (CSP, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`) set via
  `next.config.js` / middleware.
- Rate limiting on chat/recommend/progress API routes (in-memory token bucket is sufficient for a
  single-instance hackathon deploy; documented as a scaling limitation, not silently ignored).
- No secrets committed: `.env` gitignored, `.env.example` documents required vars with placeholder
  values only.
- LLM prompt-injection awareness: learner free-text is never concatenated into a prompt that also
  carries system instructions/trusted data without a clear delimiter, since a learner could type
  text trying to override the assistant's behavior.
- Dependency hygiene: `npm audit` run before each merge to `main`.

## 10. Testing & verification strategy (full detail in `docs/TEST_PLAN.md`)

- **Verification tool is Playwright, exclusively.** No manual/ad hoc browser-tool clicking to
  "confirm it works" — every functional claim is backed by a Playwright spec that runs and
  passes. `tests/e2e/` holds one spec per user flow (mapped to the FRs in `SRS.md`).
- **Stress testing is also Playwright-driven** — `tests/stress/` scripts spin up many concurrent
  browser contexts (or use Playwright's `APIRequestContext` for pure API-layer load without
  browser overhead) against chat/recommend/progress endpoints, asserting the app stays correct
  and responsive under concurrent load, not just under a single serial user.
- **UI/UX verification** goes through the `impeccable` skill once the chat and dashboard UI exist
  (Day 4) — hierarchy, accessibility, responsive behavior, empty/error states — findings get
  fixed before Day 5, not left as known issues.
- Unit tests (Node's built-in test runner or Vitest) cover the pure-logic pieces that don't need
  a browser: recommendation ranking, topological path sort, prerequisite expansion.

## 11. Coding standard (full detail in `docs/CODING_STANDARDS.md`)

"Google-level" is operationalized as: use Google's own published TypeScript tooling (`gts`) for
lint/format rather than inventing an equivalent, plus a short project-specific review checklist
(naming, function size, error handling, no silent catches, no `any`). Applied via ESLint +
Prettier config checked in, and expected to pass before any commit lands on `main`.
