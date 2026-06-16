import React, { useEffect, useRef, useState } from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const SECTIONS = [
    { role: 'Direction', names: ['Aldric Vane', 'Brina Storm'] },
    { role: 'Engineering', names: ['Caelum Brook', 'Dorin Hale', 'Eira Wynne'] },
    { role: 'Art', names: ['Faelyn Reed', 'Garrick Ash'] },
    { role: 'Sound', names: ['Hesper Lane'] },
    { role: 'Special Thanks', names: ['Ironwood Studio', 'The Cartographers Guild'] },
]

const CreditsScrollDemo: React.FC = () => {
    const ref = useRef<any>(null)
    const fastRef = useRef<any>(null)
    const [status, setStatus] = useState('scrolling…')

    useEffect(() => {
        const el = ref.current
        if (!el) return
        el.sections = SECTIONS
        const onComplete = () => setStatus('complete')
        el.addEventListener('tc-complete', onComplete)
        return () => el.removeEventListener('tc-complete', onComplete)
    }, [])

    useEffect(() => {
        const el = fastRef.current
        if (!el) return
        el.sections = SECTIONS
    }, [])

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <RichPageHeader
                            chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                            title="CreditsScroll"
                            description="Auto-scrolling end-credits sequence. Click or press Space/Enter to pause and play; fires tc-complete when the track passes the viewport."
                        />

                        <div className="d-flex flex-column gap-4 mt-4">

                            <SectionCard title={`Default — sections via JS property (status: ${status})`}>
                                <div style={{ height: 320, maxWidth: 480 }}>
                                    {/* @ts-ignore */}
                                    <tc-credits-scroll
                                        ref={ref}
                                        speed="40"
                                        scroll-title="Toolcase Studio"
                                    />
                                </div>
                            </SectionCard>

                            <SectionCard title="Faster scroll, no title">
                                <div style={{ height: 280, maxWidth: 480 }}>
                                    {/* @ts-ignore */}
                                    <tc-credits-scroll ref={fastRef} speed="90" />
                                </div>
                            </SectionCard>

                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default CreditsScrollDemo
