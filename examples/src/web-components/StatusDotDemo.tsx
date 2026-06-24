import React from 'react'

const StatusDotDemo: React.FC = () => (
    <div className="py-4">
        <div className="container">
            <div className="row">
                <div className="col-12">
                    <tc-rich-page-header
                        title-text="StatusDot"
                        description="Colour-coded status indicator dot with optional label text and a pulsing ring animation."
                    >
                        <tc-badge slot="chips" variant="secondary">
                            Web Components
                        </tc-badge>
                    </tc-rich-page-header>

                    <div className="d-flex flex-column gap-4 mt-4">
                        <tc-section-card title="Statuses (dot only)">
                            <div className="d-flex flex-wrap gap-3 align-items-center">
                                {/* @ts-ignore */}
                                <tc-status-dot status="online"></tc-status-dot>
                                {/* @ts-ignore */}
                                <tc-status-dot status="busy"></tc-status-dot>
                                {/* @ts-ignore */}
                                <tc-status-dot status="away"></tc-status-dot>
                                {/* @ts-ignore */}
                                <tc-status-dot status="offline"></tc-status-dot>
                            </div>
                        </tc-section-card>

                        <tc-section-card title="Statuses with labels">
                            <div className="d-flex flex-wrap gap-4 align-items-center">
                                {/* @ts-ignore */}
                                <tc-status-dot status="online" label="Online"></tc-status-dot>
                                {/* @ts-ignore */}
                                <tc-status-dot status="busy" label="Busy"></tc-status-dot>
                                {/* @ts-ignore */}
                                <tc-status-dot status="away" label="Away"></tc-status-dot>
                                {/* @ts-ignore */}
                                <tc-status-dot status="offline" label="Offline"></tc-status-dot>
                            </div>
                        </tc-section-card>

                        <tc-section-card title="Sizes">
                            <div className="d-flex flex-wrap gap-4 align-items-center">
                                {/* @ts-ignore */}
                                <tc-status-dot
                                    status="online"
                                    size="small"
                                    label="Small"
                                ></tc-status-dot>
                                {/* @ts-ignore */}
                                <tc-status-dot
                                    status="online"
                                    size="default"
                                    label="Default"
                                ></tc-status-dot>
                                {/* @ts-ignore */}
                                <tc-status-dot
                                    status="online"
                                    size="large"
                                    label="Large"
                                ></tc-status-dot>
                            </div>
                        </tc-section-card>

                        <tc-section-card title="Pulse animation">
                            <div className="d-flex flex-wrap gap-4 align-items-center">
                                {/* @ts-ignore */}
                                <tc-status-dot status="online" label="Online" pulse></tc-status-dot>
                                {/* @ts-ignore */}
                                <tc-status-dot status="busy" label="Busy" pulse></tc-status-dot>
                                {/* @ts-ignore */}
                                <tc-status-dot status="away" label="Away" pulse></tc-status-dot>
                                {/* @ts-ignore */}
                                <tc-status-dot status="offline" label="Offline"></tc-status-dot>
                            </div>
                        </tc-section-card>

                        <tc-section-card title="Pulse · all sizes">
                            <div className="d-flex flex-wrap gap-4 align-items-center">
                                {/* @ts-ignore */}
                                <tc-status-dot status="online" size="small" pulse></tc-status-dot>
                                {/* @ts-ignore */}
                                <tc-status-dot status="online" size="default" pulse></tc-status-dot>
                                {/* @ts-ignore */}
                                <tc-status-dot status="online" size="large" pulse></tc-status-dot>
                            </div>
                        </tc-section-card>
                    </div>
                </div>
            </div>
        </div>
    </div>
)

export default StatusDotDemo
