# Coding Standards

"Google-level" here means: use Google's own published TypeScript tooling rather than inventing an
approximation of it, plus a short project-specific checklist for the things a linter can't catch.

## 1. Base style: `gts`

The project uses [`gts`](https://github.com/google/gts) (Google's official TypeScript style
tool) for ESLint + Prettier configuration — 2-space indentation, single quotes, required
semicolons, consistent import ordering, and strict compiler options
(`noImplicitAny`, `strict: true`) applied as-is rather than hand-rolled.

- `npm run lint` — check
- `npm run lint:fix` — auto-fix what's fixable
- `npm run format` — Prettier pass
- Both run in CI-equivalent form before a commit lands on `main`.

## 2. React/Next.js additions on top of `gts`

- Function components, no class components.
- Hooks rules enforced via `eslint-plugin-react-hooks`.
- No inline business logic in JSX — components call into `lib/` functions, they don't compute
  recommendations/paths themselves.
- Server-only code (Prisma client, LLM client) never imported into a `'use client'` component.

## 3. Project-specific review checklist (what a linter won't catch)

- **No silent catches.** Every `catch` either handles the error meaningfully or logs and
  re-throws/returns a typed error response — never an empty `catch {}`.
- **No `any`.** If a type is genuinely unknown at a boundary (e.g. LLM JSON output), parse it
  through a `zod` schema instead of casting to `any`.
- **Small functions, one responsibility.** If a function mixes "fetch data," "transform data,"
  and "render/respond," split it — this matters most in `lib/recommend.ts` and
  `lib/prereq-graph.ts` where the algorithms in `TRD.md` §4 should read as their pseudocode.
- **Naming matches domain vocabulary from the PRD/SRS** (`Learner`, `Course`, `Progress`,
  `Milestone`) — no ad hoc renaming of the same concept across files.
- **Comments explain why, not what.** A comment is justified only for a non-obvious constraint
  (e.g. why the LLM prompt delimits user content the way it does, per `SECURITY.md`) — not for
  restating what a well-named function already says.
- **No commented-out code, no TODO left unowned.** A `TODO` either has enough context to act on
  later or shouldn't be committed.

## 4. Commit hygiene

- Commits are scoped to one logical change, with a message describing why, matching the
  day-by-day plan in `PLAN.md` §5 — this is also what "commit history should reflect the
  development process" in the submission guidelines is checking for.
- No secrets, no `node_modules`, no build output committed (`.gitignore` enforces this).
