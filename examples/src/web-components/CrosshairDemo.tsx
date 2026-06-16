import React from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const CrosshairDemo: React.FC = () => (
    <div className="py-4">
        <div className="container">
            <div className="row">
                <div className="col-12">
                    <RichPageHeader
                        chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                        title="Crosshair"
                        description="Configurable aiming reticle. Six variants (cross, dot, circle, t-shape, classic, rune) with knobs for size, arm thickness, center gap, color, and a spread offset. Restyled from the game-components original into the toolcase idiom: sharp ink shapes, a single sanctioned ring, no fantasy chrome."
                    />

                    <div className="d-flex flex-column gap-4 mt-4">
                        <SectionCard title="Variants">
                            <div className="d-flex flex-wrap gap-5 align-items-center">
                                {/* @ts-ignore */}
                                <tc-crosshair variant="cross" size="40"></tc-crosshair>
                                {/* @ts-ignore */}
                                <tc-crosshair variant="dot" size="40"></tc-crosshair>
                                {/* @ts-ignore */}
                                <tc-crosshair variant="circle" size="40"></tc-crosshair>
                                {/* @ts-ignore */}
                                <tc-crosshair variant="tShape" size="40"></tc-crosshair>
                                {/* @ts-ignore */}
                                <tc-crosshair variant="classic" size="40"></tc-crosshair>
                                {/* @ts-ignore */}
                                <tc-crosshair variant="rune" size="40"></tc-crosshair>
                            </div>
                        </SectionCard>

                        <SectionCard title="Size & thickness">
                            <div className="d-flex flex-wrap gap-5 align-items-center">
                                {/* @ts-ignore */}
                                <tc-crosshair variant="classic" size="24" thickness="1"></tc-crosshair>
                                {/* @ts-ignore */}
                                <tc-crosshair variant="classic" size="40" thickness="2"></tc-crosshair>
                                {/* @ts-ignore */}
                                <tc-crosshair variant="classic" size="56" thickness="3"></tc-crosshair>
                                {/* @ts-ignore */}
                                <tc-crosshair variant="classic" size="72" thickness="4"></tc-crosshair>
                            </div>
                        </SectionCard>

                        <SectionCard title="Gap & spread">
                            <div className="d-flex flex-wrap gap-5 align-items-center">
                                {/* @ts-ignore */}
                                <tc-crosshair variant="cross" size="48" gap="2"></tc-crosshair>
                                {/* @ts-ignore */}
                                <tc-crosshair variant="cross" size="48" gap="6"></tc-crosshair>
                                {/* @ts-ignore */}
                                <tc-crosshair variant="cross" size="48" gap="6" spread="6"></tc-crosshair>
                                {/* @ts-ignore */}
                                <tc-crosshair variant="cross" size="48" gap="6" spread="12"></tc-crosshair>
                            </div>
                        </SectionCard>

                        <SectionCard title="Color">
                            <div className="d-flex flex-wrap gap-5 align-items-center">
                                {/* @ts-ignore */}
                                <tc-crosshair variant="classic" size="40"></tc-crosshair>
                                {/* @ts-ignore */}
                                <tc-crosshair variant="classic" size="40" color="var(--tc-accent)"></tc-crosshair>
                                {/* @ts-ignore */}
                                <tc-crosshair variant="classic" size="40" color="var(--tc-danger)"></tc-crosshair>
                                {/* @ts-ignore */}
                                <tc-crosshair variant="classic" size="40" color="var(--tc-success)"></tc-crosshair>
                                {/* @ts-ignore */}
                                <tc-crosshair variant="classic" size="40" color="#a855f7"></tc-crosshair>
                            </div>
                        </SectionCard>
                    </div>
                </div>
            </div>
        </div>
    </div>
)

export default CrosshairDemo
