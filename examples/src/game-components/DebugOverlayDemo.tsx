import React, { useEffect, useRef } from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'
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
                        <SectionCard title="Healthy 60 FPS">
                            {/* @ts-ignore */}
                            <gc-debug-overlay fps="60" draw-calls="124" triangles="48230" mem-mb="412" />
                        </SectionCard>
                        <SectionCard title="Warning (40 FPS)">
                            {/* @ts-ignore */}
                            <gc-debug-overlay fps="40" draw-calls="380" triangles="92140" mem-mb="892" />
                        </SectionCard>
                        <SectionCard title="Danger (22 FPS)">
                            {/* @ts-ignore */}
                            <gc-debug-overlay fps="22" draw-calls="612" triangles="184320" mem-mb="1340" />
                        </SectionCard>
                        <SectionCard title="Custom rows">
                            {/* @ts-ignore */}
                            <gc-debug-overlay ref={ref} fps="58" />
                        </SectionCard>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default DebugOverlayDemo
