import React from 'react'

export interface ConfirmDialogProps {
    open: boolean
    title?: React.ReactNode
    message?: React.ReactNode
    confirmLabel?: string
    cancelLabel?: string
    danger?: boolean
    onConfirm?: () => void
    onCancel?: () => void
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({ open, title = 'Confirm', message, confirmLabel = 'Yes', cancelLabel = 'Cancel', danger = false, onConfirm, onCancel }) => {
    React.useEffect(() => {
        if (!open) return
        const onKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onCancel?.()
            if (event.key === 'Enter') onConfirm?.()
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [open, onConfirm, onCancel])

    if (!open) return null
    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 9100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div role="dialog" aria-modal="true" style={{ minWidth: 360, maxWidth: 480, background: '#13161d', color: '#e6e8ec', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: 20, boxShadow: '0 16px 48px rgba(0,0,0,0.5)' }}>
                <h3 style={{ margin: '0 0 8px', fontSize: 18 }}>{title}</h3>
                {message && <div style={{ opacity: 0.8, marginBottom: 16 }}>{message}</div>}
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    <button type="button" onClick={onCancel} style={{ padding: '8px 14px', background: 'transparent', color: '#e6e8ec', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 6, cursor: 'pointer' }}>{cancelLabel}</button>
                    <button type="button" onClick={onConfirm} style={{ padding: '8px 14px', background: danger ? '#d23a3a' : '#6aa9ff', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}>{confirmLabel}</button>
                </div>
            </div>
        </div>
    )
}
