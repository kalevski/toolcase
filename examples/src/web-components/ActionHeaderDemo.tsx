import React, { useEffect, useRef } from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'
import type { ActionHeaderAction } from '@toolcase/web-components'

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
    const basicRef = useRef<HTMLElement>(null)
    const iconRef = useRef<HTMLElement>(null)
    const disabledRef = useRef<HTMLElement>(null)
    const allDisabledRef = useRef<HTMLElement>(null)

    useEffect(() => {
        if (basicRef.current) {
            const el = basicRef.current as HTMLElement & { actions: ActionHeaderAction[]; onExec: (key: string) => void }
            el.actions = BASIC_ACTIONS
            el.onExec = (key: string) => alert(`Exec: ${key}`)
        }
        if (iconRef.current) {
            const el = iconRef.current as HTMLElement & { actions: ActionHeaderAction[] }
            el.actions = ICON_ONLY_ACTIONS
        }
        if (disabledRef.current) {
            const el = disabledRef.current as HTMLElement & { actions: ActionHeaderAction[] }
            el.actions = DISABLED_ACTIONS
        }
        if (allDisabledRef.current) {
            const el = allDisabledRef.current as HTMLElement & { actions: ActionHeaderAction[]; disabled: boolean }
            el.actions = BASIC_ACTIONS
            el.disabled = true
        }
    }, [])

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <RichPageHeader
                            chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                            title="ActionHeader"
                            description="A flex header row with a content region on the left and a row of action buttons on the right. Actions dispatch a tc-exec event when clicked."
                        />

                        <div className="d-flex flex-column gap-4 mt-4">
                            <SectionCard title="Basic (label + icon actions)">
                                {/* @ts-ignore */}
                                <tc-action-header ref={basicRef}>
                                    <strong>Users</strong>
                                </tc-action-header>
                            </SectionCard>

                            <SectionCard title="Icon-only actions">
                                {/* @ts-ignore */}
                                <tc-action-header ref={iconRef}>
                                    <span>Documents</span>
                                </tc-action-header>
                            </SectionCard>

                            <SectionCard title="Partially disabled (action-level)">
                                {/* @ts-ignore */}
                                <tc-action-header ref={disabledRef}>
                                    <span>Draft</span>
                                </tc-action-header>
                            </SectionCard>

                            <SectionCard title="Fully disabled (host-level)">
                                {/* @ts-ignore */}
                                <tc-action-header ref={allDisabledRef}>
                                    <span>Read-only section</span>
                                </tc-action-header>
                            </SectionCard>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default ActionHeaderDemo
