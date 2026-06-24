// Next.js boot hook (experimental.instrumentationHook). Runs once per server
// start in the Node runtime — starts the B3 schedule ticker so per-project cron
// schedules fire without any page/route having been touched first, and hardens
// the multi-account config-dir tree (owner-only perms) before any account is used.

export async function register(): Promise<void> {
    if (process.env.NEXT_RUNTIME === 'nodejs') {
        const { ensureSchedulerStarted } = await import('@/server/services/scheduler')
        ensureSchedulerStarted()
        // Repair/lock the accounts tree to `0o700` — these dirs hold OAuth tokens.
        const { ensureAccountsDirSecure } = await import('@/server/services/accounts')
        await ensureAccountsDirSecure()
    }
}
