'use client'

import React, { useEffect, useState } from 'react'
import { Drawer, Spinner, Badge } from '@toolcase/react-components'

export function TaskDrawer({ repo, taskId, onClose }: { repo: string; taskId: string | null; onClose: () => void }) {
    const [content, setContent] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        if (!taskId) return
        setLoading(true)
        setContent(null)
        fetch(`/api/repos/${repo}/tasks/${taskId}`)
            .then((r) => (r.ok ? r.json() : Promise.reject()))
            .then((d) => setContent(d.content))
            .catch(() => setContent('Failed to load task.'))
            .finally(() => setLoading(false))
    }, [repo, taskId])

    return (
        <Drawer open={taskId !== null} onClose={onClose} side="right" size="large" title={taskId ?? ''}>
            <div style={{ padding: '1.25rem' }}>
                <Badge variant="secondary">{taskId}</Badge>
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
