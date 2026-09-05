'use client'

// Owner-only saved git SSH keys (deploy keys) — the /ssh-keys admin page.
// Save a key once (the private key is write-only: it lands in an owner-only
// file server-side and is never shown again), then pick it in the New-project
// dialog to clone private ssh:// / git@ repos.

import React, { useMemo, useState } from 'react'
import { toast } from '@/lib/toast'
import { apiFetch, describeApiError } from '@/lib/fetcher'
import { escapeHtml, useTc, useTcEvents } from '@/lib/tc'
import { tcIcon } from '@/lib/icons'
import type { GitKey } from '@/server/domain/types'
import { useConfirm } from './ConfirmModal'

const COLUMNS = [
    { key: 'key', label: 'Key' },
    { key: 'created', label: 'Created', width: '14rem' },
    { key: 'actions', label: 'Actions', width: '9rem' },
]

/** Injected tbody HTML — every interpolated value is escaped. */
function keyRowsHtml(rows: GitKey[], busy: Record<string, boolean>): string {
    return rows
        .map((k) => {
            const key =
                `<strong>${escapeHtml(k.alias)}</strong>` +
                (k.label ? `<div style="font-size: 0.8rem; opacity: 0.7">${escapeHtml(k.label)}</div>` : '')
            const created = `<tc-text variant="muted">${escapeHtml(new Date(k.createdAt).toLocaleString())}</tc-text>`
            const actions = `<tc-button size="sm" variant="danger" outline${busy[k.alias] ? ' disabled' : ''} data-action="remove" data-alias="${escapeHtml(k.alias)}">Remove</tc-button>`
            return `<tr><td>${key}</td><td>${created}</td><td>${actions}</td></tr>`
        })
        .join('')
}

export function SshKeysClient({ keys }: { keys: GitKey[] }) {
    const confirm = useConfirm()
    const [rows, setRows] = useState(keys)
    const [busy, setBusy] = useState<Record<string, boolean>>({})

    const remove = async (alias: string) => {
        const ok = await confirm({
            title: `Remove SSH key "${alias}"?`,
            body: 'Deletes the registry row and the key file on the host. Projects cloned with it block removal until they are deleted.',
            confirmLabel: 'Remove',
            confirmVariant: 'danger',
        })
        if (!ok) return
        setBusy((b) => ({ ...b, [alias]: true }))
        try {
            await apiFetch(`/api/git-keys/${alias}`, { method: 'DELETE' })
            setRows((rs) => rs.filter((r) => r.alias !== alias))
            toast.success(`Removed ${alias}`)
        } catch (e) {
            toast.error(describeApiError(e))
        } finally {
            setBusy((b) => ({ ...b, [alias]: false }))
        }
    }

    const onDelegated = (event: Event) => {
        const el = (event.target as HTMLElement)?.closest?.('[data-action="remove"]') as HTMLElement | null
        const alias = el?.getAttribute('data-alias')
        if (alias) void remove(alias)
    }

    const tableProps = useMemo(() => ({ columns: COLUMNS, rows: keyRowsHtml(rows, busy) }), [rows, busy])
    const tableRef = useTc<HTMLElement>(tableProps, { click: onDelegated })

    const onCreated = (key: GitKey) => {
        setRows((rs) => [...rs, key].sort((a, b) => a.alias.localeCompare(b.alias)))
    }

    return (
        <div className="taskforge-page">
            <tc-rich-page-header
                title-text="SSH keys"
                icon-name={tcIcon('lock')}
                icon-color="emerald"
                description="Deploy keys for cloning private repositories over SSH. Pick one in the New-project dialog; the key is stored owner-only on the host and never shown again."
            />
            <AddKeyForm existing={rows.map((r) => r.alias)} onCreated={onCreated} />
            {rows.length === 0 ? (
                <tc-empty-state icon={tcIcon('lock')}>
                    <h3>No SSH keys yet</h3>
                    <p>Save a deploy key above to clone private repositories over SSH.</p>
                </tc-empty-state>
            ) : (
                <tc-advanced-table ref={tableRef} />
            )}
        </div>
    )
}

function AddKeyForm({ existing, onCreated }: { existing: string[]; onCreated: (k: GitKey) => void }) {
    const [alias, setAlias] = useState('')
    const [label, setLabel] = useState('')
    const [privateKey, setPrivateKey] = useState('')
    const [submitting, setSubmitting] = useState(false)

    const aliasRef = useTcEvents<HTMLElement>({ input: (e) => setAlias((e.target as HTMLInputElement).value) })
    const labelRef = useTcEvents<HTMLElement>({ input: (e) => setLabel((e.target as HTMLInputElement).value) })
    const keyRef = useTcEvents<HTMLElement>({
        input: (e) => setPrivateKey((e.target as HTMLTextAreaElement).value),
    })

    const trimmedAlias = alias.trim()
    const kebab = /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(trimmedAlias)
    const duplicate = existing.includes(trimmedAlias)
    const keyShape = /-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----/.test(privateKey)
    const valid = kebab && !duplicate && keyShape

    const submit = async () => {
        if (!valid) return
        setSubmitting(true)
        try {
            const key = await apiFetch<GitKey>('/api/git-keys', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    alias: trimmedAlias,
                    label: label.trim() || undefined,
                    privateKey,
                }),
            })
            onCreated(key)
            toast.success(`Saved ${trimmedAlias}`)
            setAlias('')
            setLabel('')
            setPrivateKey('')
        } catch (e) {
            toast.error(describeApiError(e))
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <tc-card>
            <tc-heading slot="header" as="h3">
                Add SSH key
            </tc-heading>
            <tc-stack gap="0.75rem" style={{ padding: '1rem' }}>
                <tc-stack direction="horizontal" gap="1rem" wrap align="flex-end">
                    <tc-input
                        ref={aliasRef}
                        label="Alias"
                        placeholder="deploy-backend"
                        value={alias}
                        disabled={submitting || undefined}
                    />
                    <tc-input
                        ref={labelRef}
                        label="Label (optional)"
                        placeholder="Backend repo deploy key"
                        value={label}
                        disabled={submitting || undefined}
                    />
                </tc-stack>
                <tc-textarea
                    ref={keyRef}
                    label="Private key"
                    rows={6}
                    placeholder={'-----BEGIN OPENSSH PRIVATE KEY-----\n…'}
                    value={privateKey}
                    help="Paste the PEM/OpenSSH private key (e.g. a read-only deploy key). Stored owner-only on the host and never shown again."
                    disabled={submitting || undefined}
                />

                {trimmedAlias !== '' && !kebab && (
                    <tc-text variant="muted">Alias must be kebab-case — lowercase letters, digits, single dashes.</tc-text>
                )}
                {duplicate && <tc-text variant="muted">A key with that alias already exists.</tc-text>}
                {privateKey.trim() !== '' && !keyShape && (
                    <tc-text variant="muted">
                        That doesn’t look like a private key (expected a “-----BEGIN … PRIVATE KEY-----” block).
                    </tc-text>
                )}

                <tc-stack direction="horizontal" gap="0.75rem" wrap align="center">
                    <tc-button
                        variant="primary"
                        loading={submitting || undefined}
                        disabled={submitting || !valid || undefined}
                        onClick={() => void submit()}
                    >
                        Save key
                    </tc-button>
                </tc-stack>
            </tc-stack>
        </tc-card>
    )
}
