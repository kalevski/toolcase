import React, { useEffect, useRef, useState } from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

function DismissibleQueue() {
    const [files, setFiles] = useState([
        { key: 'report', name: 'Q3-Report', extension: '.pdf', format: 'pdf', size: 1258291 },
        { key: 'photo', name: 'hero-image', extension: '.jpg', format: 'jpg', size: 3407872 },
        { key: 'data', name: 'export', extension: '.csv', format: 'csv', size: 45056 },
    ])
    const containerRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const el = containerRef.current
        if (!el) return
        const handler = (e: Event) => {
            const row = (e.target as HTMLElement).closest('tc-queued-file')
            if (!row) return
            const key = row.getAttribute('data-key')
            if (key) setFiles(prev => prev.filter(f => f.key !== key))
        }
        el.addEventListener('tc-dismiss', handler)
        return () => el.removeEventListener('tc-dismiss', handler)
    }, [])

    return (
        <div ref={containerRef} className="d-flex flex-column gap-2">
            {files.length === 0 && (
                <p className="text-muted small mb-0">All files dismissed.</p>
            )}
            {files.map(f => (
                <React.Fragment key={f.key}>
                    {/* @ts-ignore */}
                    <tc-queued-file
                        data-key={f.key}
                        name={f.name}
                        extension={f.extension}
                        format={f.format}
                        size={String(f.size)}
                    />
                </React.Fragment>
            ))}
        </div>
    )
}

function CallbackExample() {
    const ref = useRef<any>(null)
    const [dismissed, setDismissed] = useState(false)

    useEffect(() => {
        const el = ref.current
        if (!el) return
        el.onDismiss = () => setDismissed(true)
    }, [])

    if (dismissed) {
        return <p className="text-muted small mb-0">File dismissed via onDismiss callback.</p>
    }

    return (
        <>
            {/* @ts-ignore */}
            <tc-queued-file ref={ref} name="presentation" extension=".pptx" format="pptx" size="8388608" />
        </>
    )
}

const QueuedFileDemo: React.FC = () => (
    <div className="py-4">
        <div className="container">
            <div className="row">
                <div className="col-12">
                    <RichPageHeader
                        chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                        title="QueuedFile"
                        description="A file-queue item showing the file name, extension, format badge, and byte size with a dismiss button. Dispatches tc-dismiss when dismissed."
                    />

                    <div className="d-flex flex-column gap-4 mt-4">
                        <SectionCard title="Dismiss queue (tc-dismiss event listener)">
                            <DismissibleQueue />
                        </SectionCard>

                        <SectionCard title="Static examples">
                            <div className="d-flex flex-column gap-2">
                                {/* @ts-ignore */}
                                <tc-queued-file name="architecture" extension=".png" format="png" size="2097152" />
                                {/* @ts-ignore */}
                                <tc-queued-file name="dataset" extension=".json" format="json" size="512000" />
                                {/* @ts-ignore */}
                                <tc-queued-file name="readme" extension=".md" format="md" size="4096" />
                                {/* @ts-ignore */}
                                <tc-queued-file name="video-clip" extension=".mp4" format="mp4" size="52428800" />
                            </div>
                        </SectionCard>

                        <SectionCard title="onDismiss callback property">
                            <CallbackExample />
                        </SectionCard>

                        <SectionCard title="Minimal (no size)">
                            <div className="d-flex flex-column gap-2">
                                {/* @ts-ignore */}
                                <tc-queued-file name="unknown-file" extension=".bin" format="bin" size="0" />
                            </div>
                        </SectionCard>
                    </div>
                </div>
            </div>
        </div>
    </div>
)

export default QueuedFileDemo
