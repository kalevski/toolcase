import React, { useEffect, useRef } from 'react'

const PluginGridDemo: React.FC = () => {
    const threeColRef = useRef<any>(null)
    const twoColRef = useRef<any>(null)
    const fourColRef = useRef<any>(null)
    const titledRef = useRef<any>(null)

    useEffect(() => {
        const items = [
            {
                name: 'tc-auth',
                description:
                    'Pluggable authentication middleware for Fastify with JWT and session support.',
                iconName: 'Shield',
                install: 'npm install @toolcase/tc-auth',
                downloads: 48200,
            },
            {
                name: 'tc-logger',
                description:
                    'Structured logging plugin with OTLP exporter and ring-buffer reporter.',
                iconName: 'FileText',
                install: 'npm install @toolcase/tc-logger',
                downloads: 127000,
            },
            {
                name: 'tc-cache',
                description: 'In-process LRU cache with optional Redis fallback and TTL support.',
                iconName: 'Database',
                install: 'npm install @toolcase/tc-cache',
                downloads: 3800,
            },
        ]

        if (threeColRef.current) {
            threeColRef.current.items = items
        }
        if (twoColRef.current) {
            twoColRef.current.items = items.slice(0, 2)
        }
        if (fourColRef.current) {
            fourColRef.current.items = [
                ...items,
                {
                    name: 'tc-queue',
                    description: 'Lightweight job queue backed by Redis streams.',
                    iconName: 'List',
                    install: 'npm install @toolcase/tc-queue',
                    downloads: 9100,
                },
            ]
        }
        if (titledRef.current) {
            titledRef.current.items = items

            titledRef.current.addEventListener('tc-copy', (e: CustomEvent) => {
                // eslint-disable-next-line no-console
                console.log('tc-copy fired:', e.detail.install)
            })
        }
    }, [])

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="PluginGrid"
                            description="Responsive grid of plugin cards. Supply plugins via the items JS property. The columns attribute (2 | 3 | 4, default 3) controls layout. Clicking the copy icon dispatches a tc-copy event."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Web Components
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-4 mt-4">
                            <tc-section-card title="3 columns (default) with tc-copy event">
                                {/* @ts-ignore */}
                                <tc-plugin-grid
                                    columns="3"
                                    title-text="Community Plugins"
                                    ref={titledRef}
                                />
                            </tc-section-card>

                            <tc-section-card title="3 columns — items property">
                                {/* @ts-ignore */}
                                <tc-plugin-grid columns="3" ref={threeColRef} />
                            </tc-section-card>

                            <tc-section-card title="2 columns">
                                {/* @ts-ignore */}
                                <tc-plugin-grid columns="2" ref={twoColRef} />
                            </tc-section-card>

                            <tc-section-card title="4 columns">
                                {/* @ts-ignore */}
                                <tc-plugin-grid columns="4" ref={fourColRef} />
                            </tc-section-card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default PluginGridDemo
