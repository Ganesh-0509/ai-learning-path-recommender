# Software Requirements Specification (SRS)
## AI-Powered Personalized Learning Path Recommender

## 1. Scope

Web application: a learner interacts via chat and a dashboard; the system maintains a learner
profile, a course catalog, a prerequisite graph, and generates/updates a personalized learning
path. Reference: `docs/TRD.md` for architecture, `docs/PRD.md` for product intent.

## 2. Functional requirements

### FR-1 Conversational intake
- FR-1.1 The system SHALL accept free-text learner goal statements via a chat UI.
- FR-1.2 The system SHALL extract structured intent (target skill/role, timeframe, self-rated
  level) from free text using the local LLM.
- FR-1.3 The system SHALL ask a clarifying follow-up when intent extraction confidence is low
  (e.g. goal too vague to match any course category).

### FR-2 Learner profiling
- FR-2.1 The system SHALL persist a learner profile: interests, self-rated level, completed
  courses, stated goal(s).
- FR-2.2 The system SHALL allow the profile to be updated via chat or a structured onboarding
  form.
- FR-2.3 The system SHALL support at least one profile per demo session without requiring
  external account/auth integration.

### FR-3 Recommendation engine
- FR-3.1 The system SHALL embed the course catalog (title + description/topics) using a local
  embedding model.
- FR-3.2 The system SHALL rank catalog courses by cosine similarity between the learner's goal
  embedding and each course's embedding.
- FR-3.3 The system SHALL filter/re-rank by declared skill level (do not recommend an advanced
  course to a stated beginner without a flag).
- FR-3.4 The system SHALL exclude courses already marked complete in the learner profile from
  primary recommendations.

### FR-4 Path generation
- FR-4.1 The system SHALL maintain a prerequisite graph (course → prerequisite course IDs).
- FR-4.2 Given a set of recommended courses, the system SHALL produce a topologically valid
  ordering respecting prerequisites.
- FR-4.3 The system SHALL group the ordered courses into milestones (e.g. "Foundations,"
  "Core skill," "Applied project").
- FR-4.4 The system SHALL re-generate the path when the learner's profile or progress changes.

### FR-5 Explainability / Q&A
- FR-5.1 For each recommended course, the system SHALL generate a natural-language explanation
  grounded in the specific matched evidence (similarity to stated goal, skills the course
  teaches, prerequisite relationship) — not an unconstrained free-text generation.
- FR-5.2 The system SHALL answer learner follow-up questions about the path (e.g. "why not X
  course," "how long will this take") using the same grounded-evidence approach.

### FR-6 Dashboard
- FR-6.1 The system SHALL display overall path progress as a percentage.
- FR-6.2 The system SHALL display skills acquired vs. skill gap remaining.
- FR-6.3 The system SHALL display milestones with completion state.
- FR-6.4 The system SHALL surface the single next recommended action.
- FR-6.5 The system SHALL let the learner mark a course complete or give feedback (too
  easy/hard/skip), which triggers FR-4.4.

## 3. Non-functional requirements

- NFR-1 **No external AI vendor dependency.** All inference (embeddings + generation) runs on
  locally-hosted open-source models. No network call to a third-party AI API at runtime.
- NFR-2 **Latency.** Chat responses should return within a few seconds on the deployed instance;
  acceptable given local CPU inference constraints (not a hard SLA for a hackathon demo).
- NFR-3 **Data persistence.** Learner profile and progress persist across a browser session via
  the database, not just client state.
- NFR-4 **Deployability.** The app SHALL be deployable to a single hosting provider (Render) with
  documented setup steps reproducible by someone outside the team (the README's "local setup"
  requirement).
- NFR-5 **Code quality.** TypeScript throughout the app layer; typed data access via Prisma;
  no secrets committed to the repo.

## 4. Data requirements

- Course catalog: id, title, type (course/project/assessment), description/topics, level, skills
  taught, prerequisite ids, embedding vector — seeded from Round 1's `train.csv` (80 courses) plus
  a local-LLM metadata pass, extended with 26 generated project/assessment items.
- Learner profile: id, interests, level, completed course ids, goal statement, optional
  content-type preference (course/project/assessment/none), created/updated timestamps.
- Progress record: learner id, course id, status (not-started/in-progress/complete), feedback
  signal, timestamp.

## 5. Constraints

- 6-day delivery window.
- Local-model-only inference (see NFR-1) — governs both the tech stack and the demo environment
  (Ollama must be running/reachable wherever the app runs).

## 6. Acceptance criteria

Each FR above is demonstrable in the recorded demo video and testable locally per the README's
setup instructions.
