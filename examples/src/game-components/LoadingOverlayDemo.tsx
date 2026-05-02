import React, { useEffect, useState } from 'react'
import { RichPageHeader, RichPageHeaderChip } from '@toolcase/react-components'
import '@toolcase/game-components'

const LoadingOverlayDemo: React.FC = () => {
    const [open, setOpen] = useState(false)
    const [progress, setProgress] = useState(0)

    useEffect(() => {
        if (!open) return
        const id = window.setInterval(() => {
            setProgress((p) => {
                const next = p + 0.04
                return next >= 1 ? 0 : next
            })
        }, 200)
        return () => window.clearInterval(id)
    }, [open])

    return (
        <div className="container py-4">
            <div className="row">
                <div className="col-12">
                    <RichPageHeader
                        chips={<RichPageHeaderChip>Game Components</RichPageHeaderChip>}
                        title="Loading Overlay"
                        description="Modal busy spinner + bar. Indeterminate when progress is null."
                    />
                    <div className="d-flex flex-column gap-4 mt-4">
                        {/* @ts-ignore */}
                        <gc-panel bordered>
                            {/* @ts-ignore */}
                            <gc-panel-header header-title="Determinate (auto-cycles)" />
                            <div className="d-flex gap-3">
                                {/* @ts-ignore */}
                                <gc-metal-button onClick={() => { setProgress(0); setOpen(true) }}>Open</gc-metal-button>
                                {/* @ts-ignore */}
                                <gc-metal-button variant="ghost" onClick={() => setOpen(false)}>Close</gc-metal-button>
                            </div>
                        {/* @ts-ignore */}
                        </gc-panel>
                    </div>
                </div>
            </div>
            {/* @ts-ignore */}
            <gc-loading-overlay
                {...(open ? { open: '' } : {})}
                progress={progress}
                label="Loading assets"
                tip="Mind the goblins in the western tunnels."
            />
        </div>
    )
}

export default LoadingOverlayDemo
