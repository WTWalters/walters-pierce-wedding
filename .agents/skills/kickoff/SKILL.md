---
name: kickoff
description: >-
  Start-of-session orientation for the Walters-Pierce wedding-website project. Spins up
  parallel subagents to review the codebase, the graphify knowledge graph, and the
  Obsidian project notes, reads the latest handoff notes, and presents ONE consolidated
  briefing on where the project stands. Use this whenever the user types /kickoff, or says
  things like "get me oriented", "catch me up", "spin up agents to review", "review the
  codebase / graph / Obsidian", "where are we on the wedding site", or otherwise wants a
  state-of-the-project summary at the start of a session — even if they don't say the word
  "kickoff". Prefer running this over ad-hoc exploration when the goal is orientation.
---

# Kickoff — orient fast at the start of a session

The goal is to reconstruct the full state of the project in one pass — what's shipped,
what's in flight, what's decided, and what's next — by reading the three places that hold
that knowledge (the code, the graph, the notes) **in parallel**, then synthesizing a single
briefing. This is the manual routine the project owner runs at the start of most sessions;
this skill makes it one command.

Do the work through subagents so their file-dumps don't fill the main context — you keep the
conclusions, not the raw reads.

## Step 1 — Dispatch three review subagents IN PARALLEL

Send all three Agent calls in a **single message** so they run concurrently. Suggested
prompts below — adapt as needed, but keep each agent's scope tight and ask for a structured,
concrete summary with `file:line` references (code) or note titles (Obsidian).

**Subagent A — Codebase review** (`Explore` agent, read-only, fast):
> Review the codebase at the project root (Next.js 15 wedding site: Prisma/PostgreSQL on
> Railway, NextAuth, Tailwind, Resend email, Cloudinary photos, Stripe registry). Medium-
> thorough. Report: (1) overall structure (public routes, admin area, API routes, key libs);
> (2) state of the major features — RSVP flow + review queue, guest management, photos,
> registry, email; (3) anything in-progress/half-wired/recently changed — check `git log`
> (last ~15 commits), `git status`, and any untracked files or `.worktrees/`; (4) obvious
> tech debt or TODO markers. Concise, structured, with file paths.

**Subagent B — Graphify graph review** (`general-purpose`):
> Check whether `graphify-out/graph.json` and `graphify-out/GRAPH_REPORT.md` exist at the
> project root. If they do: read GRAPH_REPORT.md and report the build date, the God Nodes,
> Surprising Connections, and any flagged gaps (ambiguous edges, isolated nodes). Compare the
> build date to the latest `git log` commit date and explicitly state whether the graph looks
> STALE (built before recent commits) — if so, note that `/graphify --update` would refresh
> it cheaply. If `graphify-out/` is absent, say so and note `/graphify` could build it. Do NOT
> rebuild the graph. Concise.

**Subagent C — Obsidian notes review** (`general-purpose`):
> Review the project's Obsidian notes in the vault folder
> `/Users/whitneywalters/Documents/second-brain/second-brain/Walters Pierce Wedding/`.
> First try the obsidian MCP tools (load via ToolSearch: "+obsidian"); if the Obsidian REST
> API is unreachable (connection refused), fall back to reading the folder directly with the
> filesystem/Bash tools — the notes are plain `.md` files. Identify: (1) which notes exist;
> (2) the MOST RECENT "Session Handoff — YYYY-MM-DD*.md" note (there are several — pick the
> latest by date) and summarize it fully; (3) any open decisions / next-session to-dos / UAT
> items pending. Do NOT modify any notes. Report the latest handoff's content + open threads.

## Step 2 — Read the handoff docs yourself (while the agents run)

In the same turn you dispatch the agents, read these directly (they're small and central):
- `CLAUDE_CODE_HANDOFF.md` — the original project brief (historical; the project is long past
  the "static HTML → Next.js" phase, so treat it as background, not a live to-do list).
- `AGENTS.md` — current project instructions / stack / design system.
- The auto-memory index at
  `~/.Codex/projects/-Users-whitneywalters-AIProgramming-walters-pierce-wedding/memory/MEMORY.md`
  and the notes it points to — this is the fastest source of "what's true now" (shipped
  features, decisions, gotchas). It is usually the single best orientation source; lead with it.

If a recalled memory names a file/flag/route, verify it still exists in the current code
before repeating it as fact — memories are point-in-time.

## Step 3 — Synthesize ONE briefing

When the agents report back, reconcile them (memory + notes describe intent and history; the
code is ground truth — if they disagree, trust the code and flag the drift). Then present a
single, skimmable briefing:

1. **Where the project stands** — what's live in prod, what's in flight, what's on a branch.
2. **Open threads / next steps** — from the latest handoff note + memory, in priority order.
3. **Anything needing a decision** — pending choices, UAT feedback to triage, risks.
4. **Notable drift** — where the graph/notes/memory are stale vs. the code (e.g. graph built
   before recent commits), so the owner knows what to trust.

Keep it tight — conclusions, not raw file listings. Offer to dig into whichever thread the
owner wants to work on next.

## Project-specific paths & conventions

- **Repo root:** `/Users/whitneywalters/AIProgramming/walters-pierce-wedding`
- **Obsidian vault:** `/Users/whitneywalters/Documents/second-brain/second-brain/Walters Pierce Wedding/`
  — handoff notes are `Session Handoff — YYYY-MM-DD*.md`; also `Operations Runbook.md`,
  `Lessons Learned.md`, `RSVP System.md`, `Email Infrastructure.md`, `Wedding Website - Overview.md`.
- **Graph:** `graphify-out/` (GRAPH_REPORT.md, graph.json). The `/graphify` skill can query
  (`/graphify query "…"`) or refresh (`/graphify --update`) it.
- **Design specs/plans:** `docs/superpowers/specs/` and `docs/superpowers/plans/` hold the
  brainstormed spec + implementation plan for each shipped feature — good for deep history.

## Gotchas (learned running this workflow)

- **Obsidian REST API is often not running** (connection refused on 127.0.0.1:27124). Don't
  stall on it — read the vault `.md` files directly instead.
- **Node version:** the shell may default to Node 16, which crashes Prisma 6. If the codebase
  agent needs to run prisma/build, it should `nvm use 22` first. (Read-only review usually
  doesn't need it.)
- **The graph and notes lag the code.** Always sanity-check their claims against `git log` and
  the actual files before presenting them as current.
