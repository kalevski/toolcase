import React, { useRef, useEffect, useState } from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const InstallTabsDemo: React.FC = () => {
    const eventsRef = useRef<any>(null)
    const [lastEvent, setLastEvent] = useState<string | null>(null)

    useEffect(() => {
        const el = eventsRef.current
        if (!el) return

        const onCopy = (e: CustomEvent) => {
            setLastEvent(`tc-copy: manager=${e.detail.manager}, command="${e.detail.command}"`)
        }
        const onChange = (e: CustomEvent) => {
            setLastEvent(`tc-change: manager=${e.detail.manager}`)
        }

        el.onCopy = (detail: { manager: string; command: string }) => {
            console.log('[InstallTabs] onCopy callback', detail)
        }
        el.onChange = (detail: { manager: string }) => {
            console.log('[InstallTabs] onChange callback', detail)
        }

        el.addEventListener('tc-copy', onCopy)
        el.addEventListener('tc-change', onChange)
        return () => {
            el.removeEventListener('tc-copy', onCopy)
            el.removeEventListener('tc-change', onChange)
        }
    }, [])

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <RichPageHeader
                            chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                            title="InstallTabs"
                            description="Tabbed install commands for npm, yarn, pnpm, and bun with a copy button. Keyboard navigable with roving tabindex."
                        />

                        <div className="d-flex flex-column gap-4 mt-4">

                            <SectionCard title="Basic install — tc-copy and tc-change events">
                                {/* @ts-ignore */}
                                <tc-install-tabs ref={eventsRef} package="@toolcase/web-components" />
                                {lastEvent && (
                                    <p className="mt-2 text-muted" style={{ fontSize: '0.8rem' }}>
                                        <code>{lastEvent}</code>
                                    </p>
                                )}
                            </SectionCard>

                            <SectionCard title="Dev dependency (dev attribute)">
                                {/* @ts-ignore */}
                                <tc-install-tabs package="vitest" dev />
                            </SectionCard>

                            <SectionCard title="Global install (global attribute)">
                                {/* @ts-ignore */}
                                <tc-install-tabs package="typescript" global />
                            </SectionCard>

                            <SectionCard title="Limited managers (npm and pnpm only, JS property)">
                                <LimitedManagersExample />
                            </SectionCard>

                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

const LimitedManagersExample: React.FC = () => {
    const ref = useRef<any>(null)

    useEffect(() => {
        const el = ref.current
        if (!el) return
        el.managers = ['npm', 'pnpm']
    }, [])

    return (
        /* @ts-ignore */
        <tc-install-tabs ref={ref} package="@toolcase/base" default-manager="pnpm" />
    )
}

export default InstallTabsDemo
