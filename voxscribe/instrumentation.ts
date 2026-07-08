// Next.js boot hook. Runs once per server start in the Node runtime:
// initDb → binary preflight (§6.4) → recover stuck jobs → start the worker
// ticker → start the orphan sweep.

export async function register(): Promise<void> {
    if (process.env.NEXT_RUNTIME === 'nodejs') {
        const { initDb } = await import('@/server/data/db')
        initDb()

        // Preflight: check ffmpeg/ffprobe/whisper-cli are runnable and log loudly
        // if not — a missing binary must surface at boot, not as a cryptic first-
        // job failure. Missing binaries don't prevent boot (library/notes remain
        // usable); jobs fail fast with a clear error until the operator fixes it.
        const { preflightBinaries } = await import('@/server/services/worker')
        await preflightBinaries()

        // Any row stuck in `processing` from a crash is reset to `pending`
        // (field reset identical to retry) BEFORE the worker starts.
        const { recoverStuckJobs, ensureWorkerStarted } = await import('@/server/services/worker')
        recoverStuckJobs()
        ensureWorkerStarted()

        // Orphaned-artifact sweep (daily + on boot): media dirs / note files
        // older than 24 h with no DB row, plus stale note-update temp files.
        const { ensureSweepStarted } = await import('@/server/services/sweep')
        ensureSweepStarted()
    }
}
