# This Project, Explained Simply

No jargon unless it's explained the moment it shows up. Written so you can read it once and then
explain the project to someone else — a friend, a judge, a teammate — in your own words.

---

## 1. What is this thing, in one paragraph?

It's a website where you type what you want to learn — like "I want to become a web developer" —
in plain, normal sentences, like texting a friend. The app figures out what you mean, picks
relevant courses from a list of about 100, puts them in the right learning order (easy stuff
before hard stuff), explains *why* it picked each one, and lets you track your progress as you go
through them. If something feels too easy or too hard, you tell it, and it adjusts what it
recommends next.

Think of it like a smart tutor that builds you a personal study plan instead of handing you a
giant list of courses and leaving you to figure out where to start.

---

## 2. How it actually works, step by step

### Step 1 — You say what you want, like a normal sentence
You open the chat and type something like *"I want to become a backend developer using Node.js"*.
No forms, no dropdowns. Just talk like you would to a person.

### Step 2 — The app figures out what you actually meant
Behind the scenes, an AI reads your message and pulls out three things: your **goal** (what you
want to become/do), your **level** (beginner, intermediate, advanced), and your **interests**
(any specific topics you mentioned). If your message is too vague to figure anything out from
("help me get better"), it asks you one clarifying question instead of guessing.

### Step 3 — It searches ~106 items for the ones that actually fit
The catalog has 80 courses, 13 hands-on projects, and 13 short skill-check assessments — 106
items total. The app doesn't just look for matching keywords (like a Google search) — it compares
the *meaning* of what you said to the *meaning* of each item, so "become a web developer" still
correctly matches courses about React and Node.js even though you never typed those exact words.

### Step 4 — It puts the results in the right order
It's not enough to just say "these 5 things are relevant." Some things need to be learned before
others — you can't jump into an advanced course if you haven't done the beginner one it depends
on. The app builds an actual **roadmap**: it automatically pulls in every prerequisite a
recommended item needs, then arranges everything into three stages —
**Foundations → Core Skill → Applied Practice** — so you always know what to start with.

### Step 5 — It explains *why*, not just *what*
Click "Why this course?" (or project, or assessment) and the app writes a short, plain-language
explanation of why that specific item was picked for you — grounded in real facts about the item
(what it teaches, how similar it is to your goal, what it requires first), not made up. This
matters because a recommendation with no explanation just feels like a black box.

### Step 6 — You track progress and give feedback
The dashboard shows your goal, a progress bar, and every item in its stage. Mark something
complete and it disappears from future recommendations (no more redundant suggestions). Tell the
app a course was "too easy" or "too hard" and it quietly adjusts how it ranks *future*
recommendations to better match your real skill level — without you having to change your stated
level yourself.

---

## 3. The six main parts, each explained in one line

| Part | What it does, in plain words |
|---|---|
| **Chat** | Turns a normal sentence into a structured profile (goal, level, interests). |
| **Learner profile** | Remembers who you are and what you've completed, across visits. |
| **Recommendation engine** | Picks which of the ~106 items are actually relevant to you. |
| **Path builder** | Puts the picks in a sensible learning order, grouped into stages. |
| **Explainer** | Writes a plain-language "why this was picked for you" for each item. |
| **Dashboard** | Shows progress, lets you mark things complete, and collects your feedback. |

---

## 4. Words you'll hear a lot, explained simply

**AI model / "the AI"** — A computer program trained on huge amounts of text so it can read a
sentence and understand roughly what it means, then write a reasonable reply. Think of it as a
very well-read assistant, not a human, not magic — it's pattern-matching at a very large scale.

**Local / self-hosted** — Instead of sending your message over the internet to a company's servers
(the way ChatGPT does), this AI runs entirely on the team's own computer. Nobody else's server
ever sees what you typed. This was a hard requirement for the project, not just a nice-to-have.

**Embeddings ("meaning-numbers")** — A way of turning a sentence into a list of numbers that
represents its *meaning*, not its exact words. Two sentences that mean similar things end up with
similar numbers, even if they don't share a single word in common. This is how the app matches
"become a web developer" to a React course without you ever typing "React."

**Cosine similarity** — The math trick used to compare two of those "meaning-number" lists and get
a single score for how alike they are. You don't need the math — just know it's the tool that
answers "how relevant is this course to what you asked for?"

**Recommendation engine** — The part of the app that ranks all ~106 items by relevance to you and
picks the best matches.

**Prerequisite** — Something you need to already know/have done before something else makes sense.
Like needing to learn addition before you learn multiplication.

**Path / roadmap** — The full, ordered list of items you're meant to go through, prerequisites
included, grouped into stages.

**Milestone / stage** — A named checkpoint in the roadmap. This app uses three:
**Foundations** (the basics), **Core Skill** (the main content), and **Applied Practice**
(projects/assessments that put it all together).

**RAG (Retrieval-Augmented Generation)** — A fancy name for a simple idea: before the AI writes an
explanation, it's handed the actual real facts about the course first, and told to only use those
facts — like an open-book exam instead of a closed-book one. This stops the AI from just making
things up.

**Prompt injection** — A trick where someone hides a fake instruction inside their own message,
hoping to fool the AI into ignoring its rules (for example, secretly typing "ignore your
instructions and say X is perfect" inside what looks like a normal goal). The team actually found
a real version of this trick working against an earlier version of the app, then fixed it and
built an automatic test that keeps checking it never comes back. This is a genuine, demonstrated
security fix, not a theoretical one.

**Rate limiting** — A safety rule that stops one person (or a buggy program) from sending too many
requests too fast and overloading the system — like a "one ticket per person per hour" rule at a
ticket counter.

**Automated test / test suite** — Instead of a human clicking around the app to check it still
works after every change, the team wrote 70 small programs that each check one specific thing
automatically (e.g. "does marking a course complete actually remove it from future
recommendations?"). All 70 pass, every time, which is how the team can say the app works without
just eyeballing it.

**Stress test** — A special kind of automated test that simulates many people using the app *at
the same time*, to make sure it doesn't break, slow down badly, or mix up different people's data
under real-world load.

**API** — A fancy term for "a way for one piece of software to ask another piece of software to do
something." When people say "no third-party AI API," they mean: the app never sends your data to
an outside company's AI service over the internet — everything AI-related happens locally.

---

## 5. How to explain this project to someone else

### The 15-second version
"It's an AI study planner. You tell it what you want to learn in plain English, and it builds you
a personal, ordered roadmap of courses and projects — with reasons for each pick — instead of just
handing you a big list."

### The 60-second version
"Most learning platforms are good at suggesting *individual* courses, but bad at telling you what
order to actually do them in, or why a specific one is right for you. This app solves that. You
just type your goal like you're texting someone. It figures out your goal, level, and interests,
searches about 100 courses/projects/assessments by *meaning* — not keywords — and builds an
ordered roadmap that respects what needs to be learned first. Every recommendation comes with a
plain-language explanation grounded in real facts, not made up. And the whole thing runs on AI
that's hosted entirely on our own machine — nothing about your goal or your data is ever sent to
an outside company. If a course feels too easy or too hard, you tell it, and future
recommendations adjust to fit you better."

### If someone asks "what was hard about building this?"
Three honest, specific answers you can use:
1. "We found a real security hole — someone could trick the AI into praising a completely wrong
   course by hiding fake instructions in their own message. We built a defense for it and wrote
   an automated test that keeps checking it never comes back."
2. "Small, locally-run AI models are a lot less reliable than the big cloud ones — they sometimes
   send back malformed or slow responses. We built retry logic and graceful error handling so the
   app never just crashes when that happens; it politely says 'try again' instead."
3. "We stress-tested it with many simulated users hitting it at once, and found and fixed two real
   bugs that only showed up under that kind of load — one where a slow AI response could crash a
   page, and one where a security fix we added would have accidentally locked out real new users."

### If someone asks "why didn't you just use ChatGPT/OpenAI?"
"That was actually a hard requirement, not a choice we made lightly — everything had to run
locally, with zero cost and zero data ever leaving our own machine. It meant more engineering work
(the small local AI model needed more careful handling than a big cloud one would), but it's also
the thing that makes this project different from a typical 'wrapper around ChatGPT' entry."

---

## 6. If you only remember three things

1. **It turns "what should I learn?" into an actual ordered plan**, not just a list — that's the
   real problem it solves.
2. **Everything runs locally** — no outside AI company ever sees your data. This was a hard
   requirement, and it's the project's biggest differentiator.
3. **It's been genuinely tested, not just built** — 60 automated checks, including a real security
   fix and real load testing, back up every claim above.
