import React, { useEffect, useRef, useState } from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'
import '@toolcase/game-components'

const PressAnyKeyDemo: React.FC = () => {
    const ref = useRef<HTMLElement>(null)
    const [last, setLast] = useState('—')

    useEffect(() => {
        const el = ref.current
        if (!el) return
        const handler = () => setLast('continue ' + new Date().toLocaleTimeString())
        el.addEventListener('continue', handler)
        return () => el.removeEventListener('continue', handler)
    }, [])

    return (
        <div className="container py-4">
            <div className="row">
                <div className="col-12">
                    <RichPageHeader
                        chips={<RichPageHeaderChip>Game Components</RichPageHeaderChip>}
                        title="PressAnyKey"
                        description="Pulsing prompt that emits continue on any keydown or mousedown. Use on splash/title screens."
                    />
                    <div className="d-flex flex-column gap-4 mt-4">
                        <SectionCard title={`Last — ${last}`}>
                            <div style={{ padding: 60, textAlign: 'center', background: 'radial-gradient(60% 50% at 50% 30%, #4a3a22 0%, #1a1108 60%, #0a0604 100%)', border: '1px solid var(--fg-gold-deep)' }}>
                                {/* @ts-ignore */}
                                <gc-press-any-key ref={ref} text="Press Any Key" />
                            </div>
                        </SectionCard>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default PressAnyKeyDemo
