import React, { useState } from 'react'
import { useTc } from '@toolcase/web-components/react'

const BitmapFontGeneratorDemo: React.FC = () => {
    const [lastOutput, setLastOutput] = useState<string | null>(null)

    // Complex object props are set as JS properties (not attributes).
    const styledRef = useTc<HTMLElement>(
        {
            fill: {
                type: 'gradient',
                gradientType: 'linear',
                gradientColors: ['#ff6b6b', '#ffd93d'],
                gradientAngle: 90,
            },
            border: { color: '#1e293b', thickness: 3, align: 'center' },
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
                            description="Canvas bitmap-font atlas generator — solid/gradient fill, stacked outlines, drop shadow, glow, atlas/layout controls, a live preview, and BMFont XML / JSON / .fnt export."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Web Components
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-4 mt-4">
                            <tc-section-card title="Default (attributes only)">
                                {/* @ts-ignore */}
                                <tc-bitmap-font-generator
                                    font-family="Arial"
                                    font-size="48"
                                    text="Toolcase"
                                    export-format="xml"
                                />
                            </tc-section-card>

                            <tc-section-card title="Styled (fill / border / shadow / glow via properties)">
                                {/* @ts-ignore */}
                                <tc-bitmap-font-generator
                                    ref={styledRef}
                                    font-family="Georgia"
                                    font-size="56"
                                    text="Bitmap!"
                                    export-format="json"
                                    scale="2"
                                />
                                {lastOutput && (
                                    <p className="mt-3 mb-0 text-body-secondary">
                                        Last <code>tc-generate</code>: {lastOutput}
                                    </p>
                                )}
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
