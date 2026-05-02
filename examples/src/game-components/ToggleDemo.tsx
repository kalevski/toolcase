import React, { useEffect, useRef, useState } from 'react'
import { RichPageHeader, RichPageHeaderChip } from '@toolcase/react-components'
import '@toolcase/game-components'

const ToggleDemo: React.FC = () => {
    const ref = useRef<HTMLElement>(null)
    const [on, setOn] = useState(false)

    useEffect(() => {
        const el = ref.current
        if (!el) return
        const handler = (event: any) => setOn(event.detail.on)
        el.addEventListener('change', handler)
        return () => el.removeEventListener('change', handler)
    }, [])

    return (
        <div className="container py-4">
            <div className="row">
                <div className="col-12">
                    <RichPageHeader
                        chips={<RichPageHeaderChip>Game Components</RichPageHeaderChip>}
                        title="Toggle"
                        description="Two-state switch. Emits 'change' on click or Space/Enter."
                    />
                    <div className="d-flex flex-column gap-4 mt-4">
                        {/* @ts-ignore */}
                        <gc-panel bordered>
                            {/* @ts-ignore */}
                            <gc-panel-header header-title={`Interactive — state: ${on ? 'on' : 'off'}`} />
                            {/* @ts-ignore */}
                            <gc-toggle ref={ref} {...(on ? { on: '' } : {})} />
                        {/* @ts-ignore */}
                        </gc-panel>
                        {/* @ts-ignore */}
                        <gc-panel bordered>
                            {/* @ts-ignore */}
                            <gc-panel-header header-title="Default off" />
                            {/* @ts-ignore */}
                            <gc-toggle />
                        {/* @ts-ignore */}
                        </gc-panel>
                        {/* @ts-ignore */}
                        <gc-panel bordered>
                            {/* @ts-ignore */}
                            <gc-panel-header header-title="Default on" />
                            {/* @ts-ignore */}
                            <gc-toggle on />
                        {/* @ts-ignore */}
                        </gc-panel>
                        {/* @ts-ignore */}
                        <gc-panel bordered>
                            {/* @ts-ignore */}
                            <gc-panel-header header-title="Disabled" />
                            <div className="d-flex gap-3 align-items-center">
                                {/* @ts-ignore */}
                                <gc-toggle disabled />
                                {/* @ts-ignore */}
                                <gc-toggle on disabled />
                            </div>
                        {/* @ts-ignore */}
                        </gc-panel>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default ToggleDemo
