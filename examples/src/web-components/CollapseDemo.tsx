import React, { useRef } from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const CollapseDemo: React.FC = () => {
    const collapseRef = useRef<any>(null)
    const hCollapseRef = useRef<any>(null)

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <RichPageHeader
                            chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                            title="Collapse"
                            description="Toggleable content region backed by Bootstrap's Collapse plugin. Use the open attribute to start expanded and horizontal for a width-based transition."
                        />

                        <div className="d-flex flex-column gap-4 mt-4">
                            <SectionCard title="Default — toggle button drives show/hide">
                                <div className="d-flex gap-2 mb-3">
                                    <button
                                        className="btn btn-primary"
                                        onClick={() => collapseRef.current?.toggle()}
                                    >
                                        Toggle
                                    </button>
                                    <button
                                        className="btn btn-outline-secondary"
                                        onClick={() => collapseRef.current?.show()}
                                    >
                                        Show
                                    </button>
                                    <button
                                        className="btn btn-outline-secondary"
                                        onClick={() => collapseRef.current?.hide()}
                                    >
                                        Hide
                                    </button>
                                </div>
                                {/* @ts-ignore */}
                                <tc-collapse ref={collapseRef} open>
                                    <div className="card card-body">
                                        This content is collapsible. Click <strong>Toggle</strong> to show or hide it using Bootstrap's Collapse plugin.
                                    </div>
                                {/* @ts-ignore */}
                                </tc-collapse>
                            </SectionCard>

                            <SectionCard title="open — starts expanded by default">
                                {/* @ts-ignore */}
                                <tc-collapse open>
                                    <div className="card card-body">
                                        This panel starts expanded because the <code>open</code> attribute is present.
                                    </div>
                                {/* @ts-ignore */}
                                </tc-collapse>
                            </SectionCard>

                            <SectionCard title="horizontal — width-based transition">
                                <div className="d-flex gap-2 mb-3">
                                    <button
                                        className="btn btn-primary"
                                        onClick={() => hCollapseRef.current?.toggle()}
                                    >
                                        Toggle horizontal
                                    </button>
                                </div>
                                {/* @ts-ignore */}
                                <tc-collapse ref={hCollapseRef} horizontal open>
                                    <div className="card card-body" style={{ width: '300px' }}>
                                        This collapses horizontally (width transition) instead of vertically.
                                    </div>
                                {/* @ts-ignore */}
                                </tc-collapse>
                            </SectionCard>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default CollapseDemo
