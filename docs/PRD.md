# Product Requirements Document (PRD)
## AI-Powered Personalized Learning Path Recommender

## 1. Purpose

Online learning platforms offer thousands of courses, but learners struggle to identify the
right *sequence* of resources to reach a specific goal. This product is a conversational
assistant that turns a learner's stated goal, background, and progress into a structured,
explained, adaptive learning roadmap.

## 2. Target users

- **Self-directed learners** choosing among many courses with no clear path to a goal (e.g.
  "become a backend developer," "learn ML for my job").
- **Career switchers** who need a gap analysis between current skills and a target role.
- **Upskillers** with some prior courses completed who want the *next* step, not a from-scratch
  plan.

## 3. Problem statement

A one-size-fits-all course catalog forces learners to self-sequence their own path, with no
visibility into prerequisites, no explanation of why a resource fits their goal, and no
adaptation when their pace or interests change.

## 4. Goals / success criteria

- A learner can describe a goal in plain language and receive a structured path within one
  conversation turn.
- Every recommendation is accompanied by a stated reason, not a bare list.
- The path updates when the learner reports progress or gives feedback (skip/mark complete/
  "too easy"/"too hard").
- Judged deliverable coverage: all six required capabilities in the brief are present and
  demonstrable end-to-end in the demo video.

## 5. Non-goals (out of scope for this submission)

- Real course content delivery/hosting — the product recommends and sequences existing course
  catalog entries, it does not host lesson video/text content itself.
- Multi-tenant auth/accounts beyond a single-learner demo profile flow.
- Payment/enrollment integration with real course providers.

## 6. Features (maps 1:1 to the brief's "what to build")

1. **Conversational interface** — chat where the learner states goals/background in natural
   language.
2. **Learner profiling engine** — captures interests, experience level, completed courses,
   objectives; built incrementally from chat + an optional onboarding form.
3. **Recommendation engine** — suggests courses/projects/resources relevant to the stated goal
   and current level.
4. **Learning path generator** — orders recommendations into a roadmap with prerequisites and
   milestones.
5. **Explainer/Q&A assistant** — states why each recommendation was made, answers learner
   questions about the path.
6. **Dashboard** — visualizes progress, skill development, milestones, and next recommended
   action.

## 7. Constraints

- All AI/ML inference runs on a **locally-hosted, open-source model** — no proprietary third-party
  AI API calls anywhere in the product, and no vendor name referenced in code or docs.
- 6-day build window (2026-08-25 → 2026-08-30, submit by 2026-08-31 11:59pm IST).
- Course catalog seeded from the Round 1 assessment dataset (80 synthetic courses) since no
  licensed real course catalog is available for this submission.

## 8. Success metrics for the demo

- End-to-end flow completes without manual intervention: onboarding → goal statement → generated
  path with milestones → at least one "why this course" explanation → a progress update that
  visibly changes the dashboard.
