import { t } from '../i18n'
import { useMail } from '../state/mail'
import { Dialog } from './Dialog'
import { mailboxLabel, orderedMailboxes } from './FolderNav'

export function MoveDialog({
    open,
    currentId,
    onPick,
    onClose,
}: {
    open: boolean
    currentId: string | null
    onPick: (mailboxId: string) => void
    onClose: () => void
}) {
    const { mailboxes } = useMail()
    const nodes = orderedMailboxes(mailboxes).filter(
        (n) => n.mailbox.id !== currentId && n.mailbox.role !== 'drafts' && n.mailbox.myRights?.mayAddItems !== false,
    )
    return (
        <Dialog open={open} title={t('action.moveTitle')} onClose={onClose} size="sm">
            <ul className="wm-pick-list">
                {nodes.map(({ mailbox: m, depth }) => (
                    <li key={m.id}>
                        <button
                            type="button"
                            className="wm-pick-list__item"
                            style={{ paddingInlineStart: `${0.75 + depth * 0.9}rem` }}
                            onClick={() => onPick(m.id)}
                        >
                            <tc-icon name="folder" decorative></tc-icon>
                            {mailboxLabel(m)}
                        </button>
                    </li>
                ))}
            </ul>
        </Dialog>
    )
}
