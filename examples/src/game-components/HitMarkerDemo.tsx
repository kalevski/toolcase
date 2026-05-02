import React, { useEffect, useRef, useState } from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'
import '@toolcase/game-components'

const HitMarkerDemo: React.FC = () => {
    const [doneCount, setDoneCount] = useState(0)
    const interactiveRef = useRef<HTMLElement>(null)

    useEffect(() => {
        const el = interactiveRef.current
        if (!el) return
        const onDone = () => setDoneCount(c => c + 1)
        el.addEventListener('done', onDone)
        return () => el.removeEventListener('done', onDone)
    }, [])

    const trigger = (which: 'normal' | 'crit' | 'kill') => {
        const el = interactiveRef.current
        if (!el) return
        el.removeAttribute('crit')
        el.removeAttribute('kill')
        if (which === 'crit') el.setAttribute('crit', '')
        if (which === 'kill') el.setAttribute('kill', '')
        el.setAttribute('show', '')
    }

    return (
        <div className="container py-4">
            <div className="row">
                <div className="col-12">
                    <RichPageHeader
                        chips={<RichPageHeaderChip>Game Components</RichPageHeaderChip>}
                        title="HitMarker"
                        description="FPS-style crosshair X marker. Variants: normal (parch), crit (blood-bright), kill (blood + skull). Auto-hides after `duration` ms and emits 'done'."
                    />
                    <div className="d-flex flex-column gap-4 mt-4">
                        <SectionCard title="Variants (always-on)">
                            <div className="d-flex align-items-center gap-4" style={{ background: 'var(--fg-ink)', padding: 24 }}>
                                {/* @ts-ignore */}
                                <gc-hit-marker show size="36" duration="999999" />
                                {/* @ts-ignore */}
                                <gc-hit-marker show crit size="36" duration="999999" />
                                {/* @ts-ignore */}
                                <gc-hit-marker show kill size="36" duration="999999" />
                            </div>
                        </SectionCard>

                        <SectionCard title="Sizes">
                            <div className="d-flex align-items-center gap-4" style={{ background: 'var(--fg-ink)', padding: 24 }}>
                                {/* @ts-ignore */}
                                <gc-hit-marker show size="16" duration="999999" />
                                {/* @ts-ignore */}
                                <gc-hit-marker show size="24" duration="999999" />
                                {/* @ts-ignore */}
                                <gc-hit-marker show crit size="48" duration="999999" />
                                {/* @ts-ignore */}
                                <gc-hit-marker show kill size="64" duration="999999" />
                            </div>
                        </SectionCard>

                        <SectionCard title="Interactive (auto-hide + 'done' event)">
                            <div className="d-flex align-items-center gap-3 flex-wrap">
                                {/* @ts-ignore */}
                                <gc-metal-button onClick={() => trigger('normal')}>Hit</gc-metal-button>
                                {/* @ts-ignore */}
                                <gc-metal-button variant="primary" onClick={() => trigger('crit')}>Crit</gc-metal-button>
                                {/* @ts-ignore */}
                                <gc-metal-button variant="danger" onClick={() => trigger('kill')}>Kill</gc-metal-button>
                                <div style={{ background: 'var(--fg-ink)', padding: 24, display: 'inline-flex' }}>
                                    {/* @ts-ignore */}
                                    <gc-hit-marker ref={interactiveRef} size="36" duration="500" />
                                </div>
                                <span style={{ fontFamily: 'var(--fg-mono)', color: 'var(--fg-gold-bright)' }}>
                                    'done' fired: {doneCount}
                                </span>
                            </div>
                        </SectionCard>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default HitMarkerDemo
