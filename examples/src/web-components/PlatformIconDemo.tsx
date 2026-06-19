import React, { useEffect, useRef } from 'react'

const ALL_PLATFORMS = ['pc', 'playstation', 'xbox', 'nintendo', 'steam', 'mobile', 'web'] as const

const PlatformIconDemo: React.FC = () => {
    const sizeRef = useRef<any>(null)

    useEffect(() => {
        const el = sizeRef.current
        if (!el) return
        el.platform = 'steam'
        el.size = 28
        el.label = true
    }, [])

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="PlatformIcon"
                            description="Inline platform badge combining a Lucide glyph and an optional label. Attributes: platform, size, label."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Web Components
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-4 mt-4">
                            <tc-section-card title="All platforms — glyph only">
                                <div className="d-flex align-items-center gap-4 flex-wrap">
                                    {ALL_PLATFORMS.map((p) => (
                                        /* @ts-ignore */
                                        <tc-platform-icon key={p} platform={p} />
                                    ))}
                                </div>
                            </tc-section-card>

                            <tc-section-card title="With label">
                                <div className="d-flex align-items-center gap-4 flex-wrap">
                                    {ALL_PLATFORMS.map((p) => (
                                        /* @ts-ignore */
                                        <tc-platform-icon key={p} platform={p} label />
                                    ))}
                                </div>
                            </tc-section-card>

                            <tc-section-card title="Sizes (with label)">
                                <div className="d-flex align-items-center gap-4 flex-wrap">
                                    {/* @ts-ignore */}
                                    <tc-platform-icon platform="playstation" size="12" label />
                                    {/* @ts-ignore */}
                                    <tc-platform-icon platform="playstation" size="16" label />
                                    {/* @ts-ignore */}
                                    <tc-platform-icon platform="playstation" size="24" label />
                                    {/* @ts-ignore */}
                                    <tc-platform-icon platform="playstation" size="32" label />
                                    {/* @ts-ignore */}
                                    <tc-platform-icon platform="playstation" size="48" label />
                                </div>
                            </tc-section-card>

                            <tc-section-card title="JS-property update">
                                {/* @ts-ignore */}
                                <tc-platform-icon ref={sizeRef} />
                                <p className="text-muted mt-2" style={{ fontSize: '0.8125rem' }}>
                                    Set via <code>el.platform</code>, <code>el.size</code>,{' '}
                                    <code>el.label</code> in <code>useEffect</code>.
                                </p>
                            </tc-section-card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default PlatformIconDemo
