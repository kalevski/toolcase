import React, { useState } from 'react'
import { useTc } from '@toolcase/web-components/react'

const ControlsRebindListDemo: React.FC = () => {
    const [lastRebound, setLastRebound] = useState<string | null>(null)

    const basicRef = useTc<HTMLElement>({
        bindings: [
            { id: 'move-up', action: 'Move Up', key: 'W' },
            { id: 'move-down', action: 'Move Down', key: 'S' },
            { id: 'move-left', action: 'Move Left', key: 'A' },
            { id: 'move-right', action: 'Move Right', key: 'D' },
            { id: 'jump', action: 'Jump', key: 'Space' },
            { id: 'crouch', action: 'Crouch' },
        ],
    })

    const interactiveRef = useTc<HTMLElement>(
        {
            bindings: [
                { id: 'fire', action: 'Fire', key: 'Mouse 1' },
                { id: 'reload', action: 'Reload', key: 'R' },
                { id: 'interact', action: 'Interact', key: 'E' },
                { id: 'melee', action: 'Melee' },
            ],
        },
        {
            'tc-rebind': (e: CustomEvent) => {
                setLastRebound(e.detail.id)
                console.log('[tc-controls-rebind-list] tc-rebind:', e.detail.id)
            },
        }
    )

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="ControlsRebindList"
                            description="List of input actions, each rebindable to a key/button. Set rows via the bindings JS property; each row is clickable and keyboard-activatable (Enter/Space) and fires tc-rebind with the action id."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Web Components
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-4 mt-4">
                            <tc-section-card title="Basic (last row is Unbound)">
                                {/* @ts-ignore */}
                                <tc-controls-rebind-list ref={basicRef}></tc-controls-rebind-list>
                            </tc-section-card>

                            <tc-section-card title="Interactive (click or press Enter/Space on a row)">
                                {/* @ts-ignore */}
                                <tc-controls-rebind-list
                                    ref={interactiveRef}
                                ></tc-controls-rebind-list>
                                <p className="mt-3 mb-0 text-secondary">
                                    Last rebind requested:{' '}
                                    <strong>{lastRebound ?? '— none yet —'}</strong>
                                </p>
                            </tc-section-card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default ControlsRebindListDemo
