'use client'

// Status chip (spec §4.3): badge per status, with inline progress % while
// processing and queue position while pending.

import type { TranscriptionStatus } from '@/server/domain/types'
import type { BadgeVariant } from '@toolcase/web-components'

const VARIANT: Record<TranscriptionStatus, BadgeVariant> = {
    pending: 'secondary',
    processing: 'info',
    done: 'success',
    failed: 'danger',
}

export function StatusChip({
    status,
    progress,
    queuePosition,
}: {
    status: TranscriptionStatus
    progress?: number
    queuePosition?: number
}) {
    let label: string = status
    if (status === 'processing') label = `processing ${progress ?? 0}%`
    if (status === 'pending' && queuePosition) label = `#${queuePosition} in queue`
    // `text` attribute, not children — tc-badge re-parents its children on
    // connect, so React must never own text nodes inside it.
    return <tc-badge variant={VARIANT[status]} text={label} />
}

/** HTML-string form for tc-table render cells (values pre-escaped upstream). */
export function statusChipHtml(status: TranscriptionStatus, progress?: number, queuePosition?: number): string {
    let label: string = status
    if (status === 'processing') label = `processing ${progress ?? 0}%`
    if (status === 'pending' && queuePosition) label = `#${queuePosition} in queue`
    return `<span class="badge text-bg-${VARIANT[status]}">${label}</span>`
}
