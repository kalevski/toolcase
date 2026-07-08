'use client'

// Destructive-delete confirmation (spec §4.4 danger zone): the user must type
// the item's name before Delete arms. Built on tc-modal the same way FormModal
// is (two stable direct children; footer buttons toggle disabled).

import { useState } from 'react'
import { useTc } from '@/lib/tc'
import { TextField } from './fields'

export function TypeToConfirmModal({
    title,
    prompt,
    expected,
    busy,
    onConfirm,
    onClose,
}: {
    title: string
    prompt: string
    /** The exact string the user must type (e.g. the transcription title). */
    expected: string
    busy: boolean
    onConfirm: () => void
    onClose: () => void
}) {
    const [typed, setTyped] = useState('')
    const armed = typed === expected

    const ref = useTc<HTMLElement>(undefined, {
        'tc-hidden': () => onClose(),
    })

    return (
        <tc-modal ref={ref} open title={title} centered static-backdrop={busy || undefined}>
            <div className="voxscribe-form">
                <p>{prompt}</p>
                <p>
                    Type <strong>{expected}</strong> to confirm.
                </p>
                <TextField value={typed} onValue={setTyped} ariaLabel="Confirmation text" placeholder={expected} />
            </div>
            <div slot="footer" className="voxscribe-form-footer">
                <tc-button variant="secondary" outline disabled={busy || undefined} onClick={onClose}>
                    Cancel
                </tc-button>
                <tc-button variant="danger" loading={busy || undefined} disabled={!armed || undefined} onClick={onConfirm}>
                    Delete
                </tc-button>
            </div>
        </tc-modal>
    )
}
