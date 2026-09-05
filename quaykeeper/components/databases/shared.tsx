'use client'

import { useState } from 'react'
import { FormModal, FormGroup } from '@/components/FormModal'
import { TextField } from '@/components/fields'

// Shared plumbing for the Databases pages (quaykeeper_database_management.md §9).
// The maintainer gate + page frame + API helper are identical to the Config
// subsystem's, so they are re-exported under local names rather than copied —
// both surfaces sit behind the same `maintainer` rank.
export {
    useConfigData as useDbData,
    ConfigPage as DbPage,
    callApi,
    json,
    type ConfigDataState,
    type ApiResult,
} from '@/components/config/shared'

/** Format a live-read timestamp for the "read from server at …" caption. */
export function fmtReadAt(date: Date): string {
    return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

/**
 * Human message for a failed db-server API call. Driver failures (502
 * `db_driver_error`) carry the engine's own message in `detail` — surface it,
 * because "refused or timed out" alone is undebuggable; other codes fall through
 * to the caller's specific mapping via the raw code.
 */
export function describeDriverError(res: { message?: string; body?: unknown }): string {
    const detail = (res.body as { detail?: string } | null | undefined)?.detail
    if (res.message === 'db_driver_error') {
        return detail
            ? `The database server reported: ${detail}`
            : 'The database server refused or timed out — check its health on the DB Servers admin page.'
    }
    return res.message ?? 'error'
}

/**
 * Type-the-name destructive confirmation (§9): the confirm button stays disabled
 * until the exact target name is typed. Used for drop-database/drop-user — a
 * plain two-button dialog is too easy to click through for a data-destroying op.
 */
export function TypeToConfirmModal({
    title,
    verb,
    name,
    message,
    busy,
    onConfirm,
    onClose,
}: {
    title: string
    /** The action word on the (danger) submit button, e.g. "Drop database". */
    verb: string
    /** The exact name the user must type. */
    name: string
    message: string
    busy?: boolean
    onConfirm: () => void
    onClose: () => void
}) {
    const [typed, setTyped] = useState('')
    const match = typed.trim() === name

    return (
        <FormModal
            title={title}
            busy={!!busy}
            submitLabel={verb}
            // Submit no-ops until the typed name matches; the mismatch error below
            // explains why (FormModal's `busy` also locks Cancel, so it can't gate this).
            onSubmit={() => {
                if (match && !busy) onConfirm()
            }}
            onClose={onClose}
        >
            <tc-banner variant="error">{message}</tc-banner>
            <FormGroup title="Confirm">
                <TextField
                    label={`Type “${name}” to confirm`}
                    placeholder={name}
                    value={typed}
                    onValue={setTyped}
                    state={typed && !match ? 'invalid' : undefined}
                    error={typed && !match ? 'Name does not match.' : undefined}
                />
            </FormGroup>
        </FormModal>
    )
}
