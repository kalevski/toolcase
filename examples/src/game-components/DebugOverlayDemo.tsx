import React, { useEffect, useRef } from 'react'
import { RichPageHeader, RichPageHeaderChip } from '@toolcase/react-components'
import '@toolcase/game-components'

const DebugOverlayDemo: React.FC = () => {
    const ref = useRef<HTMLElement>(null)

    useEffect(() => {
        const el: any = ref.current
        if (!el) return
        el.rows = [
            { label: 'Net', value: '23 ms' },
            { label: 'Players', value: 12 },
        ]
    }, [])

    return (
        <div className="container py-4">
            <div className="row">
                <div className="col-12">
                    <RichPageHeader
                        chips={<RichPageHeaderChip>Game Components</RichPageHeaderChip>}
                        title="Debug Overlay"
                        description="Compact dev HUD. FPS color-coded (good/warning/danger). Custom rows via 'rows' prop."
                    />
                    <div className="d-flex flex-column gap-4 mt-4">
                        {/* @ts-ignore */}
                        <gc-panel bordered>
                            {/* @ts-ignore */}
                            <gc-panel-header header-title="Healthy 60 FPS" />
                            {/* @ts-ignore */}
                            <gc-debug-overlay fps="60" draw-calls="124" triangles="48230" mem-mb="412" />
                        {/* @ts-ignore */}
                        </gc-panel>
                        {/* @ts-ignore */}
                        <gc-panel bordered>
                            {/* @ts-ignore */}
                            <gc-panel-header header-title="Warning (40 FPS)" />
                            {/* @ts-ignore */}
                            <gc-debug-overlay fps="40" draw-calls="380" triangles="92140" mem-mb="892" />
                        {/* @ts-ignore */}
                        </gc-panel>
                        {/* @ts-ignore */}
                        <gc-panel bordered>
                            {/* @ts-ignore */}
                            <gc-panel-header header-title="Danger (22 FPS)" />
                            {/* @ts-ignore */}
                            <gc-debug-overlay fps="22" draw-calls="612" triangles="184320" mem-mb="1340" />
                        {/* @ts-ignore */}
                        </gc-panel>
                        {/* @ts-ignore */}
                        <gc-panel bordered>
                            {/* @ts-ignore */}
                            <gc-panel-header header-title="Custom rows" />
                            {/* @ts-ignore */}
                            <gc-debug-overlay ref={ref} fps="58" />
                        {/* @ts-ignore */}
                        </gc-panel>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default DebugOverlayDemo
