'use client'

import { useTc } from '@/lib/tc'

// Reusable confirmation dialog (plan Phase 1). Replaces the unstyled, blocking
// `window.confirm()` calls scattered through the admin + routing surfaces with the
// library's `tc-confirm-dialog`: a themed modal with a focus trap, scroll lock, and
// Escape/backdrop-to-cancel. The element is declarative (`open` attribute) and
// reports its outcome via the `tc-confirm` / `tc-cancel` CustomEvents — it does NOT
// self-close, so the caller flips `open` back off from its own state on either
// event. Events flow through the lib/tc.ts bridge (React can't subscribe to custom
// events through JSX `onX` props).

export function ConfirmDialog({
    open,
    title,
    message,
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    danger,
    onConfirm,
    onCancel,
}: {
    open: boolean
    title: string
    message?: string
    confirmLabel?: string
    cancelLabel?: string
    danger?: boolean
    onConfirm: () => void
    onCancel: () => void
}) {
    // Handlers are read live from the bridge's ref each render, so passing a fresh
    // object here is fine — listeners bind once on attach, not per render.
    const ref = useTc<HTMLElement>(undefined, {
        'tc-confirm': () => onConfirm(),
        'tc-cancel': () => onCancel(),
    })

    return (
        <tc-confirm-dialog
            ref={ref}
            open={open || undefined}
            dialog-title={title}
            message={message}
            confirm-label={confirmLabel}
            cancel-label={cancelLabel}
            danger={danger || undefined}
        />
    )
}
