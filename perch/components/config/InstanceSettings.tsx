'use client'

import { useCallback, useState } from 'react'
import type { Instance } from '@/server/domain/types'
import { callApi } from './shared'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { TextField } from '@/components/fields'
import { useToast } from '@/components/Toast'

// Instance Settings tab (move_wharf_to_perch.md §10): rename/description, a
// multi-value tag editor, the fetch-key panel (mint/rotate shows the secret
// once; revoke), and the danger zone (delete).

export function InstanceSettings({
    instance,
    onChanged,
    onDeleted,
}: {
    instance: Instance
    onChanged: (next: Instance) => void
    onDeleted: () => void
}) {
    const toast = useToast()
    const [name, setName] = useState(instance.name)
    const [description, setDescription] = useState(instance.description ?? '')
    const [tagInput, setTagInput] = useState('')
    const [tags, setTags] = useState<string[]>(instance.tags)
    const [savingDetails, setSavingDetails] = useState(false)
    const [detailsError, setDetailsError] = useState<string | null>(null)

    const [keyBusy, setKeyBusy] = useState(false)
    const [mintedSecret, setMintedSecret] = useState<string | null>(null)
    const [keyError, setKeyError] = useState<string | null>(null)
    const [confirmRevoke, setConfirmRevoke] = useState(false)
    const [confirmDelete, setConfirmDelete] = useState(false)
    const [deleting, setDeleting] = useState(false)

    const addTag = useCallback(() => {
        const t = tagInput.trim().toLowerCase()
        if (t && !tags.includes(t)) setTags((prev) => [...prev, t])
        setTagInput('')
    }, [tagInput, tags])

    const removeTag = useCallback((t: string) => setTags((prev) => prev.filter((x) => x !== t)), [])

    const saveDetails = useCallback(async () => {
        if (savingDetails) return
        const trimmedName = name.trim().toLowerCase()
        if (!trimmedName) {
            setDetailsError('An instance needs a name.')
            return
        }
        setSavingDetails(true)
        setDetailsError(null)
        const res = await callApi<Instance>(`/api/instances/${instance.id}`, 'PATCH', {
            name: trimmedName,
            description: description.trim() || null,
            tags,
        })
        setSavingDetails(false)
        if (!res.ok || !res.body) {
            setDetailsError(`Couldn’t save: ${res.message}`)
            return
        }
        toast.show('Instance updated.', { variant: 'success' })
        onChanged(res.body)
    }, [savingDetails, name, description, tags, instance.id, onChanged, toast])

    const mintKey = useCallback(async () => {
        if (keyBusy) return
        setKeyBusy(true)
        setKeyError(null)
        const res = await callApi<{ secret: string }>(`/api/instances/${instance.id}/key`, 'POST', {})
        setKeyBusy(false)
        if (!res.ok || !res.body) {
            setKeyError(`Couldn’t mint a key: ${res.message}`)
            return
        }
        setMintedSecret(res.body.secret)
        onChanged({ ...instance, hasKey: true })
    }, [keyBusy, instance, onChanged])

    const doRevoke = useCallback(async () => {
        setConfirmRevoke(false)
        setKeyBusy(true)
        setKeyError(null)
        const res = await callApi(`/api/instances/${instance.id}/key`, 'DELETE')
        setKeyBusy(false)
        if (!res.ok) {
            setKeyError(`Couldn’t revoke the key: ${res.message}`)
            return
        }
        setMintedSecret(null)
        toast.show('Fetch key revoked.', { variant: 'success' })
        onChanged({ ...instance, hasKey: false })
    }, [instance, onChanged, toast])

    const doDelete = useCallback(async () => {
        setConfirmDelete(false)
        setDeleting(true)
        const res = await callApi(`/api/instances/${instance.id}`, 'DELETE')
        setDeleting(false)
        if (!res.ok) {
            toast.show(`Couldn’t delete “${instance.name}”: ${res.message}`, { variant: 'error' })
            return
        }
        toast.show(`Instance “${instance.name}” deleted.`, { variant: 'success' })
        onDeleted()
    }, [instance, onDeleted, toast])

    return (
        <>
            <tc-section-card title="Details" icon="pencil">
                <div className="perch-admin-section">
                    {detailsError && <tc-banner variant="danger">{detailsError}</tc-banner>}
                    <div className="perch-form-grid">
                        <TextField label="Name" value={name} onValue={setName} help="Lowercase letters/digits/hyphens." />
                        <TextField label="Description" value={description} onValue={setDescription} />
                    </div>
                    <div className="perch-tag-editor">
                        <div className="perch-form-group-title">Tags</div>
                        {tags.length > 0 && (
                            <div className="perch-tag-chips">
                                {tags.map((t) => (
                                    <span key={t} className="perch-tag-chip">
                                        {t}
                                        <button
                                            type="button"
                                            className="perch-tag-remove"
                                            aria-label={`Remove ${t}`}
                                            title={`Remove ${t}`}
                                            onClick={() => removeTag(t)}
                                        >
                                            ×
                                        </button>
                                    </span>
                                ))}
                            </div>
                        )}
                        <div className="perch-tag-add">
                            <TextField size="sm" label="Add tag" placeholder="production" value={tagInput} onValue={setTagInput} />
                            <tc-button variant="secondary" outline size="sm" onClick={addTag}>
                                Add
                            </tc-button>
                        </div>
                    </div>
                    <div className="perch-list-actions">
                        <tc-button
                            variant="primary"
                            size="sm"
                            loading={savingDetails || undefined}
                            onClick={() => void saveDetails()}
                        >
                            Save changes
                        </tc-button>
                    </div>
                </div>
            </tc-section-card>

            <tc-section-card title="Fetch key" icon="key">
                <div className="perch-admin-section">
                    <p className="perch-home-lead perch-admin-hint">
                        {instance.hasKey ? 'A fetch key is set.' : 'No fetch key minted yet.'} Minting/rotating shows the
                        secret once — it is never recoverable afterwards.
                    </p>
                    {keyError && <tc-banner variant="danger">{keyError}</tc-banner>}
                    {mintedSecret && (
                        <>
                            <tc-banner variant="warning">Copy this now — it will not be shown again.</tc-banner>
                            <tc-code-snippet code={mintedSecret} language="text" show-copy-button="" />
                        </>
                    )}
                    <div className="perch-list-actions">
                        <tc-button
                            variant="secondary"
                            outline
                            size="sm"
                            loading={keyBusy || undefined}
                            onClick={() => void mintKey()}
                        >
                            {instance.hasKey ? 'Rotate key' : 'Mint key'}
                        </tc-button>
                        {instance.hasKey && (
                            <tc-button variant="danger" outline size="sm" onClick={() => setConfirmRevoke(true)}>
                                Revoke
                            </tc-button>
                        )}
                    </div>
                </div>
            </tc-section-card>

            <tc-section-card title="Danger zone" icon="triangle-alert">
                <div className="perch-admin-section perch-danger-zone">
                    <p className="perch-home-lead perch-admin-hint">
                        Deleting an instance removes its tags, variables, and flags. This cannot be undone.
                    </p>
                    <div className="perch-list-actions">
                        <tc-button
                            variant="danger"
                            outline
                            size="sm"
                            loading={deleting || undefined}
                            onClick={() => setConfirmDelete(true)}
                        >
                            Delete instance
                        </tc-button>
                    </div>
                </div>
            </tc-section-card>

            <ConfirmDialog
                open={confirmRevoke}
                title="Revoke fetch key?"
                message="Any machine using this key immediately loses access to config fetches."
                confirmLabel="Revoke"
                danger
                onConfirm={() => void doRevoke()}
                onCancel={() => setConfirmRevoke(false)}
            />
            <ConfirmDialog
                open={confirmDelete}
                title="Delete instance?"
                message={`Delete “${instance.name}”. Its tags, variables, and flags are removed. This cannot be undone.`}
                confirmLabel="Delete"
                danger
                onConfirm={() => void doDelete()}
                onCancel={() => setConfirmDelete(false)}
            />
        </>
    )
}
