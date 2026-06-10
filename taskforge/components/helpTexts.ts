// All in-place guidance copy (§10) lives here — one module to edit, no
// scattered literals, trivially translatable later. Hints are one sentence;
// warnings (destructive/irreversible) render with variant="warning" where used.

export const helpTexts = {
    dashboard: {
        intro: 'Workflow: create a project from a git URL → describe work on its Agents page → review the generated tasks → Run executes each one with Claude → push the commits from Git.',
        empty: 'A project is a cloned repository plus its queued tasks, knowledge docs, and notes — create one from a git URL with the New-project button.',
    },
    overview: {
        how: 'How TaskForge works: 1) describe work on the Agents page — numbered task files land in tasks/; 2) review and reorder them on Tasks; 3) Run executes each task with Claude; 4) optionally commits per task; 5) push from Git.',
        claudeMd: 'Resets the root CLAUDE.md to the canonical TaskForge template that orients the agent to this workspace layout.',
    },
    tasks: {
        statuses: 'Pending tasks will run next; error tasks need a fix or a reset; done tasks are skipped unless you re-run with reset; needs-review means the reviewer doubted the result.',
        resetErrors: 'Moves every errored task back to pending so the next run retries them.',
        reRun: 'Starts a run scoped to just this task and reopens it in the ledger.',
        modelOverride: 'Overrides the run model for this task only.',
        newTask: 'Creates a numbered task file directly — no agent round-trip. Status starts as open.',
        importIssues: 'Each selected issue becomes a numbered task with a Source facet; when the task completes, TaskForge comments on and closes the issue.',
        reorder: 'Reorder pending tasks — files are renumbered; done/error tasks keep their numbers.',
        reorderActive: 'Move pending tasks with ↑/↓, then Save order to renumber the files.',
        archive: 'Moves done tasks to tasks/archive/ — out of the queue, kept on disk and in telemetry.',
        edit: 'Edit the task body. The Status/Error headers are server-owned and rewritten on save.',
        editStatusNote: 'The **Status:** and **Error:** lines are managed by TaskForge — whatever you type there is rewritten from the recorded state on save.',
        feedback: 'Appends your feedback (plus the previous error) to the task and resets it to pending — so the retry iterates instead of repeating.',
    },
    run: {
        filter: 'Filter matches a substring of the task file path; severity/project match comma-separated facets; resume-from skips ids that sort before the prefix.',
        warmSession: 'Reuses one Claude session across tasks — faster and cheaper, but context carries over.',
        commitAfter: 'Commits the working tree after each successful task (task name or AI message).',
        dryRun: 'Lists what would run without executing anything or touching task state.',
        reset: 'Re-runs everything: clears the completion ledger and reopens every task.',
        pushAfter: 'After a run that completes with zero errors and at least one done task, push the branch automatically.',
        branchPerRun: 'Creates taskforge/run-<id> before the first task — the run becomes a reviewable, disposable unit.',
        review: 'After each task, a cheap reviewer model judges whether the diff plausibly satisfies the task. Advisory only — a FAIL marks the task needs-review.',
        openPr: 'After a successful auto-push of a per-run branch, open a GitHub PR whose body lists the completed tasks.',
        schedule: 'Cron-style unattended runs of the pending queue — the engine already survives usage-limit walls by sleeping.',
        history: 'Every run is recorded: trigger, options, outcome, counts, duration, cost — with a replayable terminal.',
    },
    git: {
        pull: 'Pull is fast-forward-only — it refuses to create a merge commit.',
        discard: 'Discard is irreversible: it hard-resets tracked files and deletes untracked ones.',
        stash: 'Stash sets the working tree aside (including untracked files) so you can switch branches; pop restores it.',
        revert: 'Revert creates a new commit that undoes the selected one; conflicts surface here without touching anything else.',
        switchDirty: 'Commit or stash first — switching branches with a dirty tree is blocked.',
        commit: 'Stages everything and commits; pick a manual message or let Claude write one from the staged diff.',
    },
    notes: {
        storage: 'Notes live in notes/ at the project workspace root — outside the repo, never committed.',
        agentTarget: 'Pick a note to modify, or create a new one.',
        agent: 'Describe the change; the notes agent edits the selected note (or creates one) and may read repo/ and knowledge/ for context.',
        agentRunning: 'Notes agent is editing — manual saves are blocked.',
    },
    skills: {
        shared: 'Skills are shared read-only across all projects via each project’s .claude/skills symlink.',
    },
    knowledge: {
        edit: 'Knowledge docs are agent-authored but human-fixable — edits rebuild the index so summaries propagate.',
        newDoc: 'Creates a knowledge doc by hand; the index picks it up automatically.',
        busy: 'A run or the knowledge agent is writing — manual knowledge edits are blocked.',
    },
    settings: {
        intro: 'Per-project defaults that override the environment configuration. Empty/“use default” values fall back to the env value.',
        notify: 'Pick which events push a notification; Slack uses the global webhook, the JSON webhook is per-project.',
    },
    agents: {
        taskCreator: 'Splits your description into numbered task files in tasks/ — nothing is executed yet.',
        knowledgeWriter: 'Reads the repo and writes one source-anchored analysis doc into knowledge/.',
        custom: 'Custom agents are admin-defined: a prompt preamble, a target directory contract, and an optional post-processing hook.',
        history: 'Every accepted prompt is kept — reuse one from the history, or save it as a cross-project template.',
    },
    health: {
        intro: 'Environment checks for the failure modes that otherwise surface as opaque mid-run errors.',
        backup: 'The DB backup is a consistent online copy (VACUUM INTO). Project exports bundle tasks/knowledge/notes — repo/ is re-clonable.',
    },
    audit: {
        intro: 'Who did what: run controls, task mutations, git actions, agent starts, settings — newest first.',
    },
} as const
