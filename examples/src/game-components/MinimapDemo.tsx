import React, { useEffect, useRef } from 'react'
import { RichPageHeader, RichPageHeaderChip } from '@toolcase/react-components'
import '@toolcase/game-components'

const MARKERS = [
    { id: 'a', x: 30, y: 30, color: '#d44a3a' },
    { id: 'b', x: 70, y: 50, color: '#9fc55a' },
    { id: 'c', x: 50, y: 80, color: '#f0d27a', size: 10 }
]

const MinimapDemo: React.FC = () => {
    const ref = useRef<HTMLElement>(null)

    useEffect(() => {
        const el = ref.current as any
        if (!el) return
        el.markers = MARKERS
    }, [])

    return (
        <div className="container py-4">
            <div className="row">
                <div className="col-12">
                    <RichPageHeader
                        chips={<RichPageHeaderChip>Game Components</RichPageHeaderChip>}
                        title="Minimap"
                        description="Square framed minimap projecting world coordinates and markers around player."
                    />
                    <div className="d-flex flex-column gap-4 mt-4">
                        {/* @ts-ignore */}
                        <gc-panel bordered>
                            {/* @ts-ignore */}
                            <gc-panel-header header-title="With markers" />
                            {/* @ts-ignore */}
                            <gc-minimap ref={ref} world-x="0" world-y="0" world-width="100" world-height="100" size="220" />
                        {/* @ts-ignore */}
                        </gc-panel>
                        {/* @ts-ignore */}
                        <gc-panel bordered>
                            {/* @ts-ignore */}
                            <gc-panel-header header-title="Rotated" />
                            {/* @ts-ignore */}
                            <gc-minimap world-x="0" world-y="0" world-width="100" world-height="100" size="180" rotation="45" />
                        {/* @ts-ignore */}
                        </gc-panel>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default MinimapDemo
