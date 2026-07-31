import React, { useMemo, useState } from 'react'
import { useTc } from '@toolcase/web-components/react'

// Builds a small sample sprite (a few embossed glyphs/shapes on transparent bg)
// as a PNG data URL so the generator has something to turn into a normal map.
function makeSampleSource(): string {
    const canvas = document.createElement('canvas')
    canvas.width = 200
    canvas.height = 200
    const ctx = canvas.getContext('2d')!
    ctx.clearRect(0, 0, 200, 200)

    // A rounded slab.
    ctx.fillStyle = '#7c8aa0'
    ctx.fillRect(30, 30, 140, 140)

    // A raised disc.
    const grad = ctx.createRadialGradient(100, 100, 8, 100, 100, 60)
    grad.addColorStop(0, '#ffffff')
    grad.addColorStop(1, '#5b6678')
    ctx.fillStyle = grad
    ctx.beginPath()
    ctx.arc(100, 100, 50, 0, Math.PI * 2)
    ctx.fill()

    // Bold lettering for crisp emboss edges.
    ctx.fillStyle = '#1e293b'
    ctx.font = 'bold 64px system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('TC', 100, 104)

    return canvas.toDataURL('image/png')
}

const TOOLS = ['brush', 'erase', 'mask', 'pan', 'none'] as const
const MODES = ['normal', 'albedo', 'lit', 'lit-surface', 'height'] as const

const NormalMapGeneratorDemo: React.FC = () => {
    const [thumb, setThumb] = useState<string | null>(null)
    const [meta, setMeta] = useState<string | null>(null)
    const [tool, setTool] = useState<(typeof TOOLS)[number]>('brush')
    const [mode, setMode] = useState<(typeof MODES)[number]>('normal')
    const [strength, setStrength] = useState(1.5)
    // `source` accepts a URL string, File, or Blob — set it as a JS property.
    const sample = useMemo(() => makeSampleSource(), [])

    const editorRef = useTc<any>(
        { source: sample },
        {
            'tc-generate': (e: Event) => {
                const detail = (e as CustomEvent).detail
                setThumb(detail.dataUrl)
                setMeta(`${detail.width}×${detail.height}px`)
            },
        }
    )

    const litRef = useTc<HTMLElement>({ source: sample })

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="NormalMapGenerator"
                            description="Canvas-only height→normal map generator — the element renders just the preview canvas. Source, strength, emboss, bevel, blur, channel inversion, active tool, brush shape, preview mode, light, zoom, and pan are all driven from the outside via attributes. Fires tc-generate with the computed normal map whenever inputs change."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Web Components
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-4 mt-4">
                            <tc-section-card title="Editable — tools, preview mode & strength driven from outside">
                                <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
                                    {TOOLS.map((t) => (
                                        <button
                                            key={t}
                                            type="button"
                                            className={`btn btn-sm ${t === tool ? 'btn-dark' : 'btn-outline-secondary'}`}
                                            onClick={() => setTool(t)}
                                        >
                                            {t}
                                        </button>
                                    ))}
                                    <span className="vr mx-1" />
                                    {MODES.map((m) => (
                                        <button
                                            key={m}
                                            type="button"
                                            className={`btn btn-sm ${m === mode ? 'btn-dark' : 'btn-outline-secondary'}`}
                                            onClick={() => setMode(m)}
                                        >
                                            {m}
                                        </button>
                                    ))}
                                </div>
                                <div className="d-flex flex-wrap align-items-center gap-3 mb-3">
                                    <label className="d-flex align-items-center gap-2 mb-0">
                                        <span className="text-body-secondary">Strength</span>
                                        <input
                                            type="range"
                                            min={0}
                                            max={5}
                                            step={0.1}
                                            value={strength}
                                            onChange={(e) => setStrength(Number(e.target.value))}
                                        />
                                        <code>{strength}</code>
                                    </label>
                                    <button
                                        type="button"
                                        className="btn btn-sm btn-outline-secondary"
                                        onClick={() => editorRef.current?.clearPaint()}
                                    >
                                        Clear paint
                                    </button>
                                    <button
                                        type="button"
                                        className="btn btn-sm btn-outline-secondary"
                                        onClick={() => editorRef.current?.clearMask()}
                                    >
                                        Clear mask
                                    </button>
                                </div>

                                {/* @ts-ignore */}
                                <tc-normal-map-generator
                                    ref={editorRef}
                                    editable
                                    tool={tool}
                                    preview-mode={mode}
                                    strength={String(strength)}
                                    emboss-height="2"
                                    bevel-width="4"
                                    brush-size="20"
                                    brush-strength="0.7"
                                />
                                {thumb && (
                                    <div className="d-flex align-items-center gap-3 mt-3">
                                        <img
                                            src={thumb}
                                            alt="Computed normal map"
                                            width={64}
                                            height={64}
                                            style={{
                                                imageRendering: 'pixelated',
                                                border: '1px solid var(--tc-border, #e2e8f0)',
                                            }}
                                        />
                                        <span className="text-body-secondary">
                                            Last <code>tc-generate</code>: {meta}
                                        </span>
                                    </div>
                                )}
                            </tc-section-card>

                            <tc-section-card title="Lit preview with a pinned light (view-only)">
                                {/* @ts-ignore */}
                                <tc-normal-map-generator
                                    ref={litRef}
                                    preview-mode="lit"
                                    strength="2"
                                    emboss-height="3"
                                    light-x="0.2"
                                    light-y="0.15"
                                    light-z="0.7"
                                    light-tracking="off"
                                    ambient="0.25"
                                    invert-y
                                    tool="none"
                                />
                            </tc-section-card>

                            <tc-section-card title="Disabled">
                                {/* @ts-ignore */}
                                <tc-normal-map-generator preview-mode="normal" disabled />
                            </tc-section-card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default NormalMapGeneratorDemo
