import React, { useState } from 'react'
import { useTc } from '@toolcase/web-components/react'

const InstallTabsDemo: React.FC = () => {
    const [lastEvent, setLastEvent] = useState<string | null>(null)

    const eventsRef = useTc<HTMLElement>(
        {
            onCopy: (detail: { manager: string; command: string }) => {
                console.log('[InstallTabs] onCopy callback', detail)
            },
            onChange: (detail: { manager: string }) => {
                console.log('[InstallTabs] onChange callback', detail)
            },
        },
        {
            'tc-copy': (e: CustomEvent) => {
                setLastEvent(`tc-copy: manager=${e.detail.manager}, command="${e.detail.command}"`)
            },
            'tc-change': (e: CustomEvent) => {
                setLastEvent(`tc-change: manager=${e.detail.manager}`)
            },
        }
    )

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="InstallTabs"
                            description="Tabbed install commands for npm, yarn, pnpm, and bun with a copy button. Keyboard navigable with roving tabindex."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Web Components
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-4 mt-4">
                            <tc-section-card title="Basic install — tc-copy and tc-change events">
                                {/* @ts-ignore */}
                                <tc-install-tabs
                                    ref={eventsRef}
                                    package="@toolcase/web-components"
                                />
                                {lastEvent && (
                                    <p className="mt-2 text-muted" style={{ fontSize: '0.8rem' }}>
                                        <code>{lastEvent}</code>
                                    </p>
                                )}
                            </tc-section-card>

                            <tc-section-card title="Dev dependency (dev attribute)">
                                {/* @ts-ignore */}
                                <tc-install-tabs package="vitest" dev />
                            </tc-section-card>

                            <tc-section-card title="Global install (global attribute)">
                                {/* @ts-ignore */}
                                <tc-install-tabs package="typescript" global />
                            </tc-section-card>

                            <tc-section-card title="Limited managers (npm and pnpm only, JS property)">
                                <LimitedManagersExample />
                            </tc-section-card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

const LimitedManagersExample: React.FC = () => {
    const ref = useTc<HTMLElement>({ managers: ['npm', 'pnpm'] })

    return (
        /* @ts-ignore */
        <tc-install-tabs ref={ref} package="@toolcase/base" default-manager="pnpm" />
    )
}

export default InstallTabsDemo
