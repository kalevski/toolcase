import React, { useEffect, useRef, useState } from 'react'
import { RichPageHeader, RichPageHeaderChip } from '@toolcase/react-components'
import '@toolcase/game-components'

const InteractPromptDemo: React.FC = () => {
    const holdRef = useRef<HTMLElement>(null)
    const [progress, setProgress] = useState(0)
    const [holding, setHolding] = useState(false)

    useEffect(() => {
        if (!holding) return
        let raf = 0
        const start = performance.now()
        const loop = (now: number) => {
            const t = Math.min(1, (now - start) / 1500)
            setProgress(t)
            if (t >= 1) {
                setHolding(false)
                window.setTimeout(() => setProgress(0), 400)
                return
            }
            raf = requestAnimationFrame(loop)
        }
        raf = requestAnimationFrame(loop)
        return () => cancelAnimationFrame(raf)
    }, [holding])

    useEffect(() => {
        const el = holdRef.current
        if (!el) return
        el.setAttribute('hold-progress', String(progress))
    }, [progress])

    return (
        <div className="container py-4">
            <div className="row">
                <div className="col-12">
                    <RichPageHeader
                        chips={<RichPageHeaderChip>Game Components</RichPageHeaderChip>}
                        title="InteractPrompt"
                        description="In-world interact prompt — key glyph + uppercase text, optional hold-fill bar."
                    />
                    <div className="d-flex flex-column gap-4 mt-4">
                        {/* @ts-ignore */}
                        <gc-panel bordered>
                            {/* @ts-ignore */}
                            <gc-panel-header header-title="Tap (no hold)" />
                            {/* @ts-ignore */}
                            <gc-interact-prompt show key-label="E" text="Open chest" />
                        {/* @ts-ignore */}
                        </gc-panel>

                        {/* @ts-ignore */}

                        <gc-panel bordered>

                            {/* @ts-ignore */}

                            <gc-panel-header header-title="Hold (interactive)" />
                            <div className="d-flex align-items-center gap-3 flex-wrap">
                                {/* @ts-ignore */}
                                <gc-interact-prompt
                                    ref={holdRef}
                                    show
                                    key-label="F"
                                    text="Hold to revive"
                                />
                                {/* @ts-ignore */}
                                <gc-metal-button
                                    onMouseDown={() => setHolding(true)}
                                    onMouseUp={() => setHolding(false)}
                                    onMouseLeave={() => setHolding(false)}
                                >
                                    Press &amp; hold
                                </gc-metal-button>
                            </div>
                        {/* @ts-ignore */}
                        </gc-panel>

                        {/* @ts-ignore */}

                        <gc-panel bordered>

                            {/* @ts-ignore */}

                            <gc-panel-header header-title="Hidden (show=false)" />
                            {/* @ts-ignore */}
                            <gc-interact-prompt key-label="X" text="Hidden when !show" />
                            <div style={{ fontFamily: 'var(--fg-mono)', color: 'var(--fg-parch-3)', fontSize: 12 }}>
                                (renders nothing without `show` attribute)
                            </div>
                        {/* @ts-ignore */}
                        </gc-panel>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default InteractPromptDemo
