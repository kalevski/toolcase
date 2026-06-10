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
