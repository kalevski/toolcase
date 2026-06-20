'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Modal, Button, Heading, Input, Text, toast } from '@/components/ui'

const KEY = 'newProject'

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
    const [submitting, setSubmitting] = useState(false)

    // Reset the form each time the dialog opens.
    useEffect(() => {
        if (open) {
            setName('')
            setGitUrl('')
            setBranch('')
            setSubmitting(false)
        }
    }, [open])

    if (!open) return null

    const valid = name.trim() !== '' && gitUrl.trim() !== ''

    const submit = async () => {
        if (!valid) return
        setSubmitting(true)
        try {
            const res = await fetch('/api/projects', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: name.trim(),
                    gitUrl: gitUrl.trim(),
                    branch: branch.trim() || undefined,
                }),
            })
            if (!res.ok) {
                const data = await res.json().catch(() => ({}))
                toast.error(data.error ?? 'Failed to create project')
                setSubmitting(false)
                return
            }
            const data = await res.json()
            toast.success(`Created ${data.name}`)
            close(data.name as string)
        } catch {
            toast.error('Failed to create project')
            setSubmitting(false)
        }
    }

    return (
        <Modal.Window size="small" title="New project">
            <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <Heading as="h3">New project</Heading>
                <Input
                    label="Project name"
                    placeholder="my-service"
                    value={name}
                    autoFocus
                    disabled={submitting}
                    onChange={(e) => setName(e.target.value)}
                />
                <Input
                    label="Git URL"
                    placeholder="https://github.com/org/repo.git"
                    value={gitUrl}
                    disabled={submitting}
                    onChange={(e) => setGitUrl(e.target.value)}
                />
                <Input
                    label="Branch (optional)"
                    placeholder="default branch"
                    value={branch}
                    disabled={submitting}
                    onChange={(e) => setBranch(e.target.value)}
                />
                <Text variant="muted">
                    Clones the repo into <code>repo/</code> and scaffolds <code>tasks/</code> + <code>knowledge/</code>.
                    This can take a minute. Generate a <code>CLAUDE.md</code> afterward from the project page.
                </Text>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                    <Button variant="secondary" outline disabled={submitting} onClick={() => close(null)}>
                        Cancel
                    </Button>
                    <Button variant="primary" loading={submitting} disabled={submitting || !valid} onClick={submit}>
                        Create
                    </Button>
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
