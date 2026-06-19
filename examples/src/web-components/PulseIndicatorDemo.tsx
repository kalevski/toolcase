import React from 'react'

const PulseIndicatorDemo: React.FC = () => (
    <div className="py-4">
        <div className="container">
            <div className="row">
                <div className="col-12">
                    <tc-rich-page-header
                        title-text="PulseIndicator"
                        description="Animated pulsing status dot with a text label. Defaults to success green (live/online). Accepts a custom color and a paused state that freezes the ring."
                    >
                        <tc-badge slot="chips" variant="secondary">
                            Web Components
                        </tc-badge>
                    </tc-rich-page-header>

                    <div className="d-flex flex-column gap-4 mt-4">
                        <tc-section-card title="Default (live/online)">
                            <div className="d-flex flex-wrap gap-4 align-items-center">
                                {/* @ts-ignore */}
                                <tc-pulse-indicator label="Online"></tc-pulse-indicator>
                                {/* @ts-ignore */}
                                <tc-pulse-indicator label="Connected"></tc-pulse-indicator>
                                {/* @ts-ignore */}
                                <tc-pulse-indicator label="Live"></tc-pulse-indicator>
                            </div>
                        </tc-section-card>

                        <tc-section-card title="Custom color">
                            <div className="d-flex flex-wrap gap-4 align-items-center">
                                {/* @ts-ignore */}
                                <tc-pulse-indicator
                                    label="Warning"
                                    color="var(--tc-warning)"
                                ></tc-pulse-indicator>
                                {/* @ts-ignore */}
                                <tc-pulse-indicator
                                    label="Danger"
                                    color="var(--tc-danger)"
                                ></tc-pulse-indicator>
                                {/* @ts-ignore */}
                                <tc-pulse-indicator
                                    label="Info"
                                    color="var(--tc-info)"
                                ></tc-pulse-indicator>
                                {/* @ts-ignore */}
                                <tc-pulse-indicator
                                    label="Custom"
                                    color="#a855f7"
                                ></tc-pulse-indicator>
                            </div>
                        </tc-section-card>

                        <tc-section-card title="Paused (frozen ring)">
                            <div className="d-flex flex-wrap gap-4 align-items-center">
                                {/* @ts-ignore */}
                                <tc-pulse-indicator label="Idle" paused></tc-pulse-indicator>
                                {/* @ts-ignore */}
                                <tc-pulse-indicator
                                    label="Offline"
                                    color="var(--tc-danger)"
                                    paused
                                ></tc-pulse-indicator>
                            </div>
                        </tc-section-card>

                        <tc-section-card title="Slotted label content">
                            <div className="d-flex flex-wrap gap-4 align-items-center">
                                {/* @ts-ignore */}
                                <tc-pulse-indicator>
                                    <strong>Active session</strong>
                                </tc-pulse-indicator>
                                {/* @ts-ignore */}
                                <tc-pulse-indicator color="var(--tc-warning)">
                                    <em>Degraded</em>
                                </tc-pulse-indicator>
                            </div>
                        </tc-section-card>
                    </div>
                </div>
            </div>
        </div>
    </div>
)

export default PulseIndicatorDemo
