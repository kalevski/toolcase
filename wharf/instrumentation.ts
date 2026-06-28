// Next.js boot hook (experimental.instrumentationHook). Runs once per server
// start in the Node runtime. Opens the DB (runs migrations) eagerly so the schema
// is ready before any request. Later phases extend this to also start the
// in-process Agent API listener (Phase 5, planning §5) and the backup /
// audit-prune ticker (Phase 11, §8.7) — both via globalThis-cached `ensure*`
// helpers, dynamic-imported here inside the NEXT_RUNTIME==='nodejs' guard.

export async function register(): Promise<void> {
    if (process.env.NEXT_RUNTIME !== 'nodejs') return

    const { initDb } = await import('@/server/data/db')
    initDb()

    // Agent API listener on AGENT_PORT (planning §5) — the machine config server,
    // in this same process, sharing the DB + cipher + services.
    const { ensureAgentServerStarted } = await import('@/server/agent-server')
    ensureAgentServerStarted()

    // Backup + audit-prune ticker (planning §8.7). globalThis-cached so a dev
    // hot-reload doesn't start a second one.
    const { ensureBackupTickerStarted } = await import('@/server/services/backups')
    ensureBackupTickerStarted()
}
