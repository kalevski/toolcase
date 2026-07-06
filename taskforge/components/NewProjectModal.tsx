'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Modal } from '@/lib/modal'
import { toast } from '@/lib/toast'
import { apiFetch, describeApiError } from '@/lib/fetcher'
import { useTcEvents } from '@/lib/tc'
import type { GitKey } from '@/server/domain/types'

const KEY = 'newProject'

// tc-select needs a non-empty option value; "no key" maps through this sentinel.
const SSH_KEY_NONE = 'none'

/**
 * Create-project dialog. Rendered once inside the global ModalRender (see
 * Providers). Collects name + git URL + optional branch, POSTs to /api/projects
 * (clone + scaffold), and resolves with the new project name on success so the
 * caller can navigate to it. CLAUDE.md is generated later from the project page.
 */
export function NewProjectModal() {
    const input = Modal.useModalInput<true>()
    const close = Modal.useModalClose<string | null>()
    const open = !!input

    const [name, setName] = useState('')
    const [gitUrl, setGitUrl] = useState('')
    const [branch, setBranch] = useState('')
    const [sshKey, setSshKey] = useState(SSH_KEY_NONE)
    const [keys, setKeys] = useState<GitKey[]>([])
    const [submitting, setSubmitting] = useState(false)

    const nameRef = useTcEvents<HTMLElement>({ input: (e) => setName((e.target as HTMLInputElement).value) })
    const gitRef = useTcEvents<HTMLElement>({ input: (e) => setGitUrl((e.target as HTMLInputElement).value) })
    const branchRef = useTcEvents<HTMLElement>({ input: (e) => setBranch((e.target as HTMLInputElement).value) })
    const sshKeyRef = useTcEvents<HTMLElement>({
        change: (e) => setSshKey((e.target as HTMLSelectElement).value || SSH_KEY_NONE),
    })

    // Reset the form each time the dialog opens; refresh the saved-key list so a
    // key added on the SSH keys page shows up without a reload.
    useEffect(() => {
        if (open) {
            setName('')
            setGitUrl('')
            setBranch('')
            setSshKey(SSH_KEY_NONE)
            setSubmitting(false)
            apiFetch<GitKey[]>('/api/git-keys')
                .then(setKeys)
                .catch(() => setKeys([]))
        }
    }, [open])

    if (!open) return null

    const valid = name.trim() !== '' && gitUrl.trim() !== ''

    const submit = async () => {
        if (!valid) return
        setSubmitting(true)
        try {
            // Clone + scaffold can take a minute (see the helper text below) —
            // exempt from the default 10 s timeout.
            const data = await apiFetch<{ name: string }>('/api/projects', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: name.trim(),
                    gitUrl: gitUrl.trim(),
                    branch: branch.trim() || undefined,
                    sshKey: sshKey !== SSH_KEY_NONE ? sshKey : undefined,
                }),
                timeoutMs: 0,
            })
            toast.success(`Created ${data.name}`)
            close(data.name)
        } catch (e) {
            toast.error(describeApiError(e))
            setSubmitting(false)
        }
    }

    return (
        <Modal.Window size="small" title="New project">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <tc-input
                    ref={nameRef}
                    label="Project name"
                    placeholder="my-service"
                    value={name}
                    disabled={submitting || undefined}
                />
                <tc-input
                    ref={gitRef}
                    label="Git URL"
                    placeholder="https://github.com/org/repo.git"
                    value={gitUrl}
                    disabled={submitting || undefined}
                />
                <tc-input
                    ref={branchRef}
                    label="Branch (optional)"
                    placeholder="default branch"
                    value={branch}
                    disabled={submitting || undefined}
                />
                {keys.length > 0 && (
                    <tc-select
                        ref={sshKeyRef}
                        label="SSH key (optional)"
                        value={sshKey}
                        help="Clone with a saved deploy key — required for private ssh:// / git@ URLs. Keys are managed on the SSH keys page."
                        disabled={submitting || undefined}
                    >
                        <tc-option value={SSH_KEY_NONE}>None (HTTPS / ambient credentials)</tc-option>
                        {keys.map((k) => (
                            <tc-option key={k.alias} value={k.alias}>
                                {k.label ? `${k.alias} — ${k.label}` : k.alias}
                            </tc-option>
                        ))}
                    </tc-select>
                )}
                <tc-text variant="muted">
                    Clones the repo into <code>repo/</code> and scaffolds <code>tasks/</code> + <code>knowledge/</code>.
                    This can take a minute. Generate a <code>CLAUDE.md</code> afterward from the project page.
                </tc-text>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                    <tc-button variant="secondary" outline disabled={submitting || undefined} onClick={() => close(null)}>
                        Cancel
                    </tc-button>
                    <tc-button
                        variant="primary"
                        loading={submitting || undefined}
                        disabled={submitting || !valid || undefined}
                        onClick={submit}
                    >
                        Create
                    </tc-button>
                </div>
            </div>
        </Modal.Window>
    )
}

/** Promise-based open: `const name = await newProject()` (null if cancelled). */
export function useNewProject() {
    const resolverRef = useRef<((v: string | null) => void) | null>(null)
    const open = Modal.useModalOpen<string | null, true>(KEY, (payload) => {
        resolverRef.current?.(payload ?? null)
        resolverRef.current = null
    })
    return useCallback(
        () =>
            new Promise<string | null>((resolve) => {
                resolverRef.current = resolve
                open(true)
            }),
        [open],
    )
}
