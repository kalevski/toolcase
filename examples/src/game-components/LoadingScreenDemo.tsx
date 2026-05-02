import React, { useEffect, useRef, useState } from 'react'
import { RichPageHeader, RichPageHeaderChip } from '@toolcase/react-components'
import '@toolcase/game-components'

const TIPS = [
    'Bind a torch to your offhand to light dim chambers.',
    'Holding block reduces stamina drain when bracing a heavy strike.',
    'Bosses telegraph their phase change with a glyph in the sky.',
    'Sigil shards stack — burn three at once for the relic effect.',
]

const LoadingScreenDemo: React.FC = () => {
    const refTips = useRef<HTMLElement>(null)
    const [progress, setProgress] = useState(0.18)

    useEffect(() => {
        const el: any = refTips.current
        if (el) el.tips = TIPS
    }, [])

    useEffect(() => {
        const id = window.setInterval(() => {
            setProgress((p) => {
                const next = p + 0.04
                return next > 1 ? 0 : next
            })
        }, 600)
        return () => window.clearInterval(id)
    }, [])

    return (
        <div className="container py-4">
            <div className="row">
                <div className="col-12">
                    <RichPageHeader
                        chips={<RichPageHeaderChip>Game Components</RichPageHeaderChip>}
                        title="Loading Screen"
                        description="Progress bar with eyebrow, title, label row, and cycling tips."
                    />
                    <div className="d-flex flex-column gap-4 mt-4">
                        {/* @ts-ignore */}
                        <gc-panel bordered>
                            {/* @ts-ignore */}
                            <gc-panel-header header-title={`Determinate (${Math.round(progress * 100)}%)`} />
                            {/* @ts-ignore */}
                            <gc-loading-screen ref={refTips} title-text="Realm of Ash" eyebrow="Loading" label="Loading shards" progress={progress} tip-title="Wisdom" />
                        {/* @ts-ignore */}
                        </gc-panel>
                        {/* @ts-ignore */}
                        <gc-panel bordered>
                            {/* @ts-ignore */}
                            <gc-panel-header header-title="Indeterminate" />
                            {/* @ts-ignore */}
                            <gc-loading-screen title-text="Connecting" eyebrow="Travelling" label="Resolving sigils" />
                        {/* @ts-ignore */}
                        </gc-panel>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default LoadingScreenDemo
