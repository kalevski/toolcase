// The transcription worker (spec §6.5, §7) — ticker triad: a globalThis
// singleton `unref()`d 5 s interval + an exported `tickOnce()` for tests.
// Job concurrency is 1 — a correctness rule, not a tuning knob (spec §2).

import 'server-only'
import fsp from 'node:fs/promises'
import { config } from '@/server/config'
import { tx } from '@/server/data/db'
import * as repo from '@/server/data/repositories/transcription-repo'
import * as fsMedia from '@/server/infrastructure/fs-media'
import * as ffmpeg from '@/server/infrastructure/ffmpeg'
import * as whisper from '@/server/infrastructure/whisper'
import { isPresent, modelPath } from '@/server/infrastructure/model-store'
import { slog } from '@/server/infrastructure/server-log'
import { publishJobUpdate } from '@/server/web/sse'
import { parseWhisperJson } from '@/server/domain/format'

const TICK_MS = 5_000

declare global {
    var __voxscribeWorker: { timer: NodeJS.Timeout | null; running: boolean } | undefined
}

function state() {
    if (!globalThis.__voxscribeWorker) globalThis.__voxscribeWorker = { timer: null, running: false }
    return globalThis.__voxscribeWorker
}

/**
 * Boot-time crash recovery (spec §4.2): any row stuck in `processing` is reset
 * to `pending` with the same field reset as retry. Runs BEFORE the worker starts.
 */
export function recoverStuckJobs(): void {
    const stuck = repo.stuckProcessingIds()
    for (const id of stuck) {
        repo.resetToPending(id)
        slog('warn', 'worker', `recovered stuck job ${id} (processing → pending)`)
    }
}

/** Boot preflight (spec §6.4): loudly log missing binaries; never block boot. */
export async function preflightBinaries(): Promise<void> {
    const checks: Array<[string, string, string[]]> = [
        ['ffmpeg', 'ffmpeg', ['-version']],
        ['ffprobe', 'ffprobe', ['-version']],
        ['whisper', config.whisperBin, ['--help']],
    ]
    for (const [label, bin, args] of checks) {
        const ok = await ffmpeg.binaryAvailable(bin, args)
        if (!ok) {
            slog('error', 'preflight', `${label} binary '${bin}' is not runnable — transcription jobs will fail until it is installed`)
        }
    }
}

export function ensureWorkerStarted(): void {
    const s = state()
    if (s.timer) return
    s.timer = setInterval(() => {
        void tickOnce().catch((err) => {
            slog('error', 'worker', `tick crashed: ${err instanceof Error ? err.message : String(err)}`)
        })
    }, TICK_MS)
    s.timer.unref()
    slog('info', 'worker', 'started (5s tick, concurrency 1)')
}

/** Progress mapping (spec §7): transcode 0–5%, whisper 5–98%, finalize 100. */
function mapWhisperPct(pct: number): number {
    return Math.min(98, 5 + Math.round(pct * 0.93))
}

function reportProgress(id: string, ownerId: number, pct: number): void {
    repo.setProgress(id, pct)
    publishJobUpdate({ id, ownerId, status: 'processing', progress: pct })
}

/**
 * One worker tick: claim the oldest pending job (tx) and run the pipeline:
 * stale-artifact cleanup → transcode → transcribe → read artifacts → FTS →
 * done. Any failure → failed with a terse operator-readable error,
 * log-and-continue. Exported for tests.
 */
export async function tickOnce(): Promise<void> {
    const s = state()
    if (s.running) return // concurrency 1
    const job = repo.claimOldestPending(new Date().toISOString())
    if (!job) return
    s.running = true

    const { id, ownerId } = job
    publishJobUpdate({ id, ownerId, status: 'processing', progress: 0 })
    slog('info', 'worker', `job ${id} claimed (model=${job.model}, lang=${job.language})`)

    const abort = new AbortController()
    const timeout = setTimeout(() => abort.abort(), config.jobTimeoutMs)

    try {
        // Stale artifacts from any earlier failed/timed-out/crashed attempt must
        // never bleed into this run (spec §4.2).
        await fsMedia.removeStaleArtifacts(id)

        if (!(await isPresent(job.model))) {
            throw new Error(`model missing: ${job.model}`)
        }

        // 1) transcode → 16 kHz mono WAV (progress 0–5%).
        const src = fsMedia.originalPath(id, job.mediaExt)
        const wav = fsMedia.wavPath(id)
        reportProgress(id, ownerId, 1)
        try {
            await ffmpeg.toWav16k(src, wav)
        } catch (err) {
            const tail = err instanceof ffmpeg.FfmpegError && err.stderrTail ? `: ${err.stderrTail}` : ''
            throw new Error(`ffmpeg: ${err instanceof Error ? err.message : 'transcode failed'}${tail}`.slice(0, 300))
        }
        reportProgress(id, ownerId, 5)

        // 2) whisper.cpp (progress 5–98%, stderr-parsed, SSE each step).
        try {
            await whisper.transcribe({
                wavPath: wav,
                modelPath: modelPath(job.model),
                language: job.language,
                translate: job.translate,
                outDir: fsMedia.mediaDir(id),
                threads: config.threads,
                onProgress: (pct) => reportProgress(id, ownerId, mapWhisperPct(pct)),
                signal: abort.signal,
            })
        } catch (err) {
            if (abort.signal.aborted) {
                throw new Error(`timeout after ${Math.round(config.jobTimeoutMs / 60000)}m`)
            }
            throw err
        }

        // 3) read artifacts, parse detected language, index FTS + mark done (one tx).
        const jsonRaw = await fsp.readFile(fsMedia.transcriptPath(id, 'json'), 'utf8').catch(() => '')
        const parsed = parseWhisperJson(jsonRaw)
        const text = (await fsp.readFile(fsMedia.transcriptPath(id, 'txt'), 'utf8').catch(() => '')).trim()

        tx(() => {
            repo.ftsInsert(id, text)
            repo.markDone(id, new Date().toISOString(), null, parsed.detectedLanguage)
        })
        publishJobUpdate({ id, ownerId, status: 'done', progress: 100 })
        slog('info', 'worker', `job ${id} done (detected=${parsed.detectedLanguage ?? '?'})`)
    } catch (err) {
        const message =
            err instanceof whisper.WhisperError
                ? `${err.message}${err.stderrTail ? `: ${err.stderrTail}` : ''}`.slice(0, 300)
                : err instanceof Error
                  ? err.message.slice(0, 300)
                  : 'unknown error'
        repo.markFailed(id, new Date().toISOString(), message)
        publishJobUpdate({ id, ownerId, status: 'failed', progress: 0, error: message })
        slog('error', 'worker', `job ${id} failed: ${message}`)
    } finally {
        clearTimeout(timeout)
        // The transcode intermediate goes either way (spec §6.5).
        await fsMedia.removeFile(fsMedia.wavPath(id)).catch(() => {})
        s.running = false
    }
}
