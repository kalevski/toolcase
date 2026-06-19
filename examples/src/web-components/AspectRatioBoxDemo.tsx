import React from 'react'

const Fill = ({ label }: { label: string }) => (
    <div
        style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--tc-surface-muted)',
            border: '1px solid var(--tc-border)',
            color: 'var(--tc-text-muted)',
            fontFamily: 'var(--tc-font-mono, monospace)',
            fontSize: '12px',
            letterSpacing: '0.08em',
        }}
    >
        {label}
    </div>
)

const AspectRatioBoxDemo: React.FC = () => (
    <div className="py-4">
        <div className="container">
            <div className="row">
                <div className="col-12">
                    <tc-rich-page-header
                        title-text="Aspect Ratio Box"
                        description="Layout primitive that holds its content at a fixed intrinsic aspect ratio. Defaults to 16:9; set the ratio attribute to any width/height pair."
                    >
                        <tc-badge slot="chips" variant="secondary">
                            Web Components
                        </tc-badge>
                    </tc-rich-page-header>

                    <div className="d-flex flex-column gap-4 mt-4">
                        <tc-section-card title="16:9 (default)">
                            {/* @ts-ignore */}
                            <tc-aspect-ratio-box style={{ maxWidth: 480 }}>
                                <Fill label="16 : 9" />
                                {/* @ts-ignore */}
                            </tc-aspect-ratio-box>
                        </tc-section-card>

                        <tc-section-card title="4:3">
                            {/* @ts-ignore */}
                            <tc-aspect-ratio-box ratio="4 / 3" style={{ maxWidth: 360 }}>
                                <Fill label="4 : 3" />
                                {/* @ts-ignore */}
                            </tc-aspect-ratio-box>
                        </tc-section-card>

                        <tc-section-card title="1:1 (square)">
                            {/* @ts-ignore */}
                            <tc-aspect-ratio-box ratio="1 / 1" style={{ maxWidth: 220 }}>
                                <Fill label="1 : 1" />
                                {/* @ts-ignore */}
                            </tc-aspect-ratio-box>
                        </tc-section-card>

                        <tc-section-card title="21:9 (ultrawide)">
                            {/* @ts-ignore */}
                            <tc-aspect-ratio-box ratio="21 / 9" style={{ maxWidth: 560 }}>
                                <Fill label="21 : 9" />
                                {/* @ts-ignore */}
                            </tc-aspect-ratio-box>
                        </tc-section-card>

                        <tc-section-card title="Colon syntax (16:9) wrapping an image">
                            {/* @ts-ignore */}
                            <tc-aspect-ratio-box ratio="16:9" style={{ maxWidth: 480 }}>
                                <img
                                    src="https://picsum.photos/640/360"
                                    alt="Sample"
                                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                />
                                {/* @ts-ignore */}
                            </tc-aspect-ratio-box>
                        </tc-section-card>
                    </div>
                </div>
            </div>
        </div>
    </div>
)

export default AspectRatioBoxDemo
