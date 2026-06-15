import React, { useEffect, useRef, useState } from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const paneStyle: React.CSSProperties = {
    padding: '1rem',
    height: '100%',
    boxSizing: 'border-box',
    fontSize: '0.875rem',
    color: 'var(--tc-text, #1e293b)',
}

const ResizablePanelDemo: React.FC = () => {
    const [direction, setDirection] = useState<'horizontal' | 'vertical'>('horizontal')
    const [sizes, setSizes] = useState<[number, number]>([50, 50])
    const ref = useRef<any>(null)

    useEffect(() => {
        const el = ref.current
        if (!el) return
        el.defaultSizes = [60, 40]
        const handler = (e: Event) => {
            const detail = (e as CustomEvent).detail
            if (detail?.sizes) setSizes(detail.sizes as [number, number])
        }
        el.addEventListener('tc-resize', handler)
        return () => el.removeEventListener('tc-resize', handler)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <RichPageHeader
                            chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                            title="Resizable Panel"
                            description="Two-pane layout with a draggable divider, localStorage persistence, and keyboard resizing. Drag the divider, focus it and use the arrow keys, or double-click to reset."
                        />

                        <div className="d-flex flex-column gap-4 mt-4">
                            <SectionCard title="Horizontal / vertical with persistence">
                                <div className="d-flex gap-2 mb-3">
                                    <button
                                        type="button"
                                        className={`btn btn-sm ${direction === 'horizontal' ? 'btn-primary' : 'btn-outline-secondary'}`}
                                        onClick={() => setDirection('horizontal')}
                                    >
                                        Horizontal
                                    </button>
                                    <button
                                        type="button"
                                        className={`btn btn-sm ${direction === 'vertical' ? 'btn-primary' : 'btn-outline-secondary'}`}
                                        onClick={() => setDirection('vertical')}
                                    >
                                        Vertical
                                    </button>
                                </div>

                                <div style={{ height: 320, border: '1px solid var(--tc-border, #e2e8f0)' }}>
                                    {/* @ts-ignore */}
                                    <tc-resizable-panel
                                        ref={ref}
                                        direction={direction}
                                        min-size="15"
                                        storage-key="tc-demo-resizable-panel"
                                    >
                                        <div style={{ ...paneStyle, background: 'var(--tc-surface-hover, #f8fafc)' }}>
                                            <strong>Pane A</strong>
                                            <p className="mb-0 mt-2">
                                                The first slotted child. Resize me by dragging the divider.
                                            </p>
                                        </div>
                                        <div style={{ ...paneStyle, background: 'var(--tc-surface-muted, #f1f5f9)' }}>
                                            <strong>Pane B</strong>
                                            <p className="mb-0 mt-2">
                                                The second slotted child. Sizes persist to localStorage.
                                            </p>
                                        </div>
                                    {/* @ts-ignore */}
                                    </tc-resizable-panel>
                                </div>

                                <div className="form-text mt-2">
                                    Split: {sizes[0].toFixed(0)}% / {sizes[1].toFixed(0)}%
                                </div>
                            </SectionCard>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default ResizablePanelDemo
