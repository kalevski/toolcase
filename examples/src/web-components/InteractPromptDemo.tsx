import React, { useEffect, useRef } from 'react'

const InteractPromptDemo: React.FC = () => {
    const holdRef = useRef<any>(null)

    // Animate the hold-to-interact progress bar in a loop so the fill is visible.
    useEffect(() => {
        const el = holdRef.current
        if (!el) return
        let raf = 0
        let start: number | null = null
        const DURATION = 1600
        const tick = (now: number) => {
            if (start == null) start = now
            const t = ((now - start) % DURATION) / DURATION
            el.holdProgress = t
            raf = requestAnimationFrame(tick)
        }
        raf = requestAnimationFrame(tick)
        return () => cancelAnimationFrame(raf)
    }, [])

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="InteractPrompt"
                            description="Contextual “press X to interact” prompt. A keycap plus a mono uppercase label, with an optional hold-to-interact progress bar. Visibility is driven by the show attribute."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Web Components
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-4 mt-4">
                            <tc-section-card title="Basic prompt">
                                <div className="d-flex flex-wrap gap-4 align-items-start">
                                    {/* @ts-ignore */}
                                    <tc-interact-prompt
                                        show
                                        key-label="E"
                                        text="Interact"
                                    ></tc-interact-prompt>
                                    {/* @ts-ignore */}
                                    <tc-interact-prompt
                                        show
                                        key-label="F"
                                        text="Open chest"
                                    ></tc-interact-prompt>
                                    {/* @ts-ignore */}
                                    <tc-interact-prompt
                                        show
                                        key-label="Space"
                                        text="Jump"
                                    ></tc-interact-prompt>
                                </div>
                            </tc-section-card>

                            <tc-section-card title="Without a keycap">
                                <div className="d-flex flex-wrap gap-4 align-items-start">
                                    {/* @ts-ignore */}
                                    <tc-interact-prompt
                                        show
                                        text="Talk to merchant"
                                    ></tc-interact-prompt>
                                </div>
                            </tc-section-card>

                            <tc-section-card title="Hold to interact (animated)">
                                <div className="d-flex flex-wrap gap-4 align-items-start">
                                    {/* @ts-ignore */}
                                    <tc-interact-prompt
                                        ref={holdRef}
                                        show
                                        key-label="E"
                                        text="Hold to revive"
                                    ></tc-interact-prompt>
                                    {/* @ts-ignore */}
                                    <tc-interact-prompt
                                        show
                                        key-label="R"
                                        text="Hold to revive"
                                        hold-progress="0.65"
                                    ></tc-interact-prompt>
                                </div>
                            </tc-section-card>

                            <tc-section-card title="Hidden (show absent)">
                                <p className="text-muted mb-2" style={{ fontSize: '0.85rem' }}>
                                    Without the <code>show</code> attribute the prompt renders
                                    nothing — there is an element below this line, but it is hidden.
                                </p>
                                {/* @ts-ignore */}
                                <tc-interact-prompt
                                    key-label="E"
                                    text="You should not see this"
                                ></tc-interact-prompt>
                            </tc-section-card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default InteractPromptDemo
