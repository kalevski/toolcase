// Next.js boot hook (experimental.instrumentationHook). Runs once per server
// start in the Node runtime — starts the B3 schedule ticker so per-project cron
// schedules fire without any page/route having been touched first, and hardens
// the multi-account config-dir tree (owner-only perms) before any account is used.

export async function register(): Promise<void> {
    if (process.env.NEXT_RUNTIME === 'nodejs') {
        // Eager DB open + migrations, so boot fails fast on a bad schema/path
        // instead of on the first request that happens to touch the DB.
        const { initDb } = await import('@/server/data/db')
        initDb()
        const { ensureSchedulerStarted } = await import('@/server/services/scheduler')
        ensureSchedulerStarted()
        // Repair/lock the accounts tree to `0o700` — these dirs hold OAuth tokens.
        const { ensureAccountsDirSecure } = await import('@/server/services/accounts')
        await ensureAccountsDirSecure()
        // Same hardening for the saved git SSH keys tree (0700 dir, 0600 files).
        const { ensureGitKeysDirSecure } = await import('@/server/services/git-keys')
        await ensureGitKeysDirSecure()
    }
}
