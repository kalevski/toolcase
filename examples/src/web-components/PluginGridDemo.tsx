import React, { useEffect, useRef } from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const PluginGridDemo: React.FC = () => {
    const threeColRef = useRef<any>(null)
    const twoColRef = useRef<any>(null)
    const fourColRef = useRef<any>(null)
    const titledRef = useRef<any>(null)

    useEffect(() => {
        const items = [
            {
                name: 'tc-auth',
                description: 'Pluggable authentication middleware for Fastify with JWT and session support.',
                iconName: 'Shield',
                install: 'npm install @toolcase/tc-auth',
                downloads: 48200,
            },
            {
                name: 'tc-logger',
                description: 'Structured logging plugin with OTLP exporter and ring-buffer reporter.',
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
                        <RichPageHeader
                            chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                            title="PluginGrid"
                            description="Responsive grid of plugin cards. Supply plugins via the items JS property. The columns attribute (2 | 3 | 4, default 3) controls layout. Clicking the copy icon dispatches a tc-copy event."
                        />

                        <div className="d-flex flex-column gap-4 mt-4">

                            <SectionCard title="3 columns (default) with tc-copy event">
                                {/* @ts-ignore */}
                                <tc-plugin-grid columns="3" title-text="Community Plugins" ref={titledRef} />
                            </SectionCard>

                            <SectionCard title="3 columns — items property">
                                {/* @ts-ignore */}
                                <tc-plugin-grid columns="3" ref={threeColRef} />
                            </SectionCard>

                            <SectionCard title="2 columns">
                                {/* @ts-ignore */}
                                <tc-plugin-grid columns="2" ref={twoColRef} />
                            </SectionCard>

                            <SectionCard title="4 columns">
                                {/* @ts-ignore */}
                                <tc-plugin-grid columns="4" ref={fourColRef} />
                            </SectionCard>

                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default PluginGridDemo
