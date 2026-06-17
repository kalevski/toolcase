import React, { useEffect, useRef, useState } from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const SECTIONS = [
    {
        id: 'eula',
        title: 'End User License Agreement',
        body: 'This software is provided "as-is" without warranty of any kind, express or implied. You may use this software for personal or commercial projects subject to the conditions below. Redistribution of this software, in whole or in part, requires prior written permission.',
    },
    {
        id: 'privacy',
        title: 'Privacy Policy',
        body: 'We collect anonymous usage telemetry to improve the product experience. No personally identifying information is sold to or shared with third parties. You may opt out of telemetry at any time in the application settings.',
    },
    {
        id: 'cookies',
        title: 'Cookie Policy',
        body: 'Session tokens are stored in localStorage to keep you signed in between visits. No third-party advertising or analytics cookies are set. Clearing your browser storage will sign you out.',
    },
    {
        id: 'credits',
        title: 'Open Source Credits',
        body: 'This product is built on open source software including: JetBrains Mono (OFL), Lucide Icons (ISC), and Bootstrap (MIT). Full credit information is available in the NOTICE file distributed with each release.',
    },
]

const LegalScreenDemo: React.FC = () => {
    const refReadOnly = useRef<HTMLElement>(null)
    const refWithAccept = useRef<HTMLElement>(null)
    const [lastEvent, setLastEvent] = useState<string>('—')

    useEffect(() => {
        const a: any = refReadOnly.current
        const b: any = refWithAccept.current
        if (a) a.sections = SECTIONS
        if (b) b.sections = SECTIONS
    }, [])

    useEffect(() => {
        const el = refWithAccept.current
        if (!el) return
        const onAccept = () => setLastEvent('tc-accept')
        const onClose = () => setLastEvent('tc-close')
        el.addEventListener('tc-accept', onAccept)
        el.addEventListener('tc-close', onClose)
        return () => {
            el.removeEventListener('tc-accept', onAccept)
            el.removeEventListener('tc-close', onClose)
        }
    }, [])

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <RichPageHeader
                            chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                            title="Legal Screen"
                            description="Multi-section legal / EULA screen with a sidebar nav, scrollable body, optional accept footer, and a close button. Sections are supplied via the sections JS property."
                        />

                        <div className="d-flex flex-column gap-4 mt-4">

                            <SectionCard title="Read-only — sections nav + close button">
                                <div style={{ height: '400px' }}>
                                    {/* @ts-ignore */}
                                    <tc-legal-screen
                                        ref={refReadOnly}
                                        screen-title="Legal Notices"
                                        initial-section="eula"
                                    />
                                    {/* @ts-ignore */}
                                </div>
                            </SectionCard>

                            <SectionCard title={`With Accept footer — last event: ${lastEvent}`}>
                                <div style={{ height: '400px' }}>
                                    {/* @ts-ignore */}
                                    <tc-legal-screen
                                        ref={refWithAccept}
                                        screen-title="Terms of Service"
                                        initial-section="privacy"
                                        show-accept
                                    />
                                    {/* @ts-ignore */}
                                </div>
                            </SectionCard>

                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default LegalScreenDemo
