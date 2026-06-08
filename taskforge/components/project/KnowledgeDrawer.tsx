'use client'

import React, { useEffect, useState } from 'react'
import { Drawer, Spinner, Badge } from '@toolcase/react-components'

export function KnowledgeDrawer({ project, docId, onClose }: { project: string; docId: string | null; onClose: () => void }) {
    // Result is stamped with the doc it belongs to, so `content` derives its own
    // staleness: when `docId` changes, content falls back to null (and an in-flight
    // response can never render under the wrong doc) — no prop-change reset effect.
    const [result, setResult] = useState<{ id: string; content: string } | null>(null)
    const content = result?.id === docId ? result.content : null
    const loading = docId !== null && content === null

    useEffect(() => {
        if (!docId) return
        let cancelled = false
        fetch(`/api/projects/${project}/knowledge/${docId}`)
            .then((r) => (r.ok ? r.json() : Promise.reject()))
            .then((d) => {
                if (!cancelled) setResult({ id: docId, content: d.content })
            })
            .catch(() => {
                if (!cancelled) setResult({ id: docId, content: 'Failed to load document.' })
            })
        return () => {
            cancelled = true
        }
    }, [project, docId])

    return (
        <Drawer open={docId !== null} onClose={onClose} side="right" size="large" title={docId ?? ''}>
            <div style={{ padding: '1.25rem' }}>
                <Badge variant="secondary">knowledge/{docId}</Badge>
                {loading && (
                    <div style={{ padding: '2rem', textAlign: 'center' }}>
                        <Spinner />
                    </div>
                )}
                {content !== null && (
                    <pre
                        style={{
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word',
                            fontFamily: 'ui-monospace, monospace',
                            fontSize: '0.85rem',
                            marginTop: '1rem',
                        }}
                    >
                        {content}
                    </pre>
                )}
            </div>
        </Drawer>
    )
}
