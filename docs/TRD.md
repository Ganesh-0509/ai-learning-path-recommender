# Technical Requirements Document (TRD)
## AI-Powered Personalized Learning Path Recommender

## 1. Architecture overview

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

Both the LLM and the embedding model run locally/self-hosted. No request in this system leaves
the deployed infrastructure to a third-party AI API.

## 2. Tech stack

| Layer | Choice | Rationale |
|---|---|---|
| Frontend + API | Next.js 14, App Router, TypeScript | One repo, fast to ship, deploys as a single service |
| Styling | Tailwind CSS | Fast to build a clean chat + dashboard UI |
| Database | SQLite via Prisma ORM | Zero-setup persistence; Prisma schema is portable to Postgres later |
| Embeddings | `@xenova/transformers`, `all-MiniLM-L6-v2` | Runs in Node, no external API, deterministic, small enough to run at seed time |
| LLM | Ollama serving `llama3.2:3b` | Already available locally; open-weight, self-hosted, no vendor API dependency |
| Deployment | Render — one web service (Next.js) + one private service (Ollama, Docker) | Persistent process (SQLite-safe, unlike serverless), supports running Ollama alongside the app |

## 3. Data model (Prisma schema, conceptual)

```prisma
model Course {
  id             String   @id
  title          String
  type           String   // course | project | assessment (default: course)
  category       String
  description    String
  level          String   // beginner | intermediate | advanced
  skillsTaught   String   // JSON-encoded string array
  prerequisites  String   // JSON-encoded array of Course ids
  embedding      String   // JSON-encoded float array
}

model Learner {
  id           String   @id @default(cuid())
  interests    String   // JSON-encoded string array
  level        String
  goal         String
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}

model Progress {
  id         String   @id @default(cuid())
  learnerId  String
  courseId   String
  status     String   // not_started | in_progress | complete
  feedback   String?  // too_easy | too_hard | skip
  updatedAt  DateTime @updatedAt
}
```

## 4. Core algorithms

### 4.1 Recommendation ranking
1. Embed the learner's goal text (+ interests) with the local embedding model.
2. Cosine-similarity rank against cached course embeddings.
3. Filter out courses already `complete` in `Progress`.
4. Re-weight by level match (penalize a level mismatch rather than hard-excluding, so an
   ambitious beginner still sees a stretch course flagged as such). The penalty is
   **multiplicative** (`score = similarity * (1 - levelDelta * 0.15)`), not a flat subtraction —
   scaling the penalty by the item's own similarity keeps a strongly relevant, one-tier-off item
   resistant to being buried under a barely relevant, level-matched one — a flat subtraction let
   this actually happen for a real "machine learning" goal (see `docs/TECHNICAL_REPORT.md` §4.1
   for the full derivation and the discovered failure case).

### 4.2 Path generation
1. Take the top-N ranked courses from §4.1.
2. Expand the set with any missing prerequisite courses (walk `prerequisites` recursively).
3. Topologically sort the expanded set on the prerequisite graph.
4. Chunk the sorted list into milestones by graph depth (e.g. depth 0 = "Foundations").

### 4.3 Explanation generation (RAG pattern)
The LLM is never asked to invent a recommendation. For each course already selected by §4.1/4.2,
the prompt supplies: the course's matched skills, its similarity score, and its prerequisite
relationship to the learner's stated goal — the model's only job is to phrase that evidence as a
natural-language explanation, and to answer follow-up questions by re-grounding in the same
retrieved evidence.

## 5. API surface (Next.js route handlers)

| Route | Method | Purpose |
|---|---|---|
| `/api/chat` | POST | Send a chat message, get intent extraction / explanation / Q&A response |
| `/api/profile` | GET/POST | Read/update the learner profile |
| `/api/recommend` | GET | Get ranked course recommendations for the current profile |
| `/api/path` | GET | Get the generated milestone path |
| `/api/progress` | POST | Mark a course complete / give feedback, triggers path regeneration |

## 6. Environment configuration (`.env.example`)

```
DATABASE_URL="file:./dev.db"
LLM_HOST="http://localhost:11434"
LLM_MODEL="llama3.2:3b"
EMBEDDING_MODEL="Xenova/all-MiniLM-L6-v2"
```

No vendor-branded environment variable names are used anywhere in this project.

## 6a. Catalog generation vs. DB seeding (two separate scripts, on purpose)

`scripts/generate-course-catalog.ts` is a **dev-time, rerun-on-demand** tool: it mines
`archive_2026-08-25/train.csv`, makes one local-LLM call per course category (not per course —
batching lets the model judge difficulty *relative to its own category*, which produces more
coherent prerequisite chains than 80 independent judgments) to assign level/description/skills,
builds the prerequisite graph deterministically from those levels (§4.2), computes embeddings,
and writes the result to `data/courses.seed.json`, which is committed to the repo.

`scripts/seed-db.ts` is the **deploy-time** step: it only reads that already-generated,
already-validated JSON and upserts it into the database — no LLM call, no embedding computation,
no dependency on Ollama being reachable. This is deliberate: a deploy build should not depend on
a multi-minute local-model inference pass succeeding, and course catalog data shouldn't change on
every deploy anyway. Re-run `generate-course-catalog.ts` and commit the updated
`courses.seed.json` only when the dataset or the metadata prompt changes.

## 7. Deployment

This was the originally-designed two-service Render plan (kept below for reference — the
`render.yaml`/`Dockerfile` built from it are still in the repo, verified working locally). It was
**not used for the actual submission** — see `docs/DEPLOYMENT.md` for the zero-budget decision
(local execution + an on-demand Cloudflare Tunnel instead) and why every paid-tier-free hosting
option was ruled out.

1. Render private service: Docker image `ollama/ollama`, entrypoint pulls `llama3.2:3b` on first
   boot, exposes port 11434 on Render's internal network only.
2. Render web service: Next.js app, `LLM_HOST` pointed at the internal Ollama service URL,
   `DATABASE_URL` pointed at a persistent disk-backed SQLite file (Render persistent disks are
   available on paid instance types).
3. Build command: `npm install && npx prisma migrate deploy && npm run build`.
4. Start command: `npm run start`.

## 8. Risks

- Local 3B-parameter inference on CPU is slower than a hosted API — acceptable for a hackathon
  demo, called out explicitly in the demo video rather than hidden.
- Render's free tier RAM (512MB) is insufficient for `llama3.2:3b`; the Ollama service would need
  a paid instance tier — the reason the Render plan above was ultimately not used.
