'use client'

import { type FormEvent, type ReactNode } from 'react'
import { useTc } from '@/lib/tc'

// Shared create/edit form modal (impl §10) — wraps `tc-modal` the way ConfirmDialog
// wraps `tc-confirm-dialog`. Every routing/admin entity form renders inside one of
// these instead of the old always-visible bottom form card.
//
// Relocation rules (tc-modal captures its children at connect and moves them into
// `.modal-body` / `.modal-footer`):
//   • The PARENT must mount this fresh per open — conditional render keyed on the
//     edit target (`key={editing ?? 'new'}`) — so slot capture always runs against
//     the right content and the form state resets for free.
//   • The modal has exactly TWO stable direct children (the <form> body and the
//     footer <div slot="footer">); all dynamic content lives INSIDE them, so React
//     never adds/removes a relocated child.
//   • Footer buttons stay mounted and toggle `disabled` — except `secondary`,
//     which appears only in flows (the proxies DNS retry) that re-key the modal.
//
// While `busy`, the backdrop goes static and Cancel is disabled — a mid-flight save
// must not be dismissed. Every close path (X, Escape, backdrop) lands in `onClose`
// via tc-modal's `tc-hidden`.

export interface FormModalSecondaryAction {
    label: string
    onClick: () => void
}

export function FormModal({
    title,
    busy,
    submitLabel,
    onSubmit,
    onClose,
    secondary,
    children,
}: {
    title: string
    busy: boolean
    submitLabel: string
    onSubmit: () => void
    onClose: () => void
    /** Optional extra footer action (e.g. "Save anyway (skip DNS check)"). */
    secondary?: FormModalSecondaryAction
    children: ReactNode
}) {
    const ref = useTc<HTMLElement>(undefined, {
        'tc-hidden': () => onClose(),
    })

    const submit = (e: FormEvent) => {
        e.preventDefault()
        onSubmit()
    }

    return (
        <tc-modal
            ref={ref}
            open
            title={title}
            size="lg"
            scrollable
            centered
            static-backdrop={busy || undefined}
        >
            <form className="perch-form" onSubmit={submit}>
                {children}
                {/* Hidden submit so Enter inside a field submits the form (the visible
                    submit button lives in the modal footer, outside the <form>). */}
                <button type="submit" hidden aria-hidden="true" tabIndex={-1} />
            </form>
            <div slot="footer" className="perch-form-footer">
                <tc-button variant="secondary" outline disabled={busy || undefined} onClick={onClose}>
                    Cancel
                </tc-button>
                {secondary && (
                    <tc-button
                        variant="warning"
                        outline
                        disabled={busy || undefined}
                        onClick={secondary.onClick}
                    >
                        {secondary.label}
                    </tc-button>
                )}
                <tc-button variant="primary" loading={busy || undefined} onClick={onSubmit}>
                    {submitLabel}
                </tc-button>
            </div>
        </tc-modal>
    )
}

/** A labelled group inside a FormModal body: uppercase heading + hairline separator. */
export function FormGroup({ title, children }: { title: string; children: ReactNode }) {
    return (
        <div className="perch-form-group">
            <div className="perch-form-group-title">{title}</div>
            {children}
        </div>
    )
}
