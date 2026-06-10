// Canonical project-root CLAUDE.md (§8). A string module — not a file asset —
// so the Next standalone output always bundles it (no Dockerfile COPY needed).
// `{{PROJECT_NAME}}` is substituted at write time. The trailing version stamp
// lets a future migration tell template-managed files from hand-edited ones.

export const PROJECT_CLAUDE_MD = `# {{PROJECT_NAME}}

TaskForge project workspace. The agent runs at this root; every folder below is reachable.

## Layout

- \`repo/\`      — the cloned git repository. **Apply all code changes inside \`repo/\`.**
- \`tasks/\`     — queued task files managed by TaskForge. Do not edit task status lines.
- \`knowledge/\` — living documentation of the codebase. **Read \`knowledge/index.md\` first.**
- \`notes/\`     — free-form user notes. Read for context when relevant; edit only when asked.

## Rules

- Do not stage, commit, or push — TaskForge records task status and handles commits.
- Keep changes scoped to the task at hand.

<!-- taskforge-template v2 -->
`
