import React, { useEffect, useRef, useState } from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'
import '@toolcase/game-components'

const SECTIONS = [
    { role: 'Direction', names: ['Aldric Vane', 'Brina Storm'] },
    { role: 'Engineering', names: ['Caelum Brook', 'Dorin Hale', 'Eira Wynne'] },
    { role: 'Art', names: ['Faelyn Reed', 'Garrick Ash'] },
    { role: 'Sound', names: ['Hesper Lane'] },
    { role: 'Special Thanks', names: ['Ironwood Studio', 'The Cartographers Guild'] }
]

const CreditsScrollDemo: React.FC = () => {
    const ref = useRef<HTMLElement>(null)
    const [last, setLast] = useState('—')

    useEffect(() => {
        const el = ref.current as any
        if (!el) return
        el.sections = SECTIONS
    }, [])

    useEffect(() => {
        const el = ref.current
        if (!el) return
        const handler = () => setLast('complete')
        el.addEventListener('complete', handler)
        return () => el.removeEventListener('complete', handler)
    }, [])

    return (
        <div className="container py-4">
            <div className="row">
                <div className="col-12">
                    <RichPageHeader
                        chips={<RichPageHeaderChip>Game Components</RichPageHeaderChip>}
                        title="CreditsScroll"
                        description="Auto-scrolling end-credits with click-to-pause; emits complete when track passes the viewport."
                    />
                    <div className="d-flex flex-column gap-4 mt-4">
                        <SectionCard title={`Last — ${last}`}>
                            <div style={{ width: 480, height: 320, border: '1px solid var(--fg-gold-deep)' }}>
                                {/* @ts-ignore */}
                                <gc-credits-scroll ref={ref} speed="40" scroll-title="Toolcase Studio" />
                            </div>
                        </SectionCard>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default CreditsScrollDemo
