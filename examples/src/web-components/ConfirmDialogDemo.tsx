import React, { useRef, useState, useEffect } from 'react'

type ConfirmVariant = {
    key: string
    sectionTitle: string
    description: string
    dialogTitle: string
    eyebrow?: string
    message?: string
    confirmLabel?: string
    cancelLabel?: string
    danger?: boolean
}

const VARIANTS: ConfirmVariant[] = [
    {
        key: 'default',
        sectionTitle: 'default — primary confirm',
        description:
            'Yes/no confirmation. Press Enter to confirm, Escape or the backdrop to cancel.',
        dialogTitle: 'Publish this release?',
        eyebrow: 'Confirm',
        message: 'This will make version 2.4.0 available to everyone. You can roll back later.',
        confirmLabel: 'Publish',
    },
    {
        key: 'danger',
        sectionTitle: 'danger — destructive confirm',
        description: 'The danger attribute paints the confirm button red and tints the eyebrow.',
        dialogTitle: 'Delete this project?',
        eyebrow: 'Destructive',
        message: 'This permanently removes the project and all of its data. This cannot be undone.',
        confirmLabel: 'Delete project',
        cancelLabel: 'Keep it',
        danger: true,
    },
    {
        key: 'minimal',
        sectionTitle: 'minimal — title only',
        description: 'Omit eyebrow and message for a compact prompt with just a title.',
        dialogTitle: 'Discard changes?',
        eyebrow: '',
        confirmLabel: 'Discard',
        cancelLabel: 'Cancel',
    },
]

const ConfirmDialogDemo: React.FC = () => {
    const [openKey, setOpenKey] = useState<string | null>(null)
    const [lastResult, setLastResult] = useState<string>('—')
    const refs = useRef<Record<string, HTMLElement | null>>({})

    useEffect(() => {
        const cleanups: Array<() => void> = []
        VARIANTS.forEach((v) => {
            const el = refs.current[v.key]
            if (!el) return
            const onConfirm = () => {
                setLastResult(`Confirmed: ${v.dialogTitle}`)
                setOpenKey(null)
            }
            const onCancel = () => {
                setLastResult(`Cancelled: ${v.dialogTitle}`)
                setOpenKey(null)
            }
            el.addEventListener('tc-confirm', onConfirm)
            el.addEventListener('tc-cancel', onCancel)
            cleanups.push(() => {
                el.removeEventListener('tc-confirm', onConfirm)
                el.removeEventListener('tc-cancel', onCancel)
            })
        })
        return () => cleanups.forEach((fn) => fn())
    }, [])

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="Confirm Dialog"
                            description="Centred yes/no confirmation modal with focus trap and keyboard handling. Controlled component — fires tc-confirm or tc-cancel; set open to false in the handler to close."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Web Components
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-4 mt-4">
                            <tc-section-card title="last action">
                                <code>{lastResult}</code>
                            </tc-section-card>

                            {VARIANTS.map((v) => (
                                <tc-section-card key={v.key} title={v.sectionTitle}>
                                    <p className="text-muted mb-3">{v.description}</p>
                                    <button
                                        className={`btn ${v.danger ? 'btn-danger' : 'btn-primary'}`}
                                        onClick={() => setOpenKey(v.key)}
                                    >
                                        {v.confirmLabel ?? 'Confirm'}…
                                    </button>
                                    {/* @ts-ignore */}
                                    <tc-confirm-dialog
                                        ref={(el: HTMLElement | null) => {
                                            refs.current[v.key] = el
                                        }}
                                        open={openKey === v.key || undefined}
                                        dialog-title={v.dialogTitle}
                                        eyebrow={v.eyebrow}
                                        message={v.message}
                                        confirm-label={v.confirmLabel}
                                        cancel-label={v.cancelLabel}
                                        danger={v.danger || undefined}
                                    />
                                </tc-section-card>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default ConfirmDialogDemo
