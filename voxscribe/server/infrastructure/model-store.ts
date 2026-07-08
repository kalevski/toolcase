// ggml model store (spec §6.4): catalog (name → Hugging Face URL + size),
// local presence, and downloads that stream to `<file>.part`, optionally verify
// a pinned sha256, then rename into place. An in-memory in-flight map rejects a
// second concurrent download of the same model and exposes progress for the
// models API to report (§8). Keeps multi-GB blobs out of the Docker image.

import 'server-only'
import crypto from 'node:crypto'
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { config } from '@/server/config'

export class ModelStoreError extends Error {
    constructor(
        message: string,
        public status: number = 500,
    ) {
        super(message)
        this.name = 'ModelStoreError'
    }
}

export interface CatalogEntry {
    name: string
    url: string
    /** Expected download size in bytes (approximate; display + sanity check). */
    sizeBytes: number
    /** Approximate peak RAM (display only, spec §2). */
    ramHint: string
    /**
     * Pinned sha256 of the blob, when the operator wants integrity verification.
     * Upstream re-publishes models without a stable hash manifest, so entries
     * ship unpinned (null = size sanity check only, logged).
     */
    sha256: string | null
}

const HF = 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main'

/** The model tiers voxscribe knows about. `large` is deliberately absent (§2). */
export const CATALOG: CatalogEntry[] = [
    { name: 'tiny', url: `${HF}/ggml-tiny.bin`, sizeBytes: 77_691_713, ramHint: '~273 MB', sha256: null },
    { name: 'base', url: `${HF}/ggml-base.bin`, sizeBytes: 147_951_465, ramHint: '~388 MB', sha256: null },
    { name: 'small', url: `${HF}/ggml-small.bin`, sizeBytes: 487_601_967, ramHint: '~852 MB', sha256: null },
    { name: 'medium', url: `${HF}/ggml-medium.bin`, sizeBytes: 1_533_763_059, ramHint: '~2.1 GB', sha256: null },
]

export function catalogEntry(name: string): CatalogEntry | undefined {
    return CATALOG.find((m) => m.name === name)
}

/** `${VOXSCRIBE_MODEL_DIR}/ggml-<name>.bin`. */
export function modelPath(name: string): string {
    if (!/^[a-z0-9.-]+$/.test(name)) throw new ModelStoreError(`invalid model name '${name}'`, 400)
    return path.join(config.modelDir, `ggml-${name}.bin`)
}

export interface LocalModel {
    name: string
    present: boolean
    diskBytes?: number
}

/** On-disk state for every catalog model. */
export async function listLocal(): Promise<LocalModel[]> {
    const out: LocalModel[] = []
    for (const entry of CATALOG) {
        try {
            const stat = await fsp.stat(modelPath(entry.name))
            out.push({ name: entry.name, present: true, diskBytes: stat.size })
        } catch {
            out.push({ name: entry.name, present: false })
        }
    }
    return out
}

export async function isPresent(name: string): Promise<boolean> {
    try {
        await fsp.stat(modelPath(name))
        return true
    } catch {
        return false
    }
}

// ── in-flight download tracking ───────────────────────────────────────────────
// globalThis so Next dev hot-reload keeps one map; single-process by design.

declare global {
    var __voxscribeModelDownloads: Map<string, number> | undefined
}

function inflight(): Map<string, number> {
    if (!globalThis.__voxscribeModelDownloads) globalThis.__voxscribeModelDownloads = new Map()
    return globalThis.__voxscribeModelDownloads
}

/** In-flight download progress (0–100) per model name. */
export function downloadProgress(): ReadonlyMap<string, number> {
    return inflight()
}

/**
 * Download a catalog model: stream to `<file>.part`, verify the pinned sha256
 * when present, rename into place. Throws 409 when the same model is already
 * downloading. `onProgress` is optional — progress is also readable via
 * {@link downloadProgress} (the API polls it).
 */
export async function download(name: string, onProgress?: (pct: number) => void): Promise<void> {
    const entry = catalogEntry(name)
    if (!entry) throw new ModelStoreError(`unknown model '${name}'`, 404)
    const map = inflight()
    if (map.has(name)) throw new ModelStoreError(`model '${name}' is already downloading`, 409)

    const dest = modelPath(name)
    const part = `${dest}.part`
    map.set(name, 0)
    try {
        await fsp.mkdir(path.dirname(dest), { recursive: true })
        const res = await fetch(entry.url, { redirect: 'follow' })
        if (!res.ok || !res.body) {
            throw new ModelStoreError(`model download failed: HTTP ${res.status}`, 502)
        }
        const total = Number(res.headers.get('content-length')) || entry.sizeBytes
        const hash = crypto.createHash('sha256')
        let received = 0

        const source = Readable.fromWeb(res.body as any)
        source.on('data', (chunk: Buffer) => {
            hash.update(chunk)
            received += chunk.length
            const pct = total > 0 ? Math.min(99, Math.floor((received / total) * 100)) : 0
            map.set(name, pct)
            onProgress?.(pct)
        })
        await pipeline(source, fs.createWriteStream(part, { flags: 'w' }))

        if (entry.sha256) {
            const digest = hash.digest('hex')
            if (digest !== entry.sha256) {
                await fsp.rm(part, { force: true })
                throw new ModelStoreError(`model '${name}' failed hash verification`, 502)
            }
        }
        await fsp.rename(part, dest)
        map.set(name, 100)
        onProgress?.(100)
    } catch (err) {
        await fsp.rm(part, { force: true }).catch(() => {})
        throw err
    } finally {
        map.delete(name)
    }
}

export async function removeModel(name: string): Promise<void> {
    if (!catalogEntry(name)) throw new ModelStoreError(`unknown model '${name}'`, 404)
    await fsp.rm(modelPath(name), { force: true })
}
