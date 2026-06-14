import React, { useEffect, useRef, useState } from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const EditableTextDemo: React.FC = () => {
    const [committed, setCommitted] = useState('Project Alpha')
    const listenerRef = useRef<any>(null)

    useEffect(() => {
        const el = listenerRef.current
        if (!el) return
        const handler = (e: Event) => {
            const detail = (e as CustomEvent).detail
            setCommitted(detail.value)
        }
        el.addEventListener('tc-change', handler)
        return () => el.removeEventListener('tc-change', handler)
    }, [])

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <RichPageHeader
                            chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                            title="EditableText"
                            description="Inline editable label — looks like plain text at rest, reveals a form-control on hover/focus. Commits on Enter or blur, reverts on Escape."
                        />

                        <div className="d-flex flex-column gap-4 mt-4">
                            <SectionCard title="Default value — tc-change logger">
                                <div className="d-flex align-items-center gap-2">
                                    <span className="form-text mb-0">Name:</span>
                                    {/* @ts-ignore */}
                                    <tc-editable-text
                                        ref={listenerRef}
                                        default-value="Project Alpha"
                                        aria-label="Project name"
                                    />
                                </div>
                                <div className="form-text mt-2">Last committed: <strong>{committed}</strong></div>
                            </SectionCard>

                            <SectionCard title="Placeholder only">
                                <div className="d-flex align-items-center gap-2">
                                    <span className="form-text mb-0">Label:</span>
                                    {/* @ts-ignore */}
                                    <tc-editable-text
                                        placeholder="Click to add a label…"
                                        aria-label="Add label"
                                    />
                                </div>
                            </SectionCard>

                            <SectionCard title="Disabled">
                                <div className="d-flex align-items-center gap-2">
                                    <span className="form-text mb-0">Status:</span>
                                    {/* @ts-ignore */}
                                    <tc-editable-text
                                        default-value="Archived"
                                        aria-label="Status"
                                        disabled
                                    />
                                </div>
                            </SectionCard>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default EditableTextDemo
