import React from 'react'
import { useTc } from '@toolcase/web-components/react'

const ActionItemsDemo: React.FC = () => {
    const basicRef = useTc<HTMLElement>(
        {
            items: [
                { key: 'view', label: 'View details' },
                { key: 'edit', label: 'Edit' },
                { key: 'duplicate', label: 'Duplicate' },
                { key: 'divider-1', label: '', divider: true },
                { key: 'archive', label: 'Archive', disabled: true },
                { key: 'delete', label: 'Delete', danger: true },
            ],
        },
        {
            'tc-action-click': (e: Event) => {
                const key = (e as CustomEvent<{ key: string }>).detail.key
                console.log('tc-action-click', key)
            },
        },
    )
    const dangerRef = useTc<HTMLElement>({
        items: [
            { key: 'download', label: 'Download', icon: 'Download' },
            { key: 'share', label: 'Share', icon: 'Share2' },
            { key: 'divider-2', label: '', divider: true },
            { key: 'trash', label: 'Delete', icon: 'Trash2', danger: true },
        ],
        onActionClick: (key: string) => {
            console.log('onActionClick callback', key)
        },
    })

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="ActionItems"
                            description="Dropdown menu button with keyboard-accessible items. Fires tc-action-click when an item is chosen. Set items via the items JS property; icons are Lucide names in PascalCase."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Web Components
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-4 mt-4">
                            <tc-section-card title="Default — items with divider, disabled, and danger variants">
                                <p className="text-muted small mb-3">
                                    Open the browser console to see tc-action-click events.
                                </p>
                                {/* @ts-ignore */}
                                <tc-action-items ref={basicRef} label="Actions" />
                            </tc-section-card>

                            <tc-section-card title="With Lucide icons + onActionClick callback">
                                {/* @ts-ignore */}
                                <tc-action-items ref={dangerRef} label="More" />
                            </tc-section-card>

                            <tc-section-card title="Custom label">
                                <div className="d-flex gap-2">
                                    {/* @ts-ignore */}
                                    <tc-action-items label="Options" />
                                    {/* @ts-ignore */}
                                    <tc-action-items label="Manage" />
                                </div>
                            </tc-section-card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default ActionItemsDemo
