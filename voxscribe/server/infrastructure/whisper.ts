// whisper.cpp engine adapter (spec §6.4). Narrow typed interface so a second
// engine (hosted API, faster-whisper sidecar) is an additive adapter, not a
// rewrite. Spawns `whisper-cli` detached (its own process group) so the timeout
// kill sweeps any children; progress is parsed from stderr and throttled to
// ≥1% steps; detected language is parsed from the output JSON.

import 'server-only'
import { spawn } from 'node:child_process'
import fsp from 'node:fs/promises'
import path from 'node:path'
import { config } from '@/server/config'
import { parseWhisperJson } from '@/server/domain/format'

export interface TranscribeParams {
    wavPath: string
    modelPath: string
    /** 'auto' | ISO code. */
    language: string
    translate: boolean
    /** Directory receiving transcript.{txt,srt,vtt,json}. */
    outDir: string
    threads: number
    onProgress: (pct: number) => void
    signal: AbortSignal
}

export interface TranscribeResult {
    detectedLanguage: string | null
}

export class WhisperError extends Error {
    constructor(
        msg: string,
        public exitCode?: number,
        public stderrTail?: string,
    ) {
        super(msg)
        this.name = 'WhisperError'
    }
}

/** Kill the engine's whole process group (detached spawn → child leads a group). */
function killGroup(pid: number | undefined): void {
    if (!pid) return
    try {
        process.kill(-pid, 'SIGKILL')
    } catch {
        try {
            process.kill(pid, 'SIGKILL')
        } catch {
            /* already gone */
        }
    }
}

export async function transcribe(p: TranscribeParams): Promise<TranscribeResult> {
    const outPrefix = path.join(p.outDir, 'transcript')
    const args = [
        '-m', p.modelPath,
        '-f', p.wavPath,
        '-l', p.language,
        ...(p.translate ? ['-tr'] : []),
        '-otxt', '-osrt', '-ovtt', '-ojf',
        '-of', outPrefix,
        '-t', String(p.threads),
        '--print-progress',
    ]

    await new Promise<void>((resolve, reject) => {
        if (p.signal.aborted) {
            reject(new WhisperError('aborted before start'))
            return
        }
        const child = spawn(config.whisperBin, args, {
            stdio: ['ignore', 'ignore', 'pipe'],
            detached: true,
        })
        let stderr = ''
        let lastPct = -1
        let settled = false

        const onAbort = () => {
            if (settled) return
            settled = true
            killGroup(child.pid)
            reject(new WhisperError('aborted'))
        }
        p.signal.addEventListener('abort', onAbort, { once: true })

        child.stderr.on('data', (chunk: Buffer) => {
            const text = chunk.toString('utf8')
            stderr += text
            if (stderr.length > 8192) stderr = stderr.slice(-8192)
            // whisper.cpp prints `whisper_print_progress_callback: progress = NN%`
            // on stderr (5% granularity upstream). Throttle to ≥1% steps.
            const matches = text.match(/progress\s*=\s*(\d{1,3})%/g)
            if (matches) {
                const last = matches[matches.length - 1].match(/(\d{1,3})/)
                if (last) {
                    const pct = Math.min(100, Number(last[1]))
                    if (pct > lastPct) {
                        lastPct = pct
                        p.onProgress(pct)
                    }
                }
            }
        })
        child.on('error', (err) => {
            if (settled) return
            settled = true
            p.signal.removeEventListener('abort', onAbort)
            reject(new WhisperError(`whisper failed to start: ${err.message}`))
        })
        child.on('close', (code) => {
            if (settled) return
            settled = true
            p.signal.removeEventListener('abort', onAbort)
            if (code === 0) resolve()
            else reject(new WhisperError(`whisper exited ${code}`, code ?? undefined, stderr.slice(-400).trim()))
        })
    })

    // Detected language comes from the full-JSON artifact (`result.language`).
    try {
        const raw = await fsp.readFile(`${outPrefix}.json`, 'utf8')
        return { detectedLanguage: parseWhisperJson(raw).detectedLanguage }
    } catch {
        return { detectedLanguage: null }
    }
}
