import type { Mailbox, Quota } from '../jmap/types'
import type { Branding } from '../api/session'
import { t } from '../i18n'
import { FolderNav } from './FolderNav'
import { QuotaBar } from './QuotaBar'

type FoldersProps = {
    open: boolean
    onClose: () => void
    mailboxes: Mailbox[]
    currentId: string | null
    quota: Quota | null
    onSelect: (id: string) => void
    onManage: (m: Mailbox) => void
    onCreate: () => void
}

export function FoldersSheet({
    open,
    onClose,
    mailboxes,
    currentId,
    quota,
    onSelect,
    onManage,
    onCreate,
}: FoldersProps) {
    return (
        <tc-bottom-sheet open={open} heading={t('folders.title')} snap="auto" ontc-sheet-close={onClose}>
            {open ? (
                <div className="wm-sheet">
                    <FolderNav
                        mailboxes={mailboxes}
                        currentId={currentId}
                        onSelect={onSelect}
                        onManage={onManage}
                        onCreate={onCreate}
                    />
                    <QuotaBar quota={quota} />
                </div>
            ) : null}
        </tc-bottom-sheet>
    )
}

type MoreProps = {
    open: boolean
    onClose: () => void
    branding: Branding
    address: string
    onSettings: () => void
    onShortcuts?: () => void
    onSignOut: () => void
}

function Row({ icon, label, danger, onPick }: { icon: string; label: string; danger?: boolean; onPick: () => void }) {
    return (
        <button type="button" className={`wm-more__row${danger ? ' wm-more__row--danger' : ''}`} onClick={onPick}>
            <tc-icon name={icon} size="18" decorative></tc-icon>
            <span className="wm-more__row-label">{label}</span>
            <tc-icon name="chevron-right" size="15" decorative></tc-icon>
        </button>
    )
}

/** The "more" sheet: who is signed in, then the account rows, the way the dashboard's more sheet is built. */
export function MoreSheet({ open, onClose, branding, address, onSettings, onSignOut }: MoreProps) {
    const standing = branding.known && branding.domain ? `${branding.name} · ${branding.domain}` : branding.name
    return (
        <tc-bottom-sheet open={open} heading={t('shell.more')} snap="auto" ontc-sheet-close={onClose}>
            {open ? (
                <div className="wm-more">
                    <div className="wm-more__identity">
                        <span className="wm-more__avatar" aria-hidden="true">
                            {address.slice(0, 1)}
                        </span>
                        <span className="wm-more__who">
                            <span className="wm-more__name">{address}</span>
                            <span className="wm-more__standing">{standing}</span>
                        </span>
                    </div>
                    <div className="wm-more__group">
                        <p className="wm-more__heading">{t('shell.account')}</p>
                        <div className="wm-more__rows">
                            <Row
                                icon="settings"
                                label={t('shell.settings')}
                                onPick={() => {
                                    onClose()
                                    onSettings()
                                }}
                            />
                            <Row
                                icon="log-out"
                                label={t('shell.signOut')}
                                danger
                                onPick={() => {
                                    onClose()
                                    onSignOut()
                                }}
                            />
                        </div>
                    </div>
                </div>
            ) : null}
        </tc-bottom-sheet>
    )
}
