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
- **Embeddings:** local, via `@xenova/transformers` (all-MiniLM-L6-v2) run in a seed script —
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
    embeddings.ts
    recommend.ts
    prereq-graph.ts
    llm.ts                   local Ollama client, no vendor API
  data/
    courses.seed.json        mined from archive_2026-08-25/train.csv
    prereq-graph.json
  prisma/
    schema.prisma
  scripts/
    seed-courses.ts          mines train.csv, runs local-LLM metadata pass, embeds, writes seed json
  public/
```

## 5. Day-by-day plan (Aug 25 → Aug 31 IST)

- **Day 1 (Aug 25):** This plan. Create GitHub repo, scaffold Next.js repo, write PRD/SRS/TRD,
  Prisma schema, mine `train.csv` for the 80 courses, generate course metadata
  (skills/level/prereqs) via local-LLM batch pass, build `prereq-graph.json`, seed DB + embeddings.
- **Day 2 (Aug 26):** Learner profiling engine — onboarding flow + chat-based intent extraction
  into a structured profile (interests, level, completed courses, goal).
- **Day 3 (Aug 27):** Recommendation engine (embedding cosine match, filtered by level) + path
  generator (topological sort over prereq graph into milestones).
- **Day 4 (Aug 28):** RAG-grounded explainer/Q&A chat; dashboard UI (progress %, skills
  radar/list, milestone timeline, next recommended action).
- **Day 5 (Aug 29):** Feedback loop (path re-adapts on progress/feedback), UI polish, seed 2-3
  demo learner personas for the video, error handling pass.
- **Day 6 (Aug 30):** Deploy to Render, write README with local setup + execution steps, record
  3-5 min demo video, draft solution documentation (PDF/PPT: problem understanding, architecture,
  AI/ML techniques, features, challenges).
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
