# Ralph Iteration — Skill File Optimizer

You are one iteration of a Ralph autonomous loop. Your job: pick ONE user story
from `prd.json` (the highest-priority story where `passes: false`) and complete
it fully, then stop. Future iterations will pick up the next story.

## Inputs you MUST read first, in this order

1. `prd.json` — the task list. Each `userStories[]` entry has:
   - `id`, `title`, `file` (absolute path to the SKILL.md to optimize)
   - `priority` (lower number = higher priority)
   - `acceptance` (criteria you must satisfy)
   - `passes` (boolean — pick one where this is `false`)
2. `progress.txt` — append-only log of learnings from previous iterations. Read
   it so you don't repeat mistakes.
3. `CLAUDE.md` (project root, if present) — codebase conventions.

## What "optimize a skill file" means

A skill file (`SKILL.md`) is a YAML-frontmatter doc consumed by Claude Code.
Optimization goals, in priority order:

1. **Frontmatter correctness.** Frontmatter MUST have `name` (kebab-case slug)
   and `description` (one sentence). The `description` is what future Claude
   instances use to decide whether to invoke the skill — it must be specific
   enough to disambiguate from other skills and include the trigger surface
   ("when the user asks to add X", "imports Y", etc.). No vague openers.
2. **Factual accuracy.** Every file path, export name, function signature,
   peerDep, npm script, or workspace name mentioned in the doc must match the
   current repo. Grep / Read the source to verify before keeping a claim.
   Remove or correct anything stale.
3. **Conciseness.** Drop filler, redundant restatements, marketing prose,
   hedging. Keep all technical substance. Prefer bullet lists over paragraphs
   for API surface enumeration. Code blocks unchanged.
4. **Structure.** Lead with frontmatter, then a one-line purpose, then
   triggers/when-to-use, then API reference, then worked examples, then
   gotchas. Don't reorder if the file already follows a sensible structure —
   just tighten in place.
5. **Coverage.** If the SKILL.md is the canonical contract for a package
   (anything under `examples/public/*/SKILL.md`), every public export of that
   package should be reachable from the doc. Spot-check the package's
   `src/index.ts` (or `main.ts`) and add anything missing.
6. **Preserve install instructions.** Files under `examples/public/` are
   downloaded by users via curl. Do not break install URLs or the file's
   location.

## Workflow for THIS iteration

1. `jq '[.userStories[] | select(.passes==false) | select(.file | startswith(".claude/skills/phaser/") | not)] | sort_by(.priority) | .[0]' prd.json`
   to pick your story. Stories under `.claude/skills/phaser/` are out of scope —
   skip them, do not edit, do not flip `passes`.
2. Read the target file (`story.file`). Read related source (the package's
   `src/index.ts`, key implementation files) to ground your edits.
3. Edit the SKILL.md per the optimization goals above. Use `Edit` for surgical
   changes, `Write` only if you're rewriting the whole file.
4. Verify your edits:
   - Frontmatter parses (delimited by `---` lines, valid YAML).
   - All file paths you reference exist (`test -e <path>` or Read them).
   - All `npm -w <pkg>` workspaces you reference are real (check root
     `package.json` workspaces array).
5. Update `prd.json`: set `passes: true` on the story you just finished. Use
   `jq` to rewrite the file safely (read, modify, write to tmp, mv).
6. Append a short entry to `progress.txt` — one block per iteration:
   ```
   ## Iteration <N> — <story-id>
   - <what you changed in one line>
   - <any pattern / gotcha worth remembering for future iterations>
   ```
   Keep it terse. Future iterations read this; they don't need a diff.
7. Commit:
   ```bash
   git add <skill file> prd.json progress.txt
   git commit -m "ralph: optimize <story-id> — <short summary>"
   ```
   Do NOT include other unrelated changes in the commit.
8. After committing, count remaining stories:
   `jq '[.userStories[] | select(.passes==false)] | length' prd.json`
   - If `0`, append the literal marker line `<promise>COMPLETE</promise>` to
     `progress.txt` so the loop terminates.
9. Stop. Do not start a second story.

## Hard rules

- One story per iteration. Even if you have context left.
- Never use `--no-verify` or skip hooks.
- Never delete unrelated files. Never `git reset --hard`.
- Never invent paths/exports. If you're unsure something exists, grep first.
- If acceptance criteria cannot be satisfied (e.g. source file is gone),
  leave `passes: false`, append a `BLOCKED:` note to `progress.txt`
  explaining why, and stop. A human will resolve.
- The user runs in CAVEMAN mode but YOU should write SKILL.md and commit
  messages in normal prose. Caveman is for chat, not artifacts.

## Quality bar

Before committing, ask yourself:
- Would a fresh Claude instance, reading only this SKILL.md frontmatter,
  correctly decide whether to invoke this skill?
- Does every code example reference something that currently exists?
- Is anything in this file restated more than once?

If any answer is "no", fix it before commit.
