import React, { useMemo, useState } from 'react'
import { useTc } from '@toolcase/web-components/react'

// Build a small sample sprite (a glyph on a transparent background) as a PNG data
// URL so the editor has an image to trace shapes over.
function makeSampleSource(): string {
    const canvas = document.createElement('canvas')
    canvas.width = 320
    canvas.height = 240
    const ctx = canvas.getContext('2d')!
    ctx.clearRect(0, 0, 320, 240)

    ctx.fillStyle = '#7c8aa0'
    ctx.beginPath()
    ctx.moveTo(60, 40)
    ctx.lineTo(260, 60)
    ctx.lineTo(280, 200)
    ctx.lineTo(90, 190)
    ctx.closePath()
    ctx.fill()

    ctx.fillStyle = '#1e293b'
    ctx.font = 'bold 72px system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('TC', 168, 124)

    return canvas.toDataURL('image/png')
}

const TOOLS = ['select', 'polygon', 'circle', 'box', 'none'] as const

// Seed shapes applied once via a stable reference so editor mutations are not
// clobbered on re-render.
const SEED_SHAPES = [
    { type: 'box', x: 60, y: 40, w: 220, h: 160 },
    { type: 'circle', x: 168, y: 124, r: 48 },
]

const PhysicsEditorDemo: React.FC = () => {
    // `source` accepts a URL string, File, or Blob — computed once and set as a
    // JS property. Seed shapes come from a stable module-level reference.
    const source = useMemo(() => makeSampleSource(), [])
    const [tool, setTool] = useState<(typeof TOOLS)[number]>('box')
    const [shapesJson, setShapesJson] = useState<string>(JSON.stringify(SEED_SHAPES, null, 2))

    const editorRef = useTc<any>(
        { source, shapes: SEED_SHAPES },
        {
            'tc-change': (e: Event) => {
                const detail = (e as CustomEvent).detail
                setShapesJson(JSON.stringify(detail.shapes, null, 2))
            },
        }
    )

    const pickTool = (next: (typeof TOOLS)[number]) => {
        setTool(next)
        if (editorRef.current) editorRef.current.tool = next
    }

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="PhysicsEditor"
                            description="Canvas-only physics shape editor — the element renders just the drawing canvas. The active tool, handle sizes, snap grid, history depth, and auto-fit tuning are attributes; undo / redo / delete / clear / auto-fit are imperative methods. Fires tc-change with the full shapes array on every mutation."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Web Components
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-4 mt-4">
                            <tc-section-card title="Editor — pick a tool, draw & edit shapes">
                                <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
                                    {TOOLS.map((t) => (
                                        <button
                                            key={t}
                                            type="button"
                                            className={`btn btn-sm ${t === tool ? 'btn-dark' : 'btn-outline-secondary'}`}
                                            onClick={() => pickTool(t)}
                                        >
                                            {t}
                                        </button>
                                    ))}
                                    <span className="vr mx-1" />
                                    <button
                                        type="button"
                                        className="btn btn-sm btn-outline-secondary"
                                        onClick={() => editorRef.current?.undo()}
                                    >
                                        Undo
                                    </button>
                                    <button
                                        type="button"
                                        className="btn btn-sm btn-outline-secondary"
                                        onClick={() => editorRef.current?.redo()}
                                    >
                                        Redo
                                    </button>
                                    <button
                                        type="button"
                                        className="btn btn-sm btn-outline-secondary"
                                        onClick={() => editorRef.current?.autoFit()}
                                    >
                                        Auto-fit
                                    </button>
                                    <button
                                        type="button"
                                        className="btn btn-sm btn-outline-secondary"
                                        onClick={() => editorRef.current?.deleteSelected()}
                                    >
                                        Delete
                                    </button>
                                    <button
                                        type="button"
                                        className="btn btn-sm btn-outline-secondary"
                                        onClick={() => editorRef.current?.clear()}
                                    >
                                        Clear
                                    </button>
                                </div>

                                {/* @ts-ignore */}
                                <tc-physics-editor
                                    ref={editorRef}
                                    tool={tool}
                                    alpha-threshold="8"
                                    simplify-tolerance="1.5"
                                    handle-size="9"
                                    handle-hit="10"
                                    min-size="4"
                                    snap="2"
                                    history-limit="50"
                                />

                                <div className="mt-3">
                                    <span className="text-body-secondary d-block mb-1">
                                        Latest <code>tc-change</code> payload:
                                    </span>
                                    <pre
                                        className="border p-2 mb-0"
                                        style={{ maxHeight: 220, overflow: 'auto', fontSize: 12 }}
                                    >
                                        {shapesJson}
                                    </pre>
                                </div>
                            </tc-section-card>

                            <tc-section-card title="Read-only — shapes from a JSON attribute, handles hidden">
                                {/* @ts-ignore */}
                                <tc-physics-editor
                                    readonly
                                    handles="off"
                                    shapes='[{"type":"box","x":60,"y":40,"w":220,"h":160}]'
                                />
                            </tc-section-card>

                            <tc-section-card title="Disabled">
                                {/* @ts-ignore */}
                                <tc-physics-editor tool="select" disabled />
                            </tc-section-card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default PhysicsEditorDemo
