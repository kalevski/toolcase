import React from 'react'
import { useTc } from '@toolcase/web-components/react'

const MarqueeDemo: React.FC = () => {
    const itemsRef = useTc<HTMLElement>({
        items: [
            '🚀 Launched v3.0',
            '⭐ 12 k GitHub stars',
            '📦 Zero runtime dependencies',
            '🎨 Fully themeable via CSS custom properties',
            '🌍 Used in 40+ countries',
        ],
    })

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="Marquee"
                            description="Horizontally scrolling content banner with configurable speed, direction, and hover-pause behaviour."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Web Components
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-4 mt-4">
                            <tc-section-card title="Slotted children (default slot)">
                                {/* @ts-ignore */}
                                <tc-marquee separator="•" aria-label="Feature highlights">
                                    <span>Sharp corners by mandate</span>
                                    <span>Slate-neutral palette</span>
                                    <span>Accessible by default</span>
                                    <span>Framework-free custom elements</span>
                                    <span>Bootstrap-compatible API</span>
                                    {/* @ts-ignore */}
                                </tc-marquee>
                            </tc-section-card>

                            <tc-section-card title="items property (set via JS ref)">
                                {/* @ts-ignore */}
                                <tc-marquee
                                    ref={itemsRef}
                                    separator="—"
                                    aria-label="Product highlights"
                                />
                            </tc-section-card>

                            <tc-section-card title="Right-to-left direction">
                                {/* @ts-ignore */}
                                <tc-marquee
                                    separator="·"
                                    direction="right"
                                    aria-label="Right-scrolling banner"
                                >
                                    <span>Scrolling right</span>
                                    <span>Direction: right</span>
                                    <span>Content moves →</span>
                                    <span>Use direction="right"</span>
                                    {/* @ts-ignore */}
                                </tc-marquee>
                            </tc-section-card>

                            <tc-section-card title="Speed variants">
                                <div className="d-flex flex-column gap-3">
                                    <div>
                                        <p className="text-muted small mb-1">Slow (speed="30")</p>
                                        {/* @ts-ignore */}
                                        <tc-marquee
                                            separator="•"
                                            speed="30"
                                            aria-label="Slow marquee"
                                        >
                                            <span>Slow and steady</span>
                                            <span>30 pixels per second</span>
                                            <span>Easy to read</span>
                                            <span>Great for announcements</span>
                                            {/* @ts-ignore */}
                                        </tc-marquee>
                                    </div>
                                    <div>
                                        <p className="text-muted small mb-1">
                                            Default (speed="60")
                                        </p>
                                        {/* @ts-ignore */}
                                        <tc-marquee
                                            separator="•"
                                            aria-label="Default speed marquee"
                                        >
                                            <span>Default speed</span>
                                            <span>60 pixels per second</span>
                                            <span>Balanced pace</span>
                                            <span>Suitable for most use cases</span>
                                            {/* @ts-ignore */}
                                        </tc-marquee>
                                    </div>
                                    <div>
                                        <p className="text-muted small mb-1">Fast (speed="150")</p>
                                        {/* @ts-ignore */}
                                        <tc-marquee
                                            separator="•"
                                            speed="150"
                                            aria-label="Fast marquee"
                                        >
                                            <span>Fast scroll</span>
                                            <span>150 pixels per second</span>
                                            <span>High-energy feel</span>
                                            <span>Use sparingly</span>
                                            {/* @ts-ignore */}
                                        </tc-marquee>
                                    </div>
                                </div>
                            </tc-section-card>

                            <tc-section-card title="Pause on hover">
                                <p className="text-muted small mb-2">
                                    Hover over the banner to pause scrolling.
                                </p>
                                {/* @ts-ignore */}
                                <tc-marquee
                                    separator="•"
                                    pause-on-hover
                                    aria-label="Hoverable marquee"
                                >
                                    <span>Hover to pause</span>
                                    <span>Resume on mouse-out</span>
                                    <span>Readable interactive content</span>
                                    <span>Uses pause-on-hover attribute</span>
                                    {/* @ts-ignore */}
                                </tc-marquee>
                            </tc-section-card>

                            <tc-section-card title="No separator">
                                {/* @ts-ignore */}
                                <tc-marquee aria-label="No separator marquee">
                                    <span style={{ marginRight: '2rem' }}>Item one</span>
                                    <span style={{ marginRight: '2rem' }}>Item two</span>
                                    <span style={{ marginRight: '2rem' }}>Item three</span>
                                    <span style={{ marginRight: '2rem' }}>Item four</span>
                                    {/* @ts-ignore */}
                                </tc-marquee>
                            </tc-section-card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default MarqueeDemo
