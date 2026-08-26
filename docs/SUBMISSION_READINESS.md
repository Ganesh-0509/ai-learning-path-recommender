# Submission Readiness Report

Generated 2026-08-26, updated the same day after closing the courses/projects/assessments gap
(§1a). This is the honest state of the submission right now, including the one item only the
user can do.

## 1. "What to build" — the six required capabilities

| # | Required capability | Status | Where |
|---|---|---|---|
| 1 | Conversational interface (natural-language goals) | Done | `components/Chat/ChatWindow.tsx`, `/api/chat` |
| 2 | Learner profiling engine (interests, level, completed courses, objectives) | Done | `Learner`/`Progress` Prisma models, `lib/intent.ts` |
| 3 | Recommendation engine | Done — see §1a | `lib/recommend.ts`, `/api/recommend` |
| 4 | Path generator with prerequisites + milestones | Done | `lib/prereq-graph.ts` (topological sort + milestone grouping), `/api/path` |
| 5 | AI assistant: explains recommendations + answers queries | Done | `lib/explain.ts`, `lib/qa.ts`, `/api/explain`, `/api/chat` Q&A branch |
| 6 | Dashboard: progress, skills, milestones, next action | Done | `components/Dashboard/DashboardView.tsx` |

### 1a. Closed: "courses, projects and assessments"

The brief's background and "what to build" sections describe the roadmap as spanning courses,
**projects**, and **assessments** — not courses alone. This was flagged as an open gap earlier
the same day and has since been closed:

- `Course.type: ItemType` (`COURSE | PROJECT | ASSESSMENT`, `@default(COURSE)`) added to the
  existing model rather than a new table — every existing consumer (ranking, prerequisite graph,
  progress tracking) already generalized to it with zero or near-zero changes.
- `scripts/generate-project-assessment-catalog.ts` generates one capstone project and one
  checkpoint assessment per category (13 categories → 26 new items, 106 total), grounded in that
  category's existing courses via the local LLM, with deterministic level/prerequisite selection
  reusing the same embedding-similarity technique as course-to-course prerequisites.
- Assessments are simple roadmap checkpoints (title, description, ranking, explainability, a
  "mark complete" action) — not a question bank or auto-graded quiz; that was an explicit scope
  decision, not an oversight.
- `/api/recommend`, `/api/path`, and `/api/chat`'s Q&A branch all pass `type` through;
  `lib/explain.ts` and `lib/qa.ts` adapt their prompt wording to the actual item type ("why this
  **project**?" / "why this **assessment**?") instead of hardcoding "course"; the dashboard shows
  a type badge per item.
- A real latent bug was found and fixed while closing this: `groupIntoMilestones` bucketed by
  raw prerequisite-chain depth, not the same clamped depth its own title logic used — harmless
  while nothing exceeded depth 2, but a project depending on an already-2-deep course chain
  reaches depth 3 and would have produced two separate milestones both titled "Applied Practice."
  Now bucketed by clamped depth; covered by a new unit test.
- Test coverage: a new unit case for the depth-clamping fix, plus `tests/e2e/item-types.spec.ts`
  (recommend/path/explain all exercised for non-course items, using a goal confirmed to reliably
  rank a project and assessment into the top-5 path seeds).

## 2. Five deliverables

| # | Deliverable | Status |
|---|---|---|
| 1 | Source code ZIP | **Done** — `ai-learning-path-recommender-source.zip` (project root, gitignored so it doesn't ship itself), built via `git archive HEAD` so it exactly matches what's on GitHub, no `node_modules`/`.env`/`dev.db`/`archive_2026-08-25`/build artifacts. Includes README with setup/run instructions. Regenerate after any further commit — it's a point-in-time export, not auto-synced. |
| 2 | GitHub repository | **Done** — [github.com/Ganesh-0509/ai-learning-path-recommender](https://github.com/Ganesh-0509/ai-learning-path-recommender), confirmed public, real incremental commit history (not one dump commit). |
| 3 | Solution documentation (PDF/PPT) | **Done** — `docs/SOLUTION_DOCUMENTATION.pdf`, generated from `docs/SOLUTION_DOCUMENTATION.md` via `npm run docs:pdf`. Covers problem understanding, solution approach, architecture, AI/ML techniques, features/workflows, and challenges faced, as required. |
| 4 | Demo video (3–5 min) | **Script ready, recording is the one manual step left** — `docs/DEMO_VIDEO_SCRIPT.md`. Recording and uploading it isn't something that can be done from here; that's on the team. |
| 5 | Deployed URL or local setup | **Local setup documented** (`README.md`, `docs/DEPLOYMENT.md`) as the primary path, per the zero-budget constraint — every genuinely free hosting option that could run Ollama needed either a paid tier or card-based identity verification, both ruled out. `npm run tunnel` (Cloudflare quick tunnel, free, no account) gives an on-demand public URL for demo purposes without any hosting cost. |

## 3. Verification

60/60 automated tests pass (21 unit + 36 e2e + 3 stress), plus clean `lint` and `typecheck`, via
the project's own `npm test` / `npm run lint` / `npm run typecheck`. The stress-testing pass
earlier the same session surfaced and fixed two real reliability gaps — an LLM timeout crashing
the chat route, and a mid-stream failure silently killing the connection — both now degrade
gracefully instead. Closing the projects/assessments gap (§1a) surfaced a third, unrelated real
bug (the milestone-depth-clamping issue in `lib/prereq-graph.ts`), also fixed and covered by a
new unit test. Details and latency numbers are in `docs/SOLUTION_DOCUMENTATION.md` §8 and
`docs/TEST_PLAN.md` §4.

## 4. Estimated score against the judging criteria

This is a self-assessment, not a guarantee — judges may weigh things differently, and "Innovation"
and "UX" in particular are subjective. Treat the ranges as informed estimates, not promises.

| Criterion | Weight | Estimate | Why |
|---|---|---|---|
| Problem Understanding & Solution Design | 20% | **18–20 / 20** | The solution doc directly addresses sequencing (not just single-course recommendation), which is the brief's actual stated problem. Architecture is composable and each piece is independently justified rather than "one AI call does everything." The courses/projects/assessments gap (§1a) is now closed. |
| Functionality & Feature Completeness | 25% | **22–24 / 25** | All six named capabilities work end-to-end and are test-covered; feedback loop (mark complete → re-rank) is implemented, not just described; the roadmap now spans courses, projects, and assessments as the brief describes. The remaining ding is the lack of an account system (session-cookie-based single-profile-per-browser, explicitly scoped out, not hidden). |
| AI/ML Implementation | 20% | **17–19 / 20** | Real embedding-based ranking (not keyword match), RAG-grounded explanations with a demonstrated-and-fixed prompt-injection defense, structured-output validation with retry, and a hybrid deterministic+LLM catalog pipeline that used the LLM only where it added value. Entirely self-hosted, which is harder to pull off well than calling a frontier API and is demonstrated working under real (if serialized) concurrent load. |
| Innovation & Creativity | 15% | **10–13 / 15** | The zero-vendor-API constraint, structural prompt-injection defense (delimiters + server-pinned course identity, not just prompt wording), and the honest stress-test-driven graceful-degradation work are genuine differentiators most entrants likely won't have. Less "wow-factor" than a flashier but shallower feature set would produce — this is the most subjective line item and the widest range. |
| User Experience & Interface | 10% | **7–8 / 10** | Streaming responses + real markdown rendering (not a raw prose dump) address what was previously the weakest part of the experience. An `impeccable`-driven UI polish pass already happened once (Day 4). No fresh design audit ran this session — if there's time, a follow-up UX pass targeting empty/loading/error states specifically would be the highest-leverage next step for this line item. |
| Performance & Code Quality | 10% | **8–9 / 10** | `gts` (Google's own style config) enforced throughout, clean `lint`/`typecheck`, 56 passing automated tests as the sole verification method (no unverified manual claims), and stress-tested concurrency behavior with honestly-reported latency numbers and a documented capacity ceiling rather than a hidden one. |

**Total estimate: ~85–95 / 100**, up from the pre-§1a-closure ~79–90 estimate. The remaining
width is driven mostly by Innovation (the single most subjective criterion).

## 5. If there's time before 31 Aug — suggested priority order

1. Record the demo video (script is ready; this is the only deliverable with zero progress —
   consider showing a project and an assessment card, not just a course, since that's now new).
2. A fresh UX pass on empty/loading/error states specifically (the highest-leverage remaining
   item for the UX line, per §4).
3. Regenerate `ai-learning-path-recommender-source.zip` and push any final commits before
   submitting, so the ZIP/repo/PDF all reflect the same final state.
