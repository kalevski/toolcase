import React, { useEffect, useRef } from 'react'

const DangerZoneActionsDemo: React.FC = () => {
    const basicRef = useRef<any>(null)
    const withIconsRef = useRef<any>(null)
    const withDisabledRef = useRef<any>(null)

    useEffect(() => {
        if (basicRef.current) {
            basicRef.current.actions = [
                {
                    key: 'delete-account',
                    title: 'Delete account',
                    description:
                        'Permanently remove your account and all associated data. This action cannot be undone.',
                    buttonLabel: 'Delete account',
                },
                {
                    key: 'reset-data',
                    title: 'Reset all data',
                    description:
                        'Wipe all project data and start fresh. Your plan and billing will remain active.',
                    buttonLabel: 'Reset data',
                },
            ]
        }
    }, [])

    useEffect(() => {
        if (withIconsRef.current) {
            withIconsRef.current.actions = [
                {
                    key: 'revoke-tokens',
                    title: 'Revoke all tokens',
                    description:
                        'Immediately invalidate all active API tokens. Integrations using these tokens will stop working.',
                    buttonLabel: 'Revoke tokens',
                    icon: 'KeyRound',
                },
                {
                    key: 'delete-workspace',
                    title: 'Delete workspace',
                    description:
                        'Remove this workspace and all its members, projects, and resources permanently.',
                    buttonLabel: 'Delete workspace',
                    icon: 'Trash2',
                },
            ]
        }
    }, [])

    useEffect(() => {
        if (withDisabledRef.current) {
            withDisabledRef.current.actions = [
                {
                    key: 'archive-project',
                    title: 'Archive project',
                    description:
                        'Move this project to the archive. It will become read-only and hidden from the main list.',
                    buttonLabel: 'Archive',
                    icon: 'Archive',
                },
                {
                    key: 'delete-project',
                    title: 'Delete project',
                    description:
                        'Permanently delete this project and all its resources. You must archive it first.',
                    buttonLabel: 'Delete project',
                    icon: 'Trash2',
                    disabled: true,
                },
            ]

            withDisabledRef.current.addEventListener('tc-action-click', (e: CustomEvent) => {
                console.log('[tc-danger-zone-actions] tc-action-click:', e.detail.key)
            })
        }
    }, [])

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="DangerZoneActions"
                            description="List of destructive actions with a danger-colored panel and outline-danger buttons. Set actions via the JS actions property."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Web Components
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-4 mt-4">
                            <tc-section-card title="Basic">
                                {/* @ts-ignore */}
                                <tc-danger-zone-actions ref={basicRef}></tc-danger-zone-actions>
                            </tc-section-card>

                            <tc-section-card title="With icons">
                                {/* @ts-ignore */}
                                <tc-danger-zone-actions ref={withIconsRef}></tc-danger-zone-actions>
                            </tc-section-card>

                            <tc-section-card title="With disabled action (logs tc-action-click to console)">
                                {/* @ts-ignore */}
                                <tc-danger-zone-actions
                                    ref={withDisabledRef}
                                ></tc-danger-zone-actions>
                            </tc-section-card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default DangerZoneActionsDemo
