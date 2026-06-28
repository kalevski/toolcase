// Next.js boot hook. Runs once per server start in the Node runtime — starts the
// Sponsors GraphQL reconcile ticker (§8) so the authoritative sponsorship state
// self-heals missed/forged webhooks without any page/route having been hit first.

export async function register(): Promise<void> {
    if (process.env.NEXT_RUNTIME === 'nodejs') {
        // Seed the default realm from env + backfill pre-realms rows before serving
        // (multiple_realms.md §2.2/§2.3), so every realm-aware path resolves a concrete realm.
        const { initDb } = await import('@/server/data/db')
        initDb()
        const { ensureSeed } = await import('@/server/services/realms')
        ensureSeed()

        const { ensureReconcileSchedulerStarted } = await import('@/server/services/sponsors-reconcile')
        ensureReconcileSchedulerStarted()
    }
}
