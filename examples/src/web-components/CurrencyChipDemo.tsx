import React, { useEffect, useRef } from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const CurrencyChipDemo: React.FC = () => {
    const chipRef = useRef<any>(null)

    // JS-property props (amount as a real number) need a ref — React can't set
    // them as attributes. Demonstrates the reflected numeric `amount` property.
    useEffect(() => {
        const el = chipRef.current
        if (!el) return
        el.glyph = '◆'
        el.amount = 1250000
    }, [])

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <RichPageHeader
                            chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                            title="CurrencyChip"
                            description="Compact currency pill pairing a leading glyph with a formatted amount. The amount is rendered in JetBrains Mono with tabular figures; the glyph picks up the ink accent and can be re-tinted via the color attribute."
                        />

                        <div className="d-flex flex-column gap-4 mt-4">
                            <SectionCard title="Basic">
                                <div className="d-flex flex-wrap gap-3 align-items-center">
                                    {/* @ts-ignore */}
                                    <tc-currency-chip glyph="$" amount="2499"></tc-currency-chip>
                                    {/* @ts-ignore */}
                                    <tc-currency-chip glyph="€" amount="18050"></tc-currency-chip>
                                    {/* @ts-ignore */}
                                    <tc-currency-chip glyph="¢" amount="75"></tc-currency-chip>
                                </div>
                            </SectionCard>

                            <SectionCard title="Symbol glyphs &amp; large amounts">
                                <div className="d-flex flex-wrap gap-3 align-items-center">
                                    {/* @ts-ignore */}
                                    <tc-currency-chip glyph="◆" amount="1250000"></tc-currency-chip>
                                    {/* @ts-ignore */}
                                    <tc-currency-chip glyph="★" amount="9999"></tc-currency-chip>
                                    {/* @ts-ignore */}
                                    <tc-currency-chip glyph="XP" amount="340"></tc-currency-chip>
                                </div>
                            </SectionCard>

                            <SectionCard title="Custom glyph color">
                                <div className="d-flex flex-wrap gap-3 align-items-center">
                                    {/* @ts-ignore */}
                                    <tc-currency-chip glyph="◆" amount="500" color="var(--tc-accent)"></tc-currency-chip>
                                    {/* @ts-ignore */}
                                    <tc-currency-chip glyph="●" amount="42" color="var(--tc-success)"></tc-currency-chip>
                                    {/* @ts-ignore */}
                                    <tc-currency-chip glyph="◆" amount="7" color="var(--tc-danger)"></tc-currency-chip>
                                    {/* @ts-ignore */}
                                    <tc-currency-chip glyph="◆" amount="128" color="#a855f7"></tc-currency-chip>
                                </div>
                            </SectionCard>

                            <SectionCard title="Glyph-less (amount only)">
                                <div className="d-flex flex-wrap gap-3 align-items-center">
                                    {/* @ts-ignore */}
                                    <tc-currency-chip amount="64"></tc-currency-chip>
                                    {/* @ts-ignore */}
                                    <tc-currency-chip amount="1024"></tc-currency-chip>
                                </div>
                            </SectionCard>

                            <SectionCard title="Set via JS properties (ref)">
                                <div className="d-flex flex-wrap gap-3 align-items-center">
                                    {/* @ts-ignore */}
                                    <tc-currency-chip ref={chipRef}></tc-currency-chip>
                                </div>
                            </SectionCard>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default CurrencyChipDemo
