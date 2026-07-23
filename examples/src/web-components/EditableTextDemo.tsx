import React, { useState } from 'react'
import { useTcEvents } from '@toolcase/web-components/react'

const EditableTextDemo: React.FC = () => {
    const [committed, setCommitted] = useState('Project Alpha')
    const listenerRef = useTcEvents<HTMLElement>({
        'tc-change': (e: Event) => {
            const detail = (e as CustomEvent).detail
            setCommitted(detail.value)
        },
    })

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="EditableText"
                            description="Inline editable label — looks like plain text at rest, reveals a form-control on hover/focus. Commits on Enter or blur, reverts on Escape."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Web Components
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-4 mt-4">
                            <tc-section-card title="Default value — tc-change logger">
                                <div className="d-flex align-items-center gap-2">
                                    <span className="form-text mb-0">Name:</span>
                                    <tc-editable-text
                                        ref={listenerRef}
                                        default-value="Project Alpha"
                                        aria-label="Project name"
                                    />
                                </div>
                                <div className="form-text mt-2">
                                    Last committed: <strong>{committed}</strong>
                                </div>
                            </tc-section-card>

                            <tc-section-card title="Placeholder only">
                                <div className="d-flex align-items-center gap-2">
                                    <span className="form-text mb-0">Label:</span>
                                    {/* @ts-ignore */}
                                    <tc-editable-text
                                        placeholder="Click to add a label…"
                                        aria-label="Add label"
                                    />
                                </div>
                            </tc-section-card>

                            <tc-section-card title="Disabled">
                                <div className="d-flex align-items-center gap-2">
                                    <span className="form-text mb-0">Status:</span>
                                    {/* @ts-ignore */}
                                    <tc-editable-text
                                        default-value="Archived"
                                        aria-label="Status"
                                        disabled
                                    />
                                </div>
                            </tc-section-card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default EditableTextDemo
