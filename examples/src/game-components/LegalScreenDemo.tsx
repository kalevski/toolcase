import React, { useEffect, useRef, useState } from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'
import '@toolcase/game-components'

const SECTIONS = [
    { id: 'eula', title: 'End User License', body: 'You agree to the terms of this license. The Realm of Ash is provided as-is, without warranty of any kind. Lorem ipsum dolor sit amet, consectetur adipiscing elit.' },
    { id: 'privacy', title: 'Privacy Policy', body: 'We collect anonymous gameplay telemetry to improve the experience. No personally identifying data is sold to third parties.' },
    { id: 'cookies', title: 'Cookie Policy', body: 'Web sessions store a session token in local storage to keep you signed in. No third-party analytics cookies are set.' },
    { id: 'credits', title: 'Open Source Credits', body: 'This title uses the following open source projects: Cinzel font (OFL), JetBrains Mono (OFL), Bootstrap Icons (MIT), and others.' },
]

const LegalScreenDemo: React.FC = () => {
    const refDefault = useRef<HTMLElement>(null)
    const refAccept = useRef<HTMLElement>(null)
    const [last, setLast] = useState('')

    useEffect(() => {
        const a: any = refDefault.current
        const b: any = refAccept.current
        if (a) a.sections = SECTIONS
        if (b) b.sections = SECTIONS
    }, [])

    useEffect(() => {
        const el = refAccept.current
        if (!el) return
        const accept = () => setLast('accepted')
        const close = () => setLast('closed')
        el.addEventListener('accept', accept)
        el.addEventListener('close', close)
        return () => {
            el.removeEventListener('accept', accept)
            el.removeEventListener('close', close)
        }
    }, [])

    return (
        <div className="container py-4">
            <div className="row">
                <div className="col-12">
                    <RichPageHeader
                        chips={<RichPageHeaderChip>Game Components</RichPageHeaderChip>}
                        title="Legal Screen"
                        description="Multi-section legal viewer with sidebar nav and optional accept action."
                    />
                    <div className="d-flex flex-column gap-4 mt-4">
                        <SectionCard title="Read-only">
                            {/* @ts-ignore */}
                            <gc-legal-screen ref={refDefault} screen-title="Legal Notices" initial-section="eula" />
                        </SectionCard>

                        <SectionCard title={`With Accept — last: ${last || '—'}`}>
                            {/* @ts-ignore */}
                            <gc-legal-screen ref={refAccept} screen-title="Terms of Service" initial-section="privacy" show-accept />
                        </SectionCard>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default LegalScreenDemo
