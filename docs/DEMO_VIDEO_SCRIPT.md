# Demo Video Script (3–5 minutes)

A ready-to-record storyboard for the required demo video. Recording itself is a manual step —
screen-record locally (e.g. OBS, or Windows' built-in Xbox Game Bar / Snipping Tool recorder)
narrating live, or record silent screen capture and voice over it afterward. Run against
`npm run dev` locally, or the Cloudflare Tunnel URL (`npm run tunnel`) if recording against a
live public link (see `docs/DEPLOYMENT.md`).

## Before recording

- Reset to a clean state: either a fresh browser profile (no `learner_id` cookie) or an incognito
  window, so the chat starts from the true first-run empty state.
- Have Ollama running (`ollama serve`) if recording against a local instance, and send one warm-up
  message first (`ollama run llama3.2:3b "hi"`) — an idle model reloads from disk on the next
  request (measured 60–75s), which can make the very first live chat message look stalled.
- Close other tabs/notifications; 1280×800 browser window reads cleanly on screen.

## Script

**0:00–0:20 — Hook + problem (on camera or voiceover over the landing chat page)**
> "Online learning platforms have thousands of courses, but no one tells you which ones to take,
> in what order, or why. This is an AI-powered learning path recommender that turns a goal you
> type in plain English into a structured, explained roadmap — built entirely on locally-hosted
> open-source models, no third-party AI API involved anywhere."

Show: the chat landing page (`/`), the initial assistant greeting.

**0:20–1:00 — Conversational intake (FR-1, FR-2)**
Type a real goal, e.g. *"I want to become a backend developer using Node.js"*. Let the reply
arrive on screen (real local-LLM latency — don't cut it, it's honest).
> "The assistant extracts a structured goal from that message — no rigid form, just what you'd
> actually type — and it only asks a follow-up question when a message is genuinely too vague to
> act on."

Optionally show a vague message ("help me learn stuff") getting a clarifying question, to
demonstrate FR-1.3 — cut this if time is tight.

**1:00–1:20 — Transition to the path**
Click "View your learning path →".
> "Once there's a goal, the recommendation engine ranks the course catalog by relevance and
> builds a path."

**1:20–2:20 — Dashboard walkthrough (FR-3, FR-4, FR-6)**
Show, in order:
- The goal card, progress bar (0%), and the level selector.
- "Next recommended action."
- Scroll the milestone list — point out the **Foundations / Core Skill / Applied Practice**
  grouping and that it's not a flat list — courses are sequenced by real prerequisites.
> "Courses are grouped into milestones by prerequisite depth, not just similarity — a course
> only appears after the courses it depends on."

**2:20–2:50 — Explainability (FR-5)**
Click "Why this course?" on one card, let the grounded explanation render.
> "Every recommendation can explain itself — grounded in the actual match evidence, not a
> generic blurb."

**2:50–3:10 — Feedback loop**
Click "Mark complete" on a course; show the progress bar and course count update, and (if time
allows) show that course no longer appears in a fresh recommendation call.
> "Progress feeds back into future recommendations — completed courses drop out immediately."

**3:10–3:40 — Path Q&A (optional, cut first if over time)**
Back in chat, ask a question about the path, e.g. *"How long will this take?"*
> "The assistant can also answer questions about your specific path — grounded in your actual
> recommended courses, not invented."

**3:40–4:00 — Close**
> "Everything you just saw — the chat, the recommendations, the explanations — runs on a
> self-hosted open-source model. No data ever leaves this deployment to a third-party AI service."

Show: a quick cut back to the dashboard or landing page as the closing frame.

## Timing notes

- Real local-LLM calls take several seconds; don't speed them up artificially — the honesty reads
  better than a fake-fast demo, and it's short enough to sit through in real time.
- If running long, cut in this order: the vague-message clarification example first, then the
  path-Q&A section. Keep the core loop (chat → path → explain → mark complete) intact — it's what
  demonstrates all six required capabilities.
- Total target: 3:30–4:30, comfortably inside the 3–5 minute requirement.
