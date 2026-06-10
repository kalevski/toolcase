// Next.js boot hook (experimental.instrumentationHook). Runs once per server
// start in the Node runtime — starts the B3 schedule ticker so per-project cron
// schedules fire without any page/route having been touched first.

export async function register(): Promise<void> {
    if (process.env.NEXT_RUNTIME === 'nodejs') {
        const { ensureSchedulerStarted } = await import('@/server/services/scheduler')
        ensureSchedulerStarted()
    }
}
