// Transcription status machine (spec §4.2, §6.3) — pure guards + queue-position
// derivation. The worker and service consult these instead of hand-rolling
// status checks.

import type { TranscriptionStatus } from './types'

/** pending → processing → done | failed; failed → pending (retry). */
const LEGAL_TRANSITIONS: Record<TranscriptionStatus, TranscriptionStatus[]> = {
    pending: ['processing'],
    processing: ['done', 'failed', 'pending'], // → pending only via crash recovery
    done: [],
    failed: ['pending'], // retry
}

export function canTransition(from: TranscriptionStatus, to: TranscriptionStatus): boolean {
    return LEGAL_TRANSITIONS[from]?.includes(to) ?? false
}

/** Retry is only legal from `failed` (spec §4.2). */
export function canRetry(status: TranscriptionStatus): boolean {
    return status === 'failed'
}

/**
 * Delete is legal in any state except `processing` — the worker owns a running
 * job's media directory; deleting it out from under the engine corrupts the run.
 */
export function canDelete(status: TranscriptionStatus): boolean {
    return status !== 'processing'
}

/**
 * 1-based queue position of `id` among pending jobs ordered by creation
 * (oldest first — the claim order). Undefined when the id isn't pending.
 */
export function queuePosition(
    pendingIdsOldestFirst: string[],
    id: string,
): number | undefined {
    const idx = pendingIdsOldestFirst.indexOf(id)
    return idx === -1 ? undefined : idx + 1
}
