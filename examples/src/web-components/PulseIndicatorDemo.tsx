import React from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const PulseIndicatorDemo: React.FC = () => (
    <div className="py-4">
        <div className="container">
            <div className="row">
                <div className="col-12">
                    <RichPageHeader
                        chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                        title="PulseIndicator"
                        description="Animated pulsing status dot with a text label. Defaults to success green (live/online). Accepts a custom color and a paused state that freezes the ring."
                    />

                    <div className="d-flex flex-column gap-4 mt-4">
                        <SectionCard title="Default (live/online)">
                            <div className="d-flex flex-wrap gap-4 align-items-center">
                                {/* @ts-ignore */}
                                <tc-pulse-indicator label="Online"></tc-pulse-indicator>
                                {/* @ts-ignore */}
                                <tc-pulse-indicator label="Connected"></tc-pulse-indicator>
                                {/* @ts-ignore */}
                                <tc-pulse-indicator label="Live"></tc-pulse-indicator>
                            </div>
                        </SectionCard>

                        <SectionCard title="Custom color">
                            <div className="d-flex flex-wrap gap-4 align-items-center">
                                {/* @ts-ignore */}
                                <tc-pulse-indicator label="Warning" color="var(--tc-warning)"></tc-pulse-indicator>
                                {/* @ts-ignore */}
                                <tc-pulse-indicator label="Danger" color="var(--tc-danger)"></tc-pulse-indicator>
                                {/* @ts-ignore */}
                                <tc-pulse-indicator label="Info" color="var(--tc-info)"></tc-pulse-indicator>
                                {/* @ts-ignore */}
                                <tc-pulse-indicator label="Custom" color="#a855f7"></tc-pulse-indicator>
                            </div>
                        </SectionCard>

                        <SectionCard title="Paused (frozen ring)">
                            <div className="d-flex flex-wrap gap-4 align-items-center">
                                {/* @ts-ignore */}
                                <tc-pulse-indicator label="Idle" paused></tc-pulse-indicator>
                                {/* @ts-ignore */}
                                <tc-pulse-indicator label="Offline" color="var(--tc-danger)" paused></tc-pulse-indicator>
                            </div>
                        </SectionCard>

                        <SectionCard title="Slotted label content">
                            <div className="d-flex flex-wrap gap-4 align-items-center">
                                {/* @ts-ignore */}
                                <tc-pulse-indicator><strong>Active session</strong></tc-pulse-indicator>
                                {/* @ts-ignore */}
                                <tc-pulse-indicator color="var(--tc-warning)"><em>Degraded</em></tc-pulse-indicator>
                            </div>
                        </SectionCard>
                    </div>
                </div>
            </div>
        </div>
    </div>
)

export default PulseIndicatorDemo
