import { t } from '../i18n'

type Props = {
    open: boolean
    title: string
    message?: string
    confirmLabel: string
    danger?: boolean
    onConfirm: () => void
    onCancel: () => void
}

export function ConfirmDialog({ open, title, message, confirmLabel, danger, onConfirm, onCancel }: Props) {
    return (
        <tc-confirm-dialog
            open={open}
            dialog-title={title}
            eyebrow=""
            message={message}
            confirm-label={confirmLabel}
            cancel-label={t('common.cancel')}
            danger={danger}
            ontc-confirm={onConfirm}
            ontc-cancel={onCancel}
        ></tc-confirm-dialog>
    )
}
