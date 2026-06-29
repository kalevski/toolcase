'use client'

import { useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { apiFetch, describeApiError } from '@/lib/fetcher'
import { useTc, detailValue } from '@/lib/tc'

// Owner-only project-creation page (the switcher's "Create project" action lands
// here). Posts to `POST /api/projects` then redirects to the new project.
export function NewProjectClient() {
    const router = useRouter()
    const [name, setName] = useState('')
    const [busy, setBusy] = useState(false)
    const [err, setErr] = useState<string | null>(null)
    const nameRef = useRef(name)
    nameRef.current = name

    const create = async () => {
        const value = nameRef.current.trim()
        if (!value || busy) return
        setBusy(true)
        setErr(null)
        try {
            const created = await apiFetch<{ id: string }>('/api/projects', {
                method: 'POST',
                body: JSON.stringify({ name: value }),
            })
            router.push(`/projects/${created.id}`)
        } catch (e) {
            setErr(describeApiError(e))
            setBusy(false)
        }
    }

    const inputRef = useTc<HTMLElement>(
        useMemo(() => ({ value: name }), [name]),
        { 'tc-change': (e: Event) => setName(detailValue<string>(e) ?? '') },
    )

    return (
        <div className="wharf-page">
            <tc-rich-page-header
                icon-name="Plus"
                icon-color="cyan"
                title-text="New project"
                sub="Create a project to hold environments, instances and config"
            />

            {err && <tc-banner variant="error">{err}</tc-banner>}

            <tc-section-card title="Project" icon="Boxes">
                <div className="wharf-section-body">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <tc-input
                            ref={inputRef}
                            label="Project name"
                            placeholder="e.g. Acme API"
                            style={{ maxWidth: '24rem' }}
                        />
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', flexWrap: 'wrap' }}>
                        <tc-button variant="primary" onClick={create} disabled={busy || !name.trim()}>
                            {busy ? 'Creating…' : 'Create project'}
                        </tc-button>
                        <tc-button variant="secondary" outline onClick={() => router.back()} disabled={busy}>
                            Cancel
                        </tc-button>
                    </div>
                </div>
            </tc-section-card>
        </div>
    )
}
