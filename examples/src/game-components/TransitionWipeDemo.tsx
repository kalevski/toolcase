import React, { useEffect, useRef, useState } from 'react'
import { RichPageHeader, RichPageHeaderChip } from '@toolcase/react-components'
import '@toolcase/game-components'
import type { TransitionWipeDirection } from '@toolcase/game-components'

const directions: TransitionWipeDirection[] = ['fade', 'left', 'right', 'up', 'down', 'iris']

const TransitionWipeDemo: React.FC = () => {
    const wipeRef = useRef<HTMLElement>(null)
    const [completeCount, setCompleteCount] = useState(0)
    const [direction, setDirection] = useState<TransitionWipeDirection>('fade')

    useEffect(() => {
        const el = wipeRef.current
        if (!el) return
        const onComplete = () => {
            setCompleteCount(c => c + 1)
            window.setTimeout(() => el.removeAttribute('show'), 250)
        }
        el.addEventListener('complete', onComplete)
        return () => el.removeEventListener('complete', onComplete)
    }, [])

    const fire = (d: TransitionWipeDirection) => {
        const el = wipeRef.current
        if (!el) return
        setDirection(d)
        el.setAttribute('direction', d)
        el.setAttribute('show', '')
    }

    return (
        <div className="container py-4">
            <div className="row">
                <div className="col-12">
                    <RichPageHeader
                        chips={<RichPageHeaderChip>Game Components</RichPageHeaderChip>}
                        title="TransitionWipe"
                        description="Full-screen scene transition. Wipes in by direction, emits 'complete' after duration."
                    />
                    <div className="d-flex flex-column gap-4 mt-4">
                        {/* @ts-ignore */}
                        <gc-panel bordered>
                            {/* @ts-ignore */}
                            <gc-panel-header header-title="Direction variants" />
                            <div className="d-flex flex-wrap gap-2 align-items-center">
                                {directions.map(d => (
                                    /* @ts-ignore */
                                    <gc-metal-button key={d} onClick={() => fire(d)}>{d}</gc-metal-button>
                                ))}
                                <span style={{ fontFamily: 'var(--fg-mono)', color: 'var(--fg-gold-bright)', marginLeft: 12 }}>
                                    'complete' fired: {completeCount} (last: {direction})
                                </span>
                            </div>
                            {/* @ts-ignore */}
                            <gc-transition-wipe ref={wipeRef} duration="500" />
                        {/* @ts-ignore */}
                        </gc-panel>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default TransitionWipeDemo
