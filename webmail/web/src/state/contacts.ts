// Address autocomplete from history only (no address book in v1): the
// correspondents of recent Inbox and Sent mail, ranked by frequency, cached in
// memory and (best effort) in localStorage per mailbox.

import type { JmapClient } from '../api/jmap'
import { getRecentAddresses } from '../api/mail'
import type { EmailAddress } from '../jmap/types'
import { readStore, writeStore } from '../util/storage'

type Entry = { name: string | null; email: string; count: number }

let entries: Entry[] = []
let loadedFor = ''
let loading: Promise<void> | null = null

const key = (owner: string) => `contacts:${owner.toLowerCase()}`

function merge(list: EmailAddress[], weight = 1) {
    const map = new Map(entries.map((e) => [e.email.toLowerCase(), e]))
    for (const a of list) {
        if (!a?.email) continue
        const k = a.email.toLowerCase()
        const cur = map.get(k)
        if (cur) {
            cur.count += weight
            if (!cur.name && a.name) cur.name = a.name
        } else map.set(k, { name: a.name ?? null, email: a.email, count: weight })
    }
    entries = [...map.values()].sort((a, b) => b.count - a.count).slice(0, 2000)
}

export function loadContacts(jmap: JmapClient, owner: string, mailboxIds: string[]): Promise<void> {
    if (loadedFor === owner) return loading ?? Promise.resolve()
    loadedFor = owner
    entries = readStore<Entry[]>(key(owner), [])
    loading = getRecentAddresses(jmap, mailboxIds)
        .then((list) => {
            entries = []
            merge(list.filter((a) => a.email.toLowerCase() !== owner.toLowerCase()))
            writeStore(key(owner), entries)
        })
        .catch(() => {
            // keep the cached list
        })
    return loading
}

export function rememberAddresses(owner: string, list: EmailAddress[]): void {
    merge(list, 3)
    writeStore(key(owner), entries)
}

export function suggest(query: string, exclude: string[], limit = 8): EmailAddress[] {
    const q = query.trim().toLowerCase()
    if (!q) return []
    const skip = new Set(exclude.map((e) => e.toLowerCase()))
    const out: EmailAddress[] = []
    for (const e of entries) {
        if (skip.has(e.email.toLowerCase())) continue
        if (e.email.toLowerCase().includes(q) || (e.name ?? '').toLowerCase().includes(q)) {
            out.push({ name: e.name, email: e.email })
            if (out.length >= limit) break
        }
    }
    return out
}

export function resetContacts(): void {
    entries = []
    loadedFor = ''
    loading = null
}
