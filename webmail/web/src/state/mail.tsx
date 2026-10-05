import { createContext, useContext } from 'react'
import type { JmapClient } from '../api/jmap'
import type { Prefs, SessionInfo } from '../api/session'
import type { Identity, Mailbox } from '../jmap/types'
import type { ComposeInit } from '../components/compose/types'

export type Roles = {
    inbox?: string
    drafts?: string
    sent?: string
    junk?: string
    trash?: string
    archive?: string
}

export type MailCtx = {
    session: SessionInfo
    jmap: JmapClient
    prefs: Prefs
    updatePrefs: (patch: Partial<Prefs>) => Promise<void>
    mailboxes: Mailbox[]
    roles: Roles
    refreshMailboxes: () => Promise<void>
    identities: Identity[]
    refreshIdentities: () => Promise<void>
    openCompose: (init: ComposeInit) => void
    announce: (message: string) => void
    /** Bumped whenever the server reports a mail change; lists refetch on it. */
    changeTick: number
    notifyChanged: () => void
}

export const MailContext = createContext<MailCtx | null>(null)

export function useMail(): MailCtx {
    const ctx = useContext(MailContext)
    if (!ctx) throw new Error('useMail outside MailApp')
    return ctx
}
