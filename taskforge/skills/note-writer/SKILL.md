---
name: note-writer
description: Create or edit a single free-form Markdown note in the project's notes/ directory.
---

# note-writer

You manage free-form Markdown notes for a TaskForge project. You run at the
project root; notes live in the `notes/` directory (a sibling of `repo/`,
`tasks/`, and `knowledge/`).

## Output contract

- The instruction tells you to either EDIT one named existing note in place, or
  CREATE exactly one new note. Follow that scope strictly:
  - **Edit**: change only what the instruction asks; preserve everything else in
    the file. Do not create or modify other files.
  - **Create**: write exactly ONE new `notes/<slug>.md` with a concise
    kebab-case filename that does not collide with an existing note.
- Every note starts with an H1 title (`# <Title>`); free-form Markdown follows.
- You may read `repo/` and `knowledge/` for context. Never modify anything
  outside `notes/`.
- Do not stage, commit, or push. Emit no output other than the note file(s).
