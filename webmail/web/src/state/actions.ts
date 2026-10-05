// Conversation actions (archive, delete, move, junk, read/unread, star) as JMAP
// Email/set patches over every email of the selected threads.

import type { JmapClient } from '../api/jmap'
import { destroyEmails, patchEmails, type ThreadSummary } from '../api/mail'
import type { Email } from '../jmap/types'
import type { Roles } from './mail'

export type ActionKind =
    | 'archive'
    | 'delete'
    | 'deleteForever'
    | 'move'
    | 'junk'
    | 'notJunk'
    | 'read'
    | 'unread'
    | 'star'
    | 'unstar'

type Member = Pick<Email, 'id' | 'mailboxIds' | 'keywords'>

export type ActionTarget = { members: Member[]; face?: Member }

export function targetsFromThreads(threads: ThreadSummary[]): ActionTarget[] {
    return threads.map((t) => ({ members: t.members, face: t.email }))
}

/** Patch that moves one email out of `from` (or out of every non-Sent/Drafts mailbox) into `to`. */
function movePatch(
    m: Member,
    to: string,
    from: string | null,
    roles: Roles,
): Record<string, unknown> | null {
    if (from) {
        if (!m.mailboxIds[from] || from === to) return null
        return { [`mailboxIds/${from}`]: null, [`mailboxIds/${to}`]: true }
    }
    // No current folder (search results): leave Sent/Drafts copies where they are.
    const keep = new Set([roles.sent, roles.drafts].filter(Boolean) as string[])
    const ids = Object.keys(m.mailboxIds ?? {})
    if (ids.some((id) => keep.has(id))) return null
    if (ids.length === 1 && ids[0] === to) return null
    return { mailboxIds: { [to]: true } }
}

export async function runAction(
    jmap: JmapClient,
    kind: ActionKind,
    targets: ActionTarget[],
    roles: Roles,
    currentMailbox: string | null,
    moveTo?: string,
): Promise<void> {
    const patches: Record<string, Record<string, unknown>> = {}
    const all = targets.flatMap((t) => t.members)
    const move = (to: string | undefined, extra: Record<string, unknown> = {}) => {
        if (!to) throw new Error('missing folder')
        for (const m of all) {
            const p = movePatch(m, to, currentMailbox, roles)
            if (p) patches[m.id] = { ...p, ...extra }
        }
    }
    switch (kind) {
        case 'archive':
            move(roles.archive)
            break
        case 'delete':
            move(roles.trash)
            break
        case 'move':
            move(moveTo)
            break
        case 'junk':
            move(roles.junk, { 'keywords/$junk': true, 'keywords/$notjunk': null })
            break
        case 'notJunk':
            move(roles.inbox, { 'keywords/$junk': null, 'keywords/$notjunk': true })
            break
        case 'deleteForever': {
            const ids = currentMailbox
                ? all.filter((m) => m.mailboxIds[currentMailbox]).map((m) => m.id)
                : all.map((m) => m.id)
            await destroyEmails(jmap, ids)
            return
        }
        case 'read':
        case 'unread':
            for (const m of all) {
                const seen = !!m.keywords?.$seen
                if (kind === 'read' && !seen) patches[m.id] = { 'keywords/$seen': true }
                if (kind === 'unread' && seen) patches[m.id] = { 'keywords/$seen': null }
            }
            break
        case 'star':
            for (const t of targets) {
                const face = t.face ?? t.members[t.members.length - 1]
                if (face) patches[face.id] = { 'keywords/$flagged': true }
            }
            break
        case 'unstar':
            for (const m of all) if (m.keywords?.$flagged) patches[m.id] = { 'keywords/$flagged': null }
            break
    }
    await patchEmails(jmap, patches)
}

export function folderForAction(kind: ActionKind, roles: Roles): string | undefined {
    if (kind === 'archive') return roles.archive
    if (kind === 'delete') return roles.trash
    if (kind === 'junk') return roles.junk
    if (kind === 'notJunk') return roles.inbox
    return 'n/a'
}
