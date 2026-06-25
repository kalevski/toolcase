// Next.js boot hook. Runs once per server start in the Node runtime — starts the
// Sponsors GraphQL reconcile ticker (§8) so the authoritative sponsorship state
// self-heals missed/forged webhooks without any page/route having been hit first.

export async function register(): Promise<void> {
    if (process.env.NEXT_RUNTIME === 'nodejs') {
        const { ensureReconcileSchedulerStarted } = await import('@/server/services/sponsors-reconcile')
        ensureReconcileSchedulerStarted()
    }
}
