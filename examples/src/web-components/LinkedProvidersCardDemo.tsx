import React, { useEffect, useRef, useState } from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const PROVIDERS_MIXED = [
    { key: 'github', label: 'GitHub', connected: true, account: 'jane@example.com', icon: 'Github' },
    { key: 'google', label: 'Google', connected: false, icon: 'Globe' },
    { key: 'discord', label: 'Discord', connected: true, account: 'jane#1234', icon: 'MessageCircle' },
    { key: 'twitter', label: 'Twitter / X', connected: false, icon: 'Link' },
]

const PROVIDERS_CONNECTED = [
    { key: 'github', label: 'GitHub', connected: true, account: 'user@example.com', icon: 'Github' },
    { key: 'slack', label: 'Slack', connected: true, account: 'workspace.slack.com', icon: 'MessageCircle' },
]

const BRAND_COLORS: Record<string, string> = {
    github: '#24292f',
    google: '#4285F4',
    discord: '#5865F2',
    twitter: '#1DA1F2',
    github2: '#24292f',
    slack: '#E01E5A',
}

const LinkedProvidersCardDemo: React.FC = () => {
    const mixedRef = useRef<any>(null)
    const connectedRef = useRef<any>(null)
    const emptyRef = useRef<any>(null)
    const customIconRef = useRef<any>(null)

    const [lastEvent, setLastEvent] = useState<string | null>(null)

    useEffect(() => {
        if (mixedRef.current) {
            mixedRef.current.providers = PROVIDERS_MIXED
            mixedRef.current.brandColors = BRAND_COLORS
            mixedRef.current.addEventListener('tc-toggle', (e: CustomEvent) => {
                const { key, connected } = e.detail
                setLastEvent(`tc-toggle: key="${key}", connected=${connected} → will ${connected ? 'disconnect' : 'connect'}`)
            })
        }
    }, [])

    useEffect(() => {
        if (connectedRef.current) {
            connectedRef.current.providers = PROVIDERS_CONNECTED
            connectedRef.current.brandColors = BRAND_COLORS
        }
    }, [])

    useEffect(() => {
        if (emptyRef.current) {
            emptyRef.current.providers = []
        }
    }, [])

    useEffect(() => {
        if (customIconRef.current) {
            customIconRef.current.providers = [
                { key: 'custom-a', label: 'Custom Provider A', connected: false },
                { key: 'custom-b', label: 'Custom Provider B', connected: true, account: 'user@custom.io' },
            ]
            customIconRef.current.iconForProvider = (key: string) => {
                if (key === 'custom-a') return 'Zap'
                if (key === 'custom-b') return 'Star'
                return 'Link'
            }
            customIconRef.current.brandColors = {
                'custom-a': '#f59e0b',
                'custom-b': '#8b5cf6',
            }
        }
    }, [])

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <RichPageHeader
                            chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                            title="LinkedProvidersCard"
                            description="Section card listing OAuth providers with custom icons and brand colors. Set providers via the JS providers property. Dispatches tc-toggle when an action button is clicked."
                        />

                        <div className="d-flex flex-column gap-4 mt-4">
                            <SectionCard title="Mixed connected + disconnected (with brand colors)">
                                {/* @ts-ignore */}
                                <tc-linked-providers-card ref={mixedRef} title="Linked providers" />
                                {lastEvent && (
                                    <p className="mt-2 mb-0" style={{ fontSize: '0.8125rem', color: 'var(--tc-text-muted)' }}>
                                        Last event: <code>{lastEvent}</code>
                                    </p>
                                )}
                            </SectionCard>

                            <SectionCard title="All connected">
                                {/* @ts-ignore */}
                                <tc-linked-providers-card ref={connectedRef} title="Active connections" />
                            </SectionCard>

                            <SectionCard title="Empty state">
                                {/* @ts-ignore */}
                                <tc-linked-providers-card ref={emptyRef} title="Linked providers" empty-label="No providers linked yet." />
                            </SectionCard>

                            <SectionCard title="Custom icon resolver + brand colors">
                                {/* @ts-ignore */}
                                <tc-linked-providers-card ref={customIconRef} title="Custom providers" />
                            </SectionCard>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default LinkedProvidersCardDemo
