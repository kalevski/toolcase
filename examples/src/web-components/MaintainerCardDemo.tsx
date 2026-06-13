import React, { useEffect, useRef } from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const LINKS_FULL = [
    { key: 'github', href: '#', label: 'GitHub', icon: 'github' },
    { key: 'twitter', href: '#', label: 'X (Twitter)', icon: 'twitter' },
    { key: 'globe', href: '#', label: 'Website', icon: 'globe' },
]

const MaintainerCardDemo: React.FC = () => {
    const fullRef = useRef<any>(null)
    const noLinksRef = useRef<any>(null)
    const minimalRef = useRef<any>(null)

    useEffect(() => {
        if (fullRef.current) fullRef.current.links = LINKS_FULL
    }, [])

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <RichPageHeader
                            chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                            title="MaintainerCard"
                            description="Profile card of a maintainer with avatar, social links, and a sponsor button. Set social links via the JS links property."
                        />

                        <div className="d-flex flex-column gap-4 mt-4">
                            <SectionCard title="Full card (name, role, bio, location, social links, sponsor)">
                                <div style={{ maxWidth: '320px' }}>
                                    {/* @ts-ignore */}
                                    <tc-maintainer-card
                                        ref={fullRef}
                                        name="Alex Chen"
                                        avatar-url="https://i.pravatar.cc/160?img=33"
                                        role="Core Maintainer"
                                        bio="Building open-source tools that developers love. TypeScript and coffee enthusiast."
                                        location="San Francisco, CA"
                                        sponsor-href="#"
                                        sponsor-label="Sponsor"
                                    />
                                </div>
                            </SectionCard>

                            <SectionCard title="No social links, no sponsor button">
                                <div style={{ maxWidth: '320px' }}>
                                    {/* @ts-ignore */}
                                    <tc-maintainer-card
                                        ref={noLinksRef}
                                        name="Morgan Lee"
                                        avatar-url="https://i.pravatar.cc/160?img=47"
                                        role="Technical Writer"
                                        bio="Documentation enthusiast. Making complexity accessible."
                                    />
                                </div>
                            </SectionCard>

                            <SectionCard title="Minimal (name and avatar only)">
                                <div style={{ maxWidth: '320px' }}>
                                    {/* @ts-ignore */}
                                    <tc-maintainer-card
                                        ref={minimalRef}
                                        name="Taylor Kim"
                                        avatar-url="https://i.pravatar.cc/160?img=5"
                                    />
                                </div>
                            </SectionCard>

                            <SectionCard title="Custom sponsor label">
                                <div style={{ maxWidth: '320px' }}>
                                    {/* @ts-ignore */}
                                    <tc-maintainer-card
                                        name="Jamie Rivera"
                                        avatar-url="https://i.pravatar.cc/160?img=12"
                                        role="Security Researcher"
                                        location="Berlin, Germany"
                                        sponsor-href="#"
                                        sponsor-label="Buy me a coffee"
                                    />
                                </div>
                            </SectionCard>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default MaintainerCardDemo
