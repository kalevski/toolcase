// Project-wide "one Claude process" invariant (§mutual exclusion).
// The execution engine and the one-shot agent session manager must each refuse
// to start while the other runs. Importing each other directly would be a
// circular dependency, so the session manager registers its busy-check here and
// the engine reads it through this indirection. When the session-manager module
// has never been loaded, no session can be running — the check is a safe no-op.

import 'server-only'

let agentBusyCheck: ((project: string) => boolean) | null = null

/** Called once by the AgentSessionManager singleton at module init. */
export function registerAgentBusyCheck(check: (project: string) => boolean): void {
    agentBusyCheck = check
}

/** True when any one-shot agent session is running for the project. */
export function agentSessionsBusy(project: string): boolean {
    return agentBusyCheck ? agentBusyCheck(project) : false
}

// ── per-project mutation serializer ──────────────────────────────────────────
// Some task-file mutations (e.g. reorder) renumber/rename files on disk through
// fixed temp names and a read-then-renumber step; two concurrent requests for
// the same project would clobber each other. This promise-chain mutex serializes
// such mutations per project within the single process. (The engine run lock and
// single-process deployment already exclude the cross-process case.)

const projectChains = new Map<string, Promise<unknown>>()

export function withProjectLock<T>(project: string, fn: () => Promise<T>): Promise<T> {
    const prev = projectChains.get(project) ?? Promise.resolve()
    // Run fn after the previous op settles either way; one failure must not
    // poison the chain for the next caller.
    const next = prev.then(fn, fn)
    projectChains.set(
        project,
        next.then(
            () => {},
            () => {},
        ),
    )
    return next
}
