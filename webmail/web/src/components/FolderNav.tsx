import type { Mailbox } from '../jmap/types'
import { t, type MessageKey } from '../i18n'

const ROLE_ORDER = ['inbox', 'drafts', 'sent', 'archive', 'junk', 'trash']

const ROLE_ICON: Record<string, string> = {
    inbox: 'inbox',
    drafts: 'file-pen',
    sent: 'send',
    archive: 'archive',
    junk: 'shield-alert',
    trash: 'trash-2',
}

const ROLE_LABEL: Record<string, MessageKey> = {
    inbox: 'folders.inbox',
    drafts: 'folders.drafts',
    sent: 'folders.sent',
    archive: 'folders.archive',
    junk: 'folders.junk',
    trash: 'folders.trash',
}

export function mailboxLabel(m: Mailbox): string {
    return m.role && ROLE_LABEL[m.role] && !m.parentId ? t(ROLE_LABEL[m.role]) : m.name
}

export type FolderNode = { mailbox: Mailbox; depth: number }

/** Mailboxes in display order: roles first, then by sortOrder/name, children under parents. */
export function orderedMailboxes(list: Mailbox[]): FolderNode[] {
    const children = new Map<string | null, Mailbox[]>()
    for (const m of list) {
        const parent = m.parentId && list.some((p) => p.id === m.parentId) ? m.parentId : null
        const arr = children.get(parent) ?? []
        arr.push(m)
        children.set(parent, arr)
    }
    const rank = (m: Mailbox) => {
        const i = m.role ? ROLE_ORDER.indexOf(m.role) : -1
        return i === -1 ? ROLE_ORDER.length : i
    }
    const sort = (arr: Mailbox[]) =>
        arr.sort(
            (a, b) =>
                rank(a) - rank(b) || a.sortOrder - b.sortOrder || a.name.localeCompare(b.name),
        )
    const out: FolderNode[] = []
    const walk = (parent: string | null, depth: number) => {
        for (const m of sort(children.get(parent) ?? [])) {
            out.push({ mailbox: m, depth })
            if (depth < 8) walk(m.id, depth + 1)
        }
    }
    walk(null, 0)
    return out
}

type Props = {
    mailboxes: Mailbox[]
    currentId: string | null
    onSelect: (id: string) => void
    onManage: (m: Mailbox) => void
    onCreate: () => void
}

export function FolderNav({ mailboxes, currentId, onSelect, onManage, onCreate }: Props) {
    const nodes = orderedMailboxes(mailboxes)
    const firstOwn = nodes.findIndex((n) => !n.mailbox.role)
    const system = firstOwn === -1 ? nodes : nodes.slice(0, firstOwn)
    const own = firstOwn === -1 ? [] : nodes.slice(firstOwn)

    const row = ({ mailbox: m, depth }: FolderNode) => {
        const active = m.id === currentId
        const unread = m.role === 'drafts' ? m.totalEmails : m.unreadEmails
        const label = mailboxLabel(m)
        const manageable = !m.role && (m.myRights?.mayRename !== false || m.myRights?.mayDelete !== false)
        return (
            <li key={m.id} className="wm-folders__item" style={{ paddingInlineStart: `${depth * 0.9}rem` }}>
                <button
                    type="button"
                    className={`wm-folders__link${active ? ' is-active' : ''}`}
                    aria-current={active ? 'page' : undefined}
                    onClick={() => onSelect(m.id)}
                >
                    <tc-icon name={ROLE_ICON[m.role ?? ''] ?? 'folder'} decorative></tc-icon>
                    <span className="wm-folders__name">{label}</span>
                    {unread > 0 ? (
                        <span className="wm-folders__count">
                            <tc-badge
                                variant={m.role === 'drafts' ? 'secondary' : 'primary'}
                                text={String(unread)}
                                aria-hidden="true"
                            ></tc-badge>
                            <span className="wm-sr-only">{t('folders.unread', { count: unread })}</span>
                        </span>
                    ) : null}
                </button>
                {manageable ? (
                    <tc-icon-button
                        icon="EllipsisVertical"
                        size="small"
                        label={`${t('folders.manage')}: ${label}`}
                        ontc-click={() => onManage(m)}
                    ></tc-icon-button>
                ) : null}
            </li>
        )
    }

    return (
        <nav className="wm-folders" aria-label={t('folders.title')}>
            <ul className="wm-folders__list">{system.map(row)}</ul>
            <div className="wm-folders__head">
                <span className="wm-folders__heading">{t('folders.title')}</span>
                <tc-icon-button icon="Plus" size="small" label={t('folders.new')} title={t('folders.new')} ontc-click={onCreate}></tc-icon-button>
            </div>
            {own.length > 0 ? (
                <ul className="wm-folders__list">{own.map(row)}</ul>
            ) : (
                <p className="wm-folders__empty">{t('folders.empty')}</p>
            )}
        </nav>
    )
}
