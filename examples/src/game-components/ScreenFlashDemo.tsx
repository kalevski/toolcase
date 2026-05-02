import React, { useEffect, useRef, useState } from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'
import '@toolcase/game-components'

const ScreenFlashDemo: React.FC = () => {
    const flashRef = useRef<HTMLElement>(null)
    const [doneCount, setDoneCount] = useState(0)
    const [flashColor, setFlashColor] = useState('#ffffff')

    useEffect(() => {
        const el = flashRef.current
        if (!el) return
        const onDone = () => setDoneCount(c => c + 1)
        el.addEventListener('done', onDone)
        return () => el.removeEventListener('done', onDone)
    }, [])

    const fire = (color: string) => {
        const el = flashRef.current
        if (!el) return
        setFlashColor(color)
        el.setAttribute('flash-color', color)
        el.setAttribute('trigger', String(Date.now()))
    }

    return (
        <div className="container py-4">
            <div className="row">
                <div className="col-12">
                    <RichPageHeader
                        chips={<RichPageHeaderChip>Game Components</RichPageHeaderChip>}
                        title="ScreenFlash"
                        description="Full-bleed overlay flash. Fires on `trigger` attribute change, fades over `duration`, emits 'done'."
                    />
                    <div className="d-flex flex-column gap-4 mt-4">
                        <SectionCard title="Trigger">
                            <div className="d-flex align-items-center gap-3 flex-wrap">
                                {/* @ts-ignore */}
                                <gc-metal-button onClick={() => fire('#ffffff')}>White flash</gc-metal-button>
                                {/* @ts-ignore */}
                                <gc-metal-button variant="danger" onClick={() => fire('#d44a3a')}>Damage flash</gc-metal-button>
                                {/* @ts-ignore */}
                                <gc-metal-button variant="primary" onClick={() => fire('#f0d27a')}>Gold flash</gc-metal-button>
                                <span style={{ fontFamily: 'var(--fg-mono)', color: 'var(--fg-gold-bright)' }}>
                                    'done' fired: {doneCount} (last: {flashColor})
                                </span>
                            </div>
                            {/* @ts-ignore */}
                            <gc-screen-flash ref={flashRef} flash-opacity="0.6" duration="220" />
                        </SectionCard>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default ScreenFlashDemo
