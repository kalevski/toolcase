// Dashboard aggregates (spec §6.5): counts, minutes, disk usage, queue depth,
// note count, the live "processing now" card and recent items — scoped to the
// actor (standard users see their own; admins see everything).

import 'server-only'
import { config } from '@/server/config'
import * as trnRepo from '@/server/data/repositories/transcription-repo'
import * as noteRepo from '@/server/data/repositories/note-repo'
import { queuePosition } from '@/server/domain/transcription'
import type { Role, StatsResponse } from '@/server/domain/types'

export interface Actor {
    githubId: number
    login: string
    role: Role
}

export function stats(actor: Actor): StatsResponse {
    const ownerId = actor.role === 'admin' ? undefined : actor.githubId
    const agg = trnRepo.aggregates(ownerId)
    const { items } = trnRepo.list({ ownerId, limit: 10, offset: 0 })
    const pending = trnRepo.pendingIdsOldestFirst()
    const recent = items.map((item) =>
        item.status === 'pending' ? { ...item, queuePosition: queuePosition(pending, item.id) } : item,
    )
    return {
        totalTranscriptions: agg.total,
        minutesTranscribed: agg.minutes,
        queued: agg.queued,
        failed: agg.failed,
        diskUsedBytes: agg.diskUsedBytes,
        quotaBytes: actor.role === 'admin' ? null : config.userQuotaBytes,
        noteCount: noteRepo.count(ownerId),
        processing: trnRepo.currentProcessing(ownerId) ?? null,
        recent,
        recentNotes: noteRepo.recent(5, ownerId),
    }
}
