// ffmpeg/ffprobe adapter (spec §6.4): decode validation via `probe()` and the
// 16 kHz mono WAV transcode whisper.cpp expects via `toWav16k()`. Both spawn
// child processes with hard timeouts; failures carry a stderr tail for the
// operator-readable `error` column.

import 'server-only'
import { spawn } from 'node:child_process'

const PROBE_TIMEOUT_MS = 30_000
const TRANSCODE_TIMEOUT_MS = 15 * 60_000
const STDERR_TAIL_CHARS = 400

export class FfmpegError extends Error {
    constructor(
        message: string,
        public stderrTail?: string,
    ) {
        super(message)
        this.name = 'FfmpegError'
    }
}

interface RunResult {
    stdout: string
    stderrTail: string
}

function run(bin: string, args: string[], timeoutMs: number): Promise<RunResult> {
    return new Promise((resolve, reject) => {
        const child = spawn(bin, args, { stdio: ['ignore', 'pipe', 'pipe'] })
        let stdout = ''
        let stderr = ''
        let settled = false

        const timer = setTimeout(() => {
            if (settled) return
            settled = true
            child.kill('SIGKILL')
            reject(new FfmpegError(`${bin} timed out after ${Math.round(timeoutMs / 1000)}s`))
        }, timeoutMs)

        child.stdout.on('data', (chunk: Buffer) => {
            stdout += chunk.toString('utf8')
        })
        child.stderr.on('data', (chunk: Buffer) => {
            stderr += chunk.toString('utf8')
            if (stderr.length > 8192) stderr = stderr.slice(-8192)
        })
        child.on('error', (err) => {
            if (settled) return
            settled = true
            clearTimeout(timer)
            reject(new FfmpegError(`${bin} failed to start: ${err.message}`))
        })
        child.on('close', (code) => {
            if (settled) return
            settled = true
            clearTimeout(timer)
            const stderrTail = stderr.slice(-STDERR_TAIL_CHARS).trim()
            if (code === 0) resolve({ stdout, stderrTail })
            else reject(new FfmpegError(`${bin} exited ${code}`, stderrTail))
        })
    })
}

export interface ProbeResult {
    durationSeconds: number | null
    hasAudio: boolean
    codec: string | null
}

/** `ffprobe -print_format json` on the stored file — the TRUE upload validation (§4.1). */
export async function probe(filePath: string): Promise<ProbeResult> {
    const { stdout } = await run(
        'ffprobe',
        ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', filePath],
        PROBE_TIMEOUT_MS,
    )
    let doc: {
        format?: { duration?: string }
        streams?: Array<{ codec_type?: string; codec_name?: string }>
    }
    try {
        doc = JSON.parse(stdout)
    } catch {
        throw new FfmpegError('ffprobe produced unparseable output')
    }
    const audio = (doc.streams ?? []).find((s) => s.codec_type === 'audio')
    const duration = doc.format?.duration ? Number(doc.format.duration) : NaN
    return {
        durationSeconds: Number.isFinite(duration) ? duration : null,
        hasAudio: Boolean(audio),
        codec: audio?.codec_name ?? null,
    }
}

/** Transcode to the 16 kHz mono PCM WAV whisper.cpp expects (spec §7). */
export async function toWav16k(src: string, dst: string): Promise<void> {
    await run(
        'ffmpeg',
        ['-y', '-i', src, '-vn', '-ar', '16000', '-ac', '1', '-c:a', 'pcm_s16le', dst],
        TRANSCODE_TIMEOUT_MS,
    )
}

/** Boot preflight helper: `<bin> -version` runs and exits 0. */
export async function binaryAvailable(bin: string, args: string[] = ['-version']): Promise<boolean> {
    try {
        await run(bin, args, 10_000)
        return true
    } catch {
        return false
    }
}
