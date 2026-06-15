import React, { useEffect, useRef, useState } from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const BitmapFontGeneratorDemo: React.FC = () => {
    const styledRef = useRef<any>(null)
    const [lastOutput, setLastOutput] = useState<string | null>(null)

    useEffect(() => {
        const el = styledRef.current
        if (!el) return

        // Complex object props are set as JS properties (not attributes).
        el.fill = {
            type: 'gradient',
            gradientType: 'linear',
            gradientColors: ['#ff6b6b', '#ffd93d'],
            gradientAngle: 90,
        }
        el.border = { color: '#1e293b', thickness: 3, align: 'center' }
        el.dropShadow = { color: '#000000', size: 4, offsetX: 2, offsetY: 2, blur: 4 }
        el.glow = { color: '#22d3ee', size: 6 }

        const onGenerate = (e: Event) => {
            const detail = (e as CustomEvent).detail
            setLastOutput(`${detail.format.toUpperCase()} · ${detail.width}×${detail.height}px · ${detail.glyphs.length} glyphs`)
        }
        el.addEventListener('tc-generate', onGenerate)
        return () => el.removeEventListener('tc-generate', onGenerate)
    }, [])

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <RichPageHeader
                            chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                            title="BitmapFontGenerator"
                            description="Canvas bitmap-font atlas generator — solid/gradient fill, stacked outlines, drop shadow, glow, atlas/layout controls, a live preview, and BMFont XML / JSON / .fnt export."
                        />

                        <div className="d-flex flex-column gap-4 mt-4">
                            <SectionCard title="Default (attributes only)">
                                {/* @ts-ignore */}
                                <tc-bitmap-font-generator
                                    font-family="Arial"
                                    font-size="48"
                                    text="Toolcase"
                                    export-format="xml"
                                />
                            </SectionCard>

                            <SectionCard title="Styled (fill / border / shadow / glow via properties)">
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
                            </SectionCard>

                            <SectionCard title="Disabled">
                                {/* @ts-ignore */}
                                <tc-bitmap-font-generator font-family="Arial" font-size="40" text="Locked" disabled />
                            </SectionCard>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default BitmapFontGeneratorDemo
