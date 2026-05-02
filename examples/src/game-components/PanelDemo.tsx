import React from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'
import '@toolcase/game-components'

const PanelDemo: React.FC = () => (
    <div className="container py-4">
        <div className="row">
            <div className="col-12">
                <RichPageHeader
                    chips={<RichPageHeaderChip>Game Components</RichPageHeaderChip>}
                    title="Panel"
                    description="Gilded square frame surface. Use as a container for HUD, menu, or inventory content."
                />
                <div className="d-flex flex-column gap-4 mt-4">
                    <SectionCard title="Default">
                        {/* @ts-ignore */}
                        <gc-panel style={{ width: '240px' }}>
                            <span style={{ fontFamily: 'var(--fg-body)', color: 'var(--fg-parch)' }}>Plain panel, no border</span>
                            {/* @ts-ignore */}
                        </gc-panel>
                    </SectionCard>

                    <SectionCard title="Bordered">
                        {/* @ts-ignore */}
                        <gc-panel bordered style={{ width: '240px' }}>
                            <span style={{ fontFamily: 'var(--fg-body)', color: 'var(--fg-parch)' }}>Gilded border, bevel stack, dark backdrop</span>
                            {/* @ts-ignore */}
                        </gc-panel>
                    </SectionCard>

                    <SectionCard title="Bordered + Corners">
                        {/* @ts-ignore */}
                        <gc-panel bordered corners style={{ width: '240px' }}>
                            <span style={{ fontFamily: 'var(--fg-body)', color: 'var(--fg-parch)' }}>Gold rune notches at all four corners</span>
                            {/* @ts-ignore */}
                        </gc-panel>
                    </SectionCard>

                    <SectionCard title="Parchment">
                        {/* @ts-ignore */}
                        <gc-panel parchment style={{ width: '240px' }}>
                            <span style={{ fontFamily: 'var(--fg-body)', color: 'var(--fg-ink)' }}>Aged parchment surface — lore, codex, dialogue</span>
                            {/* @ts-ignore */}
                        </gc-panel>
                    </SectionCard>

                    <SectionCard title="Parchment + Bordered">
                        {/* @ts-ignore */}
                        <gc-panel bordered parchment corners style={{ width: '240px' }}>
                            <span style={{ fontFamily: 'var(--fg-body)', color: 'var(--fg-ink)', fontStyle: 'italic' }}>
                                "The ancient tome spoke of relics beyond counting…"
                            </span>
                            {/* @ts-ignore */}
                        </gc-panel>
                    </SectionCard>

                    <SectionCard title="Custom Padding">
                        <div className="d-flex gap-3 flex-wrap">
                            {/* @ts-ignore */}
                            <gc-panel bordered padding="4px 8px" style={{ width: '120px' }}>
                                <span style={{ fontFamily: 'var(--fg-mono)', fontSize: '11px', color: 'var(--fg-gold-bright)' }}>padding: 4px 8px</span>
                                {/* @ts-ignore */}
                            </gc-panel>
                            {/* @ts-ignore */}
                            <gc-panel bordered padding="24px" style={{ width: '120px' }}>
                                <span style={{ fontFamily: 'var(--fg-mono)', fontSize: '11px', color: 'var(--fg-gold-bright)' }}>padding: 24px</span>
                                {/* @ts-ignore */}
                            </gc-panel>
                        </div>
                    </SectionCard>
                </div>
            </div>
        </div>
    </div>
)

export default PanelDemo
