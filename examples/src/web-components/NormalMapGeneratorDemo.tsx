import React, { useEffect, useRef, useState } from 'react'

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

const NormalMapGeneratorDemo: React.FC = () => {
    const editorRef = useRef<any>(null)
    const litRef = useRef<any>(null)
    const [thumb, setThumb] = useState<string | null>(null)
    const [meta, setMeta] = useState<string | null>(null)

    useEffect(() => {
        const sample = makeSampleSource()

        const el = editorRef.current
        if (el) {
            // `source` accepts a URL string, File, or Blob — set it as a JS property.
            el.source = sample
        }
        if (litRef.current) litRef.current.source = sample

        const onGenerate = (e: Event) => {
            const detail = (e as CustomEvent).detail
            setThumb(detail.dataUrl)
            setMeta(`${detail.width}×${detail.height}px`)
        }
        el?.addEventListener('tc-generate', onGenerate)
        return () => el?.removeEventListener('tc-generate', onGenerate)
    }, [])

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="NormalMapGenerator"
                            description="Interactive height→normal map generator — emboss/bevel controls, a Sobel gradient computed in JS, brush/erase/mask painting, view panning, and a lit preview. Fires tc-generate with the computed normal map whenever inputs change."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Web Components
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-4 mt-4">
                            <tc-section-card title="Editable — paint, switch tools & preview modes">
                                {/* @ts-ignore */}
                                <tc-normal-map-generator
                                    ref={editorRef}
                                    editable
                                    tool="brush"
                                    preview-mode="normal"
                                    strength="1.5"
                                    emboss-height="2"
                                    bevel-width="4"
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

                            <tc-section-card title="Lit preview (view-only)">
                                {/* @ts-ignore */}
                                <tc-normal-map-generator
                                    ref={litRef}
                                    preview-mode="lit"
                                    strength="2"
                                    emboss-height="3"
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
