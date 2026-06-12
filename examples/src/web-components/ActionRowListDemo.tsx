import React, { useEffect, useRef } from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const ActionRowListDemo: React.FC = () => {
    const basicRef = useRef<any>(null)
    const outlineRef = useRef<any>(null)
    const customIconRef = useRef<any>(null)
    const noIconRef = useRef<any>(null)

    useEffect(() => {
        if (!basicRef.current) return
        basicRef.current.actions = [
            { key: 'profile', title: 'Profile settings', description: 'Manage your account and preferences', label: 'Edit' },
            { key: 'billing', title: 'Billing', description: 'Update payment methods and plan', label: 'Manage' },
            { key: 'security', title: 'Security', description: 'Two-factor authentication and sessions', label: 'Configure' },
            { key: 'api', title: 'API access', description: 'Generate and revoke API tokens', label: 'View tokens', disabled: true },
        ]
        const handler = (e: Event) => {
            const key = (e as CustomEvent<{ key: string }>).detail.key
            console.log('tc-action-click', key)
        }
        basicRef.current.addEventListener('tc-action-click', handler)
        return () => basicRef.current?.removeEventListener('tc-action-click', handler)
    }, [])

    useEffect(() => {
        if (!outlineRef.current) return
        outlineRef.current.actions = [
            { key: 'export', title: 'Export data', description: 'Download all records as CSV', label: 'Export', icon: 'Download' },
            { key: 'import', title: 'Import data', description: 'Upload a CSV to bulk-create records', label: 'Import', icon: 'Upload' },
            { key: 'delete', title: 'Delete account', description: 'Permanently removes all data', label: 'Delete', variant: 'danger' },
        ]
        outlineRef.current.onActionClick = (key: string) => {
            console.log('onActionClick callback', key)
        }
    }, [])

    useEffect(() => {
        if (!customIconRef.current) return
        customIconRef.current.actions = [
            { key: 'notify', title: 'Notifications', description: 'Email and push settings', label: 'Configure' },
            { key: 'theme', title: 'Appearance', description: 'Light/dark mode and fonts', label: 'Customize' },
        ]
    }, [])

    useEffect(() => {
        if (!noIconRef.current) return
        noIconRef.current.actions = [
            { key: 'downloads', title: 'Downloads', description: 'Files and exports', label: 'View' },
            { key: 'logs', title: 'Activity logs', description: 'Recent account activity', label: 'Browse' },
        ]
    }, [])

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <RichPageHeader
                            chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                            title="ActionRowList"
                            description="Vertical list of action rows with title, optional description, and a CTA button. Fires tc-action-click (bubbles) when a row's button is clicked. Set actions via the actions JS property."
                        />

                        <div className="d-flex flex-column gap-4 mt-4">
                            <SectionCard title="Default — solid CTA, trailing chevron, disabled row">
                                <p className="text-muted small mb-3">Open the browser console to see tc-action-click events.</p>
                                {/* @ts-ignore */}
                                <tc-action-row-list ref={basicRef} />
                            </SectionCard>

                            <SectionCard title="Outline variant with action icons + onActionClick callback">
                                {/* @ts-ignore */}
                                <tc-action-row-list ref={outlineRef} outline />
                            </SectionCard>

                            <SectionCard title="Custom trailing icon via trailing-icon attribute">
                                {/* @ts-ignore */}
                                <tc-action-row-list ref={customIconRef} trailing-icon="ArrowRight" />
                            </SectionCard>

                            <SectionCard title="No trailing icon (trailing-icon=none)">
                                {/* @ts-ignore */}
                                <tc-action-row-list ref={noIconRef} trailing-icon="none" />
                            </SectionCard>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default ActionRowListDemo
