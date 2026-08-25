# Solution Documentation
## AI-Powered Personalized Learning Path Recommender

This document covers problem understanding, solution approach, system architecture, AI/ML
techniques used, key features and workflows, and challenges faced — per the submission
guidelines. For deeper detail on any section, see the companion docs it links to.

---

## 1. Problem Understanding

Online learning platforms offer thousands of courses across every domain, and recommendation
systems can suggest individual courses reasonably well. What they don't solve is **sequencing**:
a learner with a goal ("become a backend developer," "learn machine learning") has no way to know
which courses to take, in what order, or why a given course matters to their specific goal.
Different learners arrive with different skill levels, interests, and prior experience, so a
static, one-size-fits-all curriculum doesn't fit anyone well.

The brief asked for an AI-powered assistant that: understands a learner's goal from natural
language, builds a profile of their interests/level/history, recommends relevant courses,
sequences them into a path with prerequisites and milestones, explains *why* each recommendation
was made, and visualizes progress — adapting as the learner moves through it. Full detail in
[`docs/PRD.md`](PRD.md).

## 2. Solution Approach

The solution is a conversational assistant backed by a small number of composable, independently
testable pieces rather than one monolithic "AI does everything" call:

- A **chat interface** parses free-text goals into structured intent (goal, interests, level).
- A **recommendation engine** ranks a course catalog by embedding similarity to that intent.
- A **path generator** expands the top recommendations with their prerequisites and orders them
  topologically into milestones.
- An **explainer** grounds its "why this course" answers in the same evidence the recommender
  used — it is handed retrieved facts and asked to phrase them, not asked to invent a
  justification.
- A **dashboard** surfaces progress, the next action, and lets the learner mark courses complete,
  which feeds back into future recommendations.

**One deliberate constraint shaped every decision below: every AI capability runs on a
locally-hosted, open-source model.** No request in this system ever leaves the deployed
infrastructure to a third-party AI API — not for the conversational assistant, not for
embeddings, not even for the one-time course-catalog generation step. This was a hard requirement
set for the project, not a cost-saving default, and it meant solving problems (structured output
reliability, latency, prompt-injection resistance) that a hosted frontier model would have
absorbed for us. See [`docs/SECURITY.md`](SECURITY.md) for the full reasoning.

## 3. System Architecture

```
                        +-------------------+
   Browser  <---------> |  Next.js app       |
   (chat + dashboard)   |  (App Router)      |
                        |  app/api/*  routes |
                        +---------+----------+
                                  |
                +-----------------+------------------+
                |                                     |
        +-------v-------+                     +-------v--------+
        |  SQLite via   |                     |  Local LLM      |
        |  Prisma       |                     |  (Ollama,       |
        |  - profiles   |                     |  llama3.2:3b)   |
        |  - courses    |                     |  intent parse,  |
        |  - progress   |                     |  explanations   |
        +---------------+                     +----------------+
                |
        +-------v-----------------+
        |  Embedding cache          |
        |  (local sentence-embed    |
        |  model, computed at seed  |
        |  time, stored in DB)      |
        +---------------------------+
```

- **Frontend + API**: Next.js 14 (App Router), TypeScript, Tailwind CSS — one deployable service.
- **Database**: SQLite via Prisma (the `better-sqlite3` driver adapter), holding `Course`,
  `Learner`, and `Progress` rows.
- **Embeddings**: `@huggingface/transformers` running `all-MiniLM-L6-v2` in-process — no network
  call at request time.
- **LLM**: Ollama serving `llama3.2:3b`, self-hosted, reached over HTTP on the local network.
- **Course catalog**: seeded from the Round 1 assessment dataset (80 synthetic courses; see §6),
  enriched with level/description/skills/prerequisites and committed to the repo as
  `data/courses.seed.json` so deploys don't depend on a multi-minute LLM pass succeeding.

Full detail, including the data model and API surface, in [`docs/TRD.md`](TRD.md).

## 4. AI/ML Techniques Used

- **Sentence embeddings + cosine similarity** for content-based recommendation: the learner's
  goal/interests text and every course's title+description+skills are embedded with the same
  local model, and courses are ranked by similarity. A level-mismatch is a ranking *penalty*, not
  a hard filter — an ambitious beginner still sees a stretch course, just ranked appropriately.
- **A hybrid deterministic + LLM pipeline for catalog metadata**, not one LLM call doing
  everything: course *category* is a plain lookup table (a closed classification of 80 known
  titles has no business being an LLM call); course *level, description, and skills* are judged
  by the LLM in small batches (grounded in real review text mined from the dataset); course
  *prerequisites* are then selected deterministically by walking level tiers and ranking
  candidates by **embedding similarity**, not the LLM's own say-so. Each piece uses the technique
  best suited to it.
- **Structured LLM output with schema validation and retry**, not string-parsing hope: every LLM
  call that needs structured data passes a JSON Schema to Ollama and validates the response with
  Zod, retrying with a corrective follow-up message on a parse failure (`lib/llm.ts`).
- **RAG-grounded explanation**, not free generation: the "why this course" and path-Q&A features
  hand the model only the retrieved evidence (similarity bucket, matched skills, prerequisite
  chain, or the current recommendation list) and instruct it to phrase that evidence — explicitly
  forbidden from inventing a course or a claim not present in what it was given. Verified by a
  Playwright spec that asserts a web-dev question's answer never mentions an unrelated domain
  (e.g. blockchain).
- **Topological sort over a prerequisite graph** for path generation — a plain graph algorithm
  (Kahn's algorithm), not an LLM call, because ordering constraints are exactly the kind of thing
  a small local model is unreliable at and a well-understood algorithm is not.

## 5. Key Features and Workflows

Mapped to the brief's six required capabilities:

1. **Conversational interface** — a learner types a goal in plain language; `/api/chat` extracts
   structured intent via the local LLM and asks a clarifying follow-up only when the message
   genuinely gives no direction (see §7 for why this needed two rounds of prompt work).
2. **Learner profiling engine** — interests, level, and goal persist to a `Learner` row via a
   session cookie (no account system in scope for this submission), buildable either through chat
   or the dashboard's level selector.
3. **Recommendation engine** — `/api/recommend` ranks the catalog by goal-embedding similarity,
   filtered by completed courses.
4. **Learning path generator** — `/api/path` takes the top recommendations, expands them with
   prerequisites, and groups the result into "Foundations / Core Skill / Applied Practice"
   milestones.
5. **Explainer + Q&A** — `/api/explain` answers "why this course"; `/api/chat` answers path
   questions ("how long will this take") — both grounded per §4.
6. **Dashboard** — progress bar, skills taught per course, milestone timeline, next recommended
   action, and a "Mark complete" action that feeds directly back into the next `/api/recommend`
   call (completed courses are excluded going forward).

**End-to-end workflow**: learner opens the chat → states a goal → profile is created →
`View your learning path` link appears once a goal is set → dashboard shows the generated
milestone path with per-course explanations available on demand → marking courses complete
updates progress and reshapes future recommendations.

## 6. Link to the Assessment Round

The course catalog is seeded from that round's dataset (`train.csv`, 80 course names with
synthetic review text) — reused for its realistic course-name/topic vocabulary, since no licensed
real course catalog was available for this submission. None of that round's actual task (inferring
a hidden leaderboard scoring key) carries over; it shares no engineering approach with building a
working product.

## 7. Challenges Faced

**Ollama hung entirely on a schema that was too complex, not too slow.** The first attempt at
generating course metadata batched up to 15 courses per LLM call and constrained the response with
a JSON Schema that `enum`-listed every course ID inside a fixed-length array — a grammar too
complex for CPU-side constrained decoding on a 3B model. It didn't run slowly; it deadlocked (0%
CPU, unresponsive even to a trivial request, for minutes). Fixed by validating IDs in code instead
of via schema `enum`, capping batches at 4 courses, and adding a request timeout to the local-LLM
client so any future hang fails fast instead of blocking indefinitely — a fix that also matters for
runtime chat reliability, not just the one-time seeding script.

**A "reasonable" arbitrary choice produced nonsense at the seams of a coarse category.** Course
prerequisites were originally picked as the first two courses in the next-lower level tier within
the same category. That worked until a category spanned multiple unrelated subjects —
"Programming Fundamentals" contains Python, JavaScript, C++, and Go — and "Advanced Python
Development" ended up requiring "Modern JavaScript ES6 Plus" as a prerequisite. The fix used
information already being computed anyway: rank same-tier candidates by **embedding similarity**
to the course itself, rather than picking arbitrarily. Same category boundary, but subject-aware
selection within it — verified by re-inspecting every category's prerequisite chains after the
fix, not just the one that had visibly broken.

**A real usability bug that unit/API tests couldn't have caught.** Early intent-extraction prompt
wording caused the assistant to ask an endless string of clarifying questions instead of ever
committing to a goal, even when the learner's first message was already clear and actionable
("I want to become a backend developer using Node.js"). This only surfaced through a Playwright
spec that drove the actual chat UI through a real conversation with the real local model — the
API-layer tests, which posted pre-formed profile data directly, never exercised the conversational
path and so never would have caught it. Fixed with an explicit, rule-based rewrite of the
extraction prompt (state a concrete skill/role → set the goal immediately; reserve clarification
for genuinely directionless messages). This was the strongest argument in the project for keeping
at least one real-browser, real-model test in the suite rather than testing only at the API layer.

**Keeping the no-vendor-API constraint under time pressure.** Partway through the build, Ollama's
hang (above) looked bad enough to consider a hosted model as a workaround — and a specific
API key for one arrived mid-conversation. It was declined after clarifying scope: the constraint
that every AI capability runs locally was explicit and load-bearing for this submission, the
actual root cause turned out to be a fixable bug rather than a fundamentally broken tool, and even
using a hosted call for one-time catalog generation would have meant the *committed* course data
was produced by a third-party service — a compromise on the constraint's spirit even if scoped
narrowly. The Ollama-side fix above resolved it without needing to revisit that decision.

## 8. Verification

Every capability above is backed by a passing automated test, not a manual claim — 11 unit specs
(pure ranking/path-generation logic) and 16 Playwright end-to-end specs (API-layer and real-browser,
including two flows that exercise the actual local LLM). See [`docs/TEST_PLAN.md`](TEST_PLAN.md)
for the full strategy and [`docs/SECURITY.md`](SECURITY.md) for the threat model and mitigations
applied throughout.
