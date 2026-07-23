import React from 'react'
import type { ActionHeaderAction } from '@toolcase/web-components'
import { useTc } from '@toolcase/web-components/react'

const BASIC_ACTIONS: ActionHeaderAction[] = [
    { key: 'edit', label: 'Edit', icon: 'Pencil' },
    { key: 'delete', label: 'Delete', variant: 'danger' },
]

const ICON_ONLY_ACTIONS: ActionHeaderAction[] = [
    { key: 'download', icon: 'Download' },
    { key: 'refresh', icon: 'RefreshCw' },
    { key: 'settings', icon: 'Settings' },
]

const DISABLED_ACTIONS: ActionHeaderAction[] = [
    { key: 'save', label: 'Save', icon: 'Save' },
    { key: 'discard', label: 'Discard', disabled: true },
]

const ActionHeaderDemo: React.FC = () => {
    const basicRef = useTc<HTMLElement>({
        actions: BASIC_ACTIONS,
        onExec: (key: string) => alert(`Exec: ${key}`),
    })
    const iconRef = useTc<HTMLElement>({ actions: ICON_ONLY_ACTIONS })
    const disabledRef = useTc<HTMLElement>({ actions: DISABLED_ACTIONS })
    const allDisabledRef = useTc<HTMLElement>({
        actions: BASIC_ACTIONS,
        disabled: true,
    })

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="ActionHeader"
                            description="A flex header row with a content region on the left and a row of action buttons on the right. Actions dispatch a tc-exec event when clicked."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Web Components
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-4 mt-4">
                            <tc-section-card title="Basic (label + icon actions)">
                                {/* @ts-ignore */}
                                <tc-action-header ref={basicRef}>
                                    <strong>Users</strong>
                                </tc-action-header>
                            </tc-section-card>

                            <tc-section-card title="Icon-only actions">
                                {/* @ts-ignore */}
                                <tc-action-header ref={iconRef}>
                                    <span>Documents</span>
                                </tc-action-header>
                            </tc-section-card>

                            <tc-section-card title="Partially disabled (action-level)">
                                {/* @ts-ignore */}
                                <tc-action-header ref={disabledRef}>
                                    <span>Draft</span>
                                </tc-action-header>
                            </tc-section-card>

                            <tc-section-card title="Fully disabled (host-level)">
                                {/* @ts-ignore */}
                                <tc-action-header ref={allDisabledRef}>
                                    <span>Read-only section</span>
                                </tc-action-header>
                            </tc-section-card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default ActionHeaderDemo
