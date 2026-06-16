import React, { useEffect, useRef, useState } from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const ControlsRebindListDemo: React.FC = () => {
    const basicRef = useRef<any>(null)
    const interactiveRef = useRef<any>(null)
    const [lastRebound, setLastRebound] = useState<string | null>(null)

    useEffect(() => {
        if (basicRef.current) {
            basicRef.current.bindings = [
                { id: 'move-up', action: 'Move Up', key: 'W' },
                { id: 'move-down', action: 'Move Down', key: 'S' },
                { id: 'move-left', action: 'Move Left', key: 'A' },
                { id: 'move-right', action: 'Move Right', key: 'D' },
                { id: 'jump', action: 'Jump', key: 'Space' },
                { id: 'crouch', action: 'Crouch' },
            ]
        }
    }, [])

    useEffect(() => {
        const el = interactiveRef.current
        if (!el) return

        el.bindings = [
            { id: 'fire', action: 'Fire', key: 'Mouse 1' },
            { id: 'reload', action: 'Reload', key: 'R' },
            { id: 'interact', action: 'Interact', key: 'E' },
            { id: 'melee', action: 'Melee' },
        ]

        const handler = (e: CustomEvent<{ id: string }>) => {
            setLastRebound(e.detail.id)
            console.log('[tc-controls-rebind-list] tc-rebind:', e.detail.id)
        }
        el.addEventListener('tc-rebind', handler as EventListener)
        return () => el.removeEventListener('tc-rebind', handler as EventListener)
    }, [])

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <RichPageHeader
                            chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                            title="ControlsRebindList"
                            description="List of input actions, each rebindable to a key/button. Set rows via the bindings JS property; each row is clickable and keyboard-activatable (Enter/Space) and fires tc-rebind with the action id."
                        />

                        <div className="d-flex flex-column gap-4 mt-4">
                            <SectionCard title="Basic (last row is Unbound)">
                                {/* @ts-ignore */}
                                <tc-controls-rebind-list ref={basicRef}></tc-controls-rebind-list>
                            </SectionCard>

                            <SectionCard title="Interactive (click or press Enter/Space on a row)">
                                {/* @ts-ignore */}
                                <tc-controls-rebind-list ref={interactiveRef}></tc-controls-rebind-list>
                                <p className="mt-3 mb-0 text-secondary">
                                    Last rebind requested:{' '}
                                    <strong>{lastRebound ?? '— none yet —'}</strong>
                                </p>
                            </SectionCard>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default ControlsRebindListDemo
