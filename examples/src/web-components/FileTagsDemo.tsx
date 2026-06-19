import React, { useEffect, useRef, useState } from 'react'

const ALL_TAGS = [
    { id: 'bug', label: 'bug', color: '#ef4444' },
    { id: 'feature', label: 'feature', color: '#3b82f6' },
    { id: 'docs', label: 'docs', color: '#8b5cf6' },
    { id: 'refactor', label: 'refactor', color: '#f59e0b' },
    { id: 'test', label: 'test', color: '#10b981' },
    { id: 'ci', label: 'ci' },
    { id: 'chore', label: 'chore' },
]

const FileTagsDemo: React.FC = () => {
    const interactiveRef = useRef<any>(null)
    const readonlyRef = useRef<any>(null)

    const [selectedIds, setSelectedIds] = useState<string[]>(['bug', 'feature'])

    useEffect(() => {
        const el = interactiveRef.current
        if (!el) return
        el.tags = ALL_TAGS
        el.selectedIds = selectedIds

        const handler = (e: Event) => {
            const { selectedIds: ids } = (e as CustomEvent<{ selectedIds: string[] }>).detail
            setSelectedIds(ids)
            console.log('tc-change:', ids)
        }
        el.addEventListener('tc-change', handler)
        return () => el.removeEventListener('tc-change', handler)
    }, [])

    // Keep DOM in sync when React state changes (e.g. after event)
    useEffect(() => {
        const el = interactiveRef.current
        if (el) el.selectedIds = selectedIds
    }, [selectedIds])

    useEffect(() => {
        const el = readonlyRef.current
        if (!el) return
        el.tags = ALL_TAGS
        el.selectedIds = ['bug', 'docs', 'test']
    }, [])

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="FileTags"
                            description="Tag picker that shows selected tags as removable chips with a searchable add-menu. Fires tc-change with the updated selectedIds array. Supports readonly mode."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Web Components
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-4 mt-4">
                            <tc-section-card title="Interactive">
                                {/* @ts-ignore */}
                                <tc-file-tags ref={interactiveRef} />
                                {selectedIds.length > 0 && (
                                    <div className="form-text mt-2">
                                        Selected: {selectedIds.join(', ')}
                                    </div>
                                )}
                            </tc-section-card>

                            <tc-section-card title="Readonly">
                                {/* @ts-ignore */}
                                <tc-file-tags ref={readonlyRef} readonly />
                            </tc-section-card>

                            <tc-section-card title="Empty (no tags available)">
                                {/* @ts-ignore */}
                                <tc-file-tags />
                            </tc-section-card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default FileTagsDemo
