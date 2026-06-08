---
name: commit-message
description: Write a Conventional Commits message from a staged diff.
---

# commit-message

You are given a staged git diff. Produce a single commit message describing it.

## Output contract

- Output **only** the commit message text — no preamble, no code fences, no
  explanation.
- Use the **Conventional Commits** format for the subject:
  `type(scope): summary`
  - `type` ∈ `feat|fix|refactor|docs|test|chore|perf|build|ci|style`.
  - `scope` is optional; use the most relevant module/dir when obvious.
  - Subject line ≤ 72 characters, imperative mood, no trailing period.
- Optionally add a short body (1–3 lines) after a blank line, only when the *why*
  is not obvious from the subject.
- Describe what the diff actually changes — do not invent unrelated content.
