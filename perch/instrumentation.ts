// Next.js boot hook. Runs once per server start in the Node runtime — seeds the
// default realm and starts the background tickers (quota sweep, status poll).

export async function register(): Promise<void> {
    if (process.env.NEXT_RUNTIME === 'nodejs') {
        // Seed the default realm from env + backfill pre-realms rows before serving
        // (multiple_realms.md §2.2/§2.3), so every realm-aware path resolves a concrete realm.
        const { initDb } = await import('@/server/data/db')
        initDb()
        const { ensureSeed } = await import('@/server/services/realms')
        ensureSeed()

        // Byte-quota sweep ticker (§11, C1): measures each site's deployed size from its
        // realm and enforces the per-site cap, so quotas hold without a per-request poll.
        const { ensureQuotaSweepStarted } = await import('@/server/services/quota-sweep')
        ensureQuotaSweepStarted()

        // Resource-state poller (perch_better.md B1): persists disabled/at_risk/cert-failure
        // episodes per realm with audit attribution, so state history survives restarts.
        const { ensureStatusPollStarted } = await import('@/server/services/status-poll')
        ensureStatusPollStarted()
    }
}
