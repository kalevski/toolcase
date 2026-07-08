// Model manager service (spec §6.5): catalog + local state + in-flight download
// progress, admin-gated download/delete, and `resolveModelForJob` (allowed ∩
// present) for the upload form.

import 'server-only'
import { config } from '@/server/config'
import * as store from '@/server/infrastructure/model-store'
import * as repo from '@/server/data/repositories/transcription-repo'
import { slog } from '@/server/infrastructure/server-log'
import type { ModelInfo } from '@/server/domain/types'

export { ModelStoreError } from '@/server/infrastructure/model-store'

/** Catalog + disk state + in-flight download pct — `GET /api/models` (spec §8). */
export async function listModels(): Promise<ModelInfo[]> {
    const local = await store.listLocal()
    const downloading = store.downloadProgress()
    return store.CATALOG.map((entry) => {
        const disk = local.find((m) => m.name === entry.name)
        const pct = downloading.get(entry.name)
        return {
            name: entry.name,
            sizeBytes: entry.sizeBytes,
            ramHint: entry.ramHint,
            allowed: config.allowedModels.includes(entry.name),
            present: disk?.present ?? false,
            ...(disk?.diskBytes !== undefined ? { diskBytes: disk.diskBytes } : {}),
            ...(pct !== undefined ? { downloading: pct } : {}),
        }
    })
}

/** Models the upload form may offer: allow-list ∩ present-on-disk (spec §5.4). */
export async function resolveModelsForJob(): Promise<string[]> {
    const local = await store.listLocal()
    return config.allowedModels.filter((name) => local.some((m) => m.name === name && m.present))
}

/**
 * Kick off a model download in the background and return immediately — the
 * blob is up to 1.5 GB, far beyond a sane request lifetime. Progress is polled
 * via `GET /api/models`. Throws 409 when the same model is already in flight.
 */
export function startDownload(name: string): void {
    const entry = store.catalogEntry(name)
    if (!entry) throw new store.ModelStoreError(`unknown model '${name}'`, 404)
    if (store.downloadProgress().has(name)) {
        throw new store.ModelStoreError(`model '${name}' is already downloading`, 409)
    }
    void store
        .download(name)
        .then(() => slog('info', 'models', `model ${name} downloaded`))
        .catch((err) => {
            slog('error', 'models', `model ${name} download failed: ${err instanceof Error ? err.message : err}`)
        })
}

/** Delete a model blob; refused while a processing job uses it (spec §6.5). */
export async function deleteModel(name: string): Promise<void> {
    if (repo.modelInUse(name)) {
        throw new store.ModelStoreError(`model '${name}' is in use by a running job`, 409)
    }
    if (store.downloadProgress().has(name)) {
        throw new store.ModelStoreError(`model '${name}' is downloading`, 409)
    }
    await store.removeModel(name)
}
