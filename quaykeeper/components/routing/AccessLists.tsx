'use client'

import { useCallback, useMemo, useState } from 'react'
import type { AdvancedTableColumn } from '@toolcase/web-components'
import type { AccessList, AccessRule, SatisfyMode } from '@/server/domain/access-list'
import {
    RoutingPage,
    RoutingListTable,
    cellBadge,
    cellMono,
    cellMuted,
    json,
    saveErrorMessage,
    saveRouting,
    useMaintainerData,
    type RoutingListItem,
} from './shared'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { FormModal, FormGroup } from '@/components/FormModal'
import { SelectField, SwitchField, TextField, type SelectOption } from '@/components/fields'

// Maintainer routing surface — access lists (better.md §1 / C1): named IP
// allow/deny + basic-auth policies that proxies, redirects and dead hosts
// reference via `access_list`. List the configured lists, create/edit in a
// FormModal (impl §10 — POST replaces by name). Drives `/api/routing/access-lists`
// (`authorize('maintainer')`-gated).
//
// PASSWORDS are write-only end to end: the list body carries usernames only
// (the daemon preserves existing hashes on replace); a password typed into a
// user row is sent through the dedicated PUT …/users/{username} call after the
// list saves, hashed apr1 daemon-side, and never readable back.

const SATISFY_OPTIONS: SelectOption[] = [
    { value: 'all', label: 'all — IP rules AND auth must pass' },
    { value: 'any', label: 'any — either grants access' },
]

const RULE_KIND_OPTIONS: SelectOption[] = [
    { value: 'allow', label: 'allow' },
    { value: 'deny', label: 'deny' },
]

export function AccessLists() {
    const fetcher = useCallback(async (): Promise<AccessList[] | null> => {
        try {
            return await fetch('/api/routing/access-lists', { cache: 'no-store' }).then((r) =>
                json<AccessList[]>(r),
            )
        } catch {
            return null
        }
    }, [])
    const { state, reload } = useMaintainerData(fetcher)

    return (
        <RoutingPage
            title="Access lists"
            subtitle="Named IP allow/deny + basic-auth policies for proxies, redirects and dead hosts."
            icon="lock"
            iconColor="amber"
            requiresPath="/access-lists"
            state={state}
            onRetry={() => void reload()}
        >
            {(lists) => <AccessListsManager lists={lists} onChanged={() => void reload()} />}
        </RoutingPage>
    )
}

interface UserDraft {
    username: string
    /** Optional plaintext to (re)set via the dedicated password call after save. */
    password: string
    /** Whether the daemon reports a password already set (read-only). */
    hasPassword: boolean
}

interface RuleDraft {
    kind: 'allow' | 'deny'
    value: string
}

const emptyUser = (): UserDraft => ({ username: '', password: '', hasPassword: false })
const emptyRule = (): RuleDraft => ({ kind: 'allow', value: '' })

// List columns (between the built-in Name column and the actions).
const ACCESS_LIST_COLUMNS: AdvancedTableColumn[] = [
    { key: 'satisfy', label: 'Satisfy' },
    { key: 'users', label: 'Basic-auth users' },
    { key: 'rules', label: 'IP rules' },
    { key: 'auth', label: 'Auth header' },
]

/** Users cell: count plus the usernames, flagging accounts still missing a password. */
function usersCellHtml(l: AccessList): string {
    const users = l.users ?? []
    if (users.length === 0) return cellMuted('none')
    const names = users
        .slice(0, 4)
        .map((u) => u.username + (u.has_password ? '' : ' (no password)'))
        .join(', ')
    const more = users.length > 4 ? ` +${users.length - 4} more` : ''
    return `${cellMuted(`${users.length} ·`)} ${cellMono(names + more)}`
}

/** Rules cell: count plus the first ordered allow/deny entries. */
function rulesCellHtml(l: AccessList): string {
    const rules = l.rules ?? []
    if (rules.length === 0) return cellMuted('none')
    const summary = rules
        .slice(0, 3)
        .map((r) => (r.allow !== undefined ? `allow ${r.allow}` : `deny ${r.deny}`))
        .join('; ')
    const more = rules.length > 3 ? ' …' : ''
    return `${cellMuted(`${rules.length} ·`)} ${cellMono(summary + more)}`
}

/** Everything the access-list form holds — one draft object; the modal resets by remount. */
interface AccessListDraft {
    name: string
    satisfy: SatisfyMode
    passAuth: boolean
    users: UserDraft[]
    rules: RuleDraft[]
}

const emptyDraft = (): AccessListDraft => ({
    name: '',
    satisfy: 'all',
    passAuth: false,
    users: [],
    rules: [],
})

const draftFrom = (l: AccessList): AccessListDraft => ({
    name: l.name,
    satisfy: l.satisfy ?? 'all',
    passAuth: !!l.pass_auth,
    users: (l.users ?? []).map((u) => ({
        username: u.username,
        password: '',
        hasPassword: !!u.has_password,
    })),
    rules: (l.rules ?? []).map(
        (r): RuleDraft =>
            r.allow ? { kind: 'allow', value: r.allow } : { kind: 'deny', value: r.deny ?? '' },
    ),
})

function AccessListsManager({ lists, onChanged }: { lists: AccessList[]; onChanged: () => void }) {
    // The open form: null = closed; { editing: null } = create; { editing: name } = edit.
    const [form, setForm] = useState<{ editing: string | null; draft: AccessListDraft } | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [notice, setNotice] = useState<string | null>(null)
    const [busy, setBusy] = useState(false)
    const [pending, setPending] = useState<string | null>(null)

    const patch = (p: Partial<AccessListDraft>) =>
        setForm((prev) => (prev ? { ...prev, draft: { ...prev.draft, ...p } } : prev))

    const patchUsers = (fn: (users: UserDraft[]) => UserDraft[]) =>
        setForm((prev) =>
            prev ? { ...prev, draft: { ...prev.draft, users: fn(prev.draft.users) } } : prev,
        )
    const setUser = (i: number, p: Partial<UserDraft>) =>
        patchUsers((users) => users.map((u, idx) => (idx === i ? { ...u, ...p } : u)))
    const addUser = () => patchUsers((users) => [...users, emptyUser()])
    const removeUser = (i: number) => patchUsers((users) => users.filter((_, idx) => idx !== i))

    const patchRules = (fn: (rules: RuleDraft[]) => RuleDraft[]) =>
        setForm((prev) =>
            prev ? { ...prev, draft: { ...prev.draft, rules: fn(prev.draft.rules) } } : prev,
        )
    const setRule = (i: number, p: Partial<RuleDraft>) =>
        patchRules((rules) => rules.map((r, idx) => (idx === i ? { ...r, ...p } : r)))
    const addRule = () => patchRules((rules) => [...rules, emptyRule()])
    const removeRule = (i: number) => patchRules((rules) => rules.filter((_, idx) => idx !== i))
    const moveRule = (i: number, dir: -1 | 1) =>
        patchRules((rules) => {
            const j = i + dir
            if (j < 0 || j >= rules.length) return rules
            const next = [...rules]
            ;[next[i], next[j]] = [next[j], next[i]]
            return next
        })

    const openCreate = () => {
        setError(null)
        setNotice(null)
        setForm({ editing: null, draft: emptyDraft() })
    }

    const startEdit = useCallback(
        (listName: string) => {
            const l = lists.find((x) => x.name === listName)
            if (!l) return
            setError(null)
            setNotice(null)
            setForm({ editing: l.name, draft: draftFrom(l) })
        },
        [lists],
    )

    const close = useCallback(() => {
        setForm(null)
        setError(null)
    }, [])

    const save = useCallback(async () => {
        if (!form || busy) return
        const d = form.draft
        const trimmed = d.name.trim()
        if (!trimmed) {
            setError('An access list needs a name.')
            return
        }
        const payload: AccessList = { name: trimmed }
        if (d.satisfy === 'any') payload.satisfy = 'any'
        if (d.passAuth) payload.pass_auth = true
        const builtUsers = []
        for (const u of d.users) {
            const username = u.username.trim()
            if (!username) {
                setError('Every user needs a username.')
                return
            }
            builtUsers.push({ username })
        }
        if (builtUsers.length) payload.users = builtUsers
        const builtRules: AccessRule[] = []
        for (const r of d.rules) {
            const v = r.value.trim()
            if (!v) {
                setError('Every rule needs an IP, a CIDR, or "all".')
                return
            }
            builtRules.push(r.kind === 'allow' ? { allow: v } : { deny: v })
        }
        if (builtRules.length) payload.rules = builtRules
        if (!builtUsers.length && !builtRules.length) {
            setError('Add at least one user or one rule — an empty list guards nothing.')
            return
        }

        setBusy(true)
        setError(null)
        setNotice(null)
        // 1. Save the list itself (usernames only — never passwords).
        const outcome = await saveRouting('/api/routing/access-lists', payload)
        if (!outcome.ok) {
            setBusy(false)
            setError(saveErrorMessage('access list', outcome))
            return
        }
        // 2. Push any typed passwords through the dedicated write-only endpoint.
        let passwordsSet = 0
        for (const u of d.users) {
            if (!u.password) continue
            try {
                const res = await fetch(
                    `/api/routing/access-lists/${encodeURIComponent(trimmed)}/users/${encodeURIComponent(
                        u.username.trim(),
                    )}`,
                    {
                        method: 'PUT',
                        headers: { 'content-type': 'application/json' },
                        body: JSON.stringify({ password: u.password }),
                    },
                )
                if (!res.ok) {
                    setBusy(false)
                    setError(`The list saved, but setting the password for ${u.username} failed (error ${res.status}).`)
                    onChanged()
                    return
                }
                passwordsSet++
            } catch {
                setBusy(false)
                setError(`The list saved, but setting the password for ${u.username} failed — network error.`)
                onChanged()
                return
            }
        }
        setBusy(false)
        if (passwordsSet > 0) setNotice(`Saved, ${passwordsSet} password(s) set.`)
        close()
        onChanged()
    }, [form, busy, close, onChanged])

    const doRemove = useCallback(async () => {
        const listName = pending
        if (!listName || busy) return
        setPending(null)
        setBusy(true)
        setError(null)
        try {
            const res = await fetch(`/api/routing/access-lists?name=${encodeURIComponent(listName)}`, {
                method: 'DELETE',
            })
            if (!res.ok && res.status !== 204) {
                const body = (await res.json().catch(() => null)) as { error?: string; detail?: string } | null
                setError(
                    body?.error === 'in_use'
                        ? `${listName} is still referenced by a proxy, redirect or dead host — detach it there first.`
                        : body?.detail
                          ? `Couldn’t remove ${listName}: ${body.detail}`
                          : `Couldn’t remove ${listName} (error ${res.status}).`,
                )
                return
            }
            onChanged()
        } catch {
            setError(`Couldn’t remove ${listName} — network error.`)
        } finally {
            setBusy(false)
        }
    }, [pending, busy, onChanged])

    const items = useMemo<RoutingListItem[]>(
        () =>
            lists.map((l) => ({
                name: l.name,
                cells: {
                    satisfy: cellBadge(
                        `satisfy ${l.satisfy ?? 'all'}`,
                        'secondary',
                        (l.satisfy ?? 'all') === 'all'
                            ? 'IP rules AND basic auth must both pass.'
                            : 'Either the IP rules or basic auth grants access.',
                    ),
                    users: usersCellHtml(l),
                    rules: rulesCellHtml(l),
                    auth: l.pass_auth
                        ? cellBadge(
                              'passed upstream',
                              'info',
                              'The Authorization header is forwarded to the upstream after auth.',
                          )
                        : cellMuted('consumed'),
                },
            })),
        [lists],
    )

    const d = form?.draft

    return (
        <>
            <tc-section-card title="Access lists" icon="lock">
                <div className="quaykeeper-admin-section">
                    <p className="quaykeeper-home-lead quaykeeper-admin-hint">
                        {lists.length} list{lists.length === 1 ? '' : 's'}. Attach one to a proxy, redirect or dead
                        host via its “Access list” field. Behind a CDN, enable the daemon’s real-ip trust list
                        (nginx.real_ip) first — otherwise IP rules see the CDN’s addresses, not your visitors’.
                    </p>
                    {error && !form && <tc-banner variant="error">{error}</tc-banner>}
                    {notice && <tc-banner variant="success">{notice}</tc-banner>}

                    <div className="quaykeeper-list-actions">
                        <tc-button variant="primary" size="sm" onClick={openCreate}>
                            New access list
                        </tc-button>
                    </div>

                    {lists.length === 0 ? (
                        <tc-empty-state icon="lock">No access lists yet.</tc-empty-state>
                    ) : (
                        <RoutingListTable
                            columns={ACCESS_LIST_COLUMNS}
                            items={items}
                            busy={busy}
                            onEdit={startEdit}
                            onRemove={setPending}
                        />
                    )}
                </div>
            </tc-section-card>

            {form && d && (
                <FormModal
                    key={form.editing ?? 'new'}
                    title={form.editing ? `Edit access list — ${form.editing}` : 'New access list'}
                    busy={busy}
                    submitLabel={form.editing ? 'Save changes' : 'Create access list'}
                    onSubmit={() => void save()}
                    onClose={close}
                >
                    {error && <tc-banner variant="error">{error}</tc-banner>}
                    <FormGroup title="Identity">
                        <div className="quaykeeper-form-grid">
                            <div className="quaykeeper-form-span">
                                <TextField
                                    label="Name"
                                    placeholder="office"
                                    help="Identifier ([A-Za-z0-9_]+) referenced from host forms."
                                    value={d.name}
                                    disabled={!!form.editing}
                                    onValue={(v) => patch({ name: v })}
                                />
                            </div>
                            <SelectField
                                label="Satisfy"
                                value={d.satisfy}
                                options={SATISFY_OPTIONS}
                                onValue={(v) => patch({ satisfy: v as SatisfyMode })}
                            />
                            <SwitchField
                                label="Pass auth upstream"
                                help="Forward the Authorization header to the upstream after auth."
                                checked={d.passAuth}
                                onChecked={(c) => patch({ passAuth: c })}
                            />
                        </div>
                    </FormGroup>

                    <FormGroup title="Users">
                        <p className="quaykeeper-home-lead quaykeeper-admin-hint">
                            Basic-auth users. Passwords are write-only — set or reset one by typing it; existing
                            passwords are kept when left blank.
                        </p>
                        {d.users.map((u, i) => (
                            <div className="quaykeeper-form-item" key={i}>
                                <div className="quaykeeper-form-row">
                                    <TextField
                                        size="sm"
                                        label="Username"
                                        placeholder="alice"
                                        value={u.username}
                                        disabled={u.hasPassword || undefined}
                                        onValue={(v) => setUser(i, { username: v })}
                                    />
                                    <TextField
                                        type="password"
                                        size="sm"
                                        label={u.hasPassword ? 'New password (blank = keep current)' : 'Password'}
                                        value={u.password}
                                        onValue={(v) => setUser(i, { password: v })}
                                    />
                                </div>
                                <div className="quaykeeper-list-actions">
                                    <tc-button variant="danger" size="sm" outline onClick={() => removeUser(i)}>
                                        Remove user
                                    </tc-button>
                                </div>
                            </div>
                        ))}
                        <div className="quaykeeper-form-row">
                            <tc-button variant="secondary" size="sm" outline onClick={addUser}>
                                Add user
                            </tc-button>
                        </div>
                    </FormGroup>

                    <FormGroup title="IP rules">
                        <p className="quaykeeper-home-lead quaykeeper-admin-hint">
                            Ordered — evaluated top-down, then “deny all”. Values: an IP, a CIDR, or “all”.
                        </p>
                        {d.rules.map((r, i) => (
                            <div className="quaykeeper-form-item" key={i}>
                                <div className="quaykeeper-form-row">
                                    <SelectField
                                        size="sm"
                                        label="Rule"
                                        value={r.kind}
                                        options={RULE_KIND_OPTIONS}
                                        onValue={(v) => setRule(i, { kind: v as 'allow' | 'deny' })}
                                    />
                                    <TextField
                                        size="sm"
                                        label="IP / CIDR / all"
                                        placeholder="10.0.0.0/8"
                                        value={r.value}
                                        onValue={(v) => setRule(i, { value: v })}
                                    />
                                </div>
                                <div className="quaykeeper-list-actions">
                                    <tc-button
                                        variant="secondary"
                                        size="sm"
                                        outline
                                        aria-label="Move rule up"
                                        disabled={i === 0 || undefined}
                                        onClick={() => moveRule(i, -1)}
                                    >
                                        ↑
                                    </tc-button>
                                    <tc-button
                                        variant="secondary"
                                        size="sm"
                                        outline
                                        aria-label="Move rule down"
                                        disabled={i === d.rules.length - 1 || undefined}
                                        onClick={() => moveRule(i, 1)}
                                    >
                                        ↓
                                    </tc-button>
                                    <tc-button variant="danger" size="sm" outline onClick={() => removeRule(i)}>
                                        Remove rule
                                    </tc-button>
                                </div>
                            </div>
                        ))}
                        <div className="quaykeeper-form-row">
                            <tc-button variant="secondary" size="sm" outline onClick={addRule}>
                                Add rule
                            </tc-button>
                        </div>
                    </FormGroup>
                </FormModal>
            )}

            <ConfirmDialog
                open={!!pending}
                title="Remove access list?"
                message={
                    pending
                        ? `Remove the access list ${pending}. A proxy, redirect or dead host that still references it blocks the delete (409) until detached.`
                        : undefined
                }
                confirmLabel="Remove"
                danger
                onConfirm={() => void doRemove()}
                onCancel={() => setPending(null)}
            />
        </>
    )
}
