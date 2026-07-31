import React, { useState } from 'react'
import { useTc } from '@toolcase/web-components/react'

const BitmapFontGeneratorDemo: React.FC = () => {
    const [lastOutput, setLastOutput] = useState<string | null>(null)

    // The element renders only its preview canvas — every knob is an attribute, and
    // the structured effect objects can still be set as JS properties.
    const styledRef = useTc<any>(
        {
            fill: {
                type: 'gradient',
                gradientType: 'linear',
                gradientColors: ['#ff6b6b', '#ffd93d'],
                gradientAngle: 90,
            },
            borders: [
                { color: '#1e293b', thickness: 3, align: 'center' },
                { color: '#ffffff', thickness: 6 },
            ],
            dropShadow: { color: '#000000', size: 4, offsetX: 2, offsetY: 2, blur: 4 },
            glow: { color: '#22d3ee', size: 6 },
        },
        {
            'tc-generate': (e: Event) => {
                const detail = (e as CustomEvent).detail
                setLastOutput(
                    `${detail.format.toUpperCase()} · ${detail.width}×${detail.height}px · ${detail.glyphs.length} glyphs`,
                )
            },
        },
    )

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="BitmapFontGenerator"
                            description="Canvas-only bitmap-font atlas generator — the element renders just the live preview canvas; font, fill, outlines, drop shadow, glow, atlas layout, and export format are all configured from the outside via attributes, and generate / copy / download are imperative methods."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Web Components
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-4 mt-4">
                            <tc-section-card title="Attributes only — fill, outline, shadow & glow">
                                {/* @ts-ignore */}
                                <tc-bitmap-font-generator
                                    font-family="Arial"
                                    font-size="48"
                                    text="Toolcase"
                                    fill-type="gradient"
                                    gradient-colors="#38bdf8,#a855f7"
                                    gradient-angle="120"
                                    border-color="#0f172a"
                                    border-thickness="3"
                                    border-align="outer"
                                    shadow-color="#000000"
                                    shadow-size="5"
                                    glow-color="#22d3ee"
                                    glow-size="4"
                                    preview-align="center"
                                    export-format="xml"
                                />
                            </tc-section-card>

                            <tc-section-card title="Properties + imperative export (no built-in chrome)">
                                <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
                                    <button
                                        type="button"
                                        className="btn btn-sm btn-dark"
                                        onClick={() => styledRef.current?.generate()}
                                    >
                                        Generate
                                    </button>
                                    <button
                                        type="button"
                                        className="btn btn-sm btn-outline-secondary"
                                        onClick={() => styledRef.current?.copyDescriptor()}
                                    >
                                        Copy descriptor
                                    </button>
                                    <button
                                        type="button"
                                        className="btn btn-sm btn-outline-secondary"
                                        onClick={() => styledRef.current?.download()}
                                    >
                                        Download
                                    </button>
                                </div>

                                {/* @ts-ignore */}
                                <tc-bitmap-font-generator
                                    ref={styledRef}
                                    font-family="Georgia"
                                    font-size="56"
                                    text="Bitmap!"
                                    export-format="json"
                                    scale="2"
                                    preview-scale="0.9"
                                />
                                {lastOutput && (
                                    <p className="mt-3 mb-0 text-body-secondary">
                                        Last <code>tc-generate</code>: {lastOutput}
                                    </p>
                                )}
                            </tc-section-card>

                            <tc-section-card title="Auto-generate on every config change">
                                {/* @ts-ignore */}
                                <tc-bitmap-font-generator
                                    auto-generate
                                    font-family="Courier New"
                                    font-size="40"
                                    text="AUTO 123"
                                    fill-color="#f8fafc"
                                    border-color="#1e293b"
                                    border-thickness="2"
                                    background="#0f172a"
                                    glyphs-per-row="12"
                                    power-of-two
                                />
                            </tc-section-card>

                            <tc-section-card title="Disabled">
                                {/* @ts-ignore */}
                                <tc-bitmap-font-generator
                                    font-family="Arial"
                                    font-size="40"
                                    text="Locked"
                                    disabled
                                />
                            </tc-section-card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default BitmapFontGeneratorDemo
