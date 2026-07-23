import React, { useRef } from 'react'
import { useTc } from '@toolcase/web-components/react'

// Icons resolve through lucide-static by name (kebab → PascalCase). Brand
// glyphs (Github/Twitter/…) were dropped from lucide-static, so use generic
// icons that still exist: a code glyph for the repo, a chat bubble for social,
// a globe for the website.
const LINKS_FULL = [
    { key: 'repo', href: '#', label: 'Source code', icon: 'code' },
    { key: 'social', href: '#', label: 'Social', icon: 'message-circle' },
    { key: 'website', href: '#', label: 'Website', icon: 'globe' },
    { key: 'email', href: '#', label: 'Email', icon: 'mail' },
]

const MaintainerCardDemo: React.FC = () => {
    const fullRef = useTc<HTMLElement>({ links: LINKS_FULL })
    const noLinksRef = useRef<any>(null)
    const minimalRef = useRef<any>(null)

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="MaintainerCard"
                            description="Profile card of a maintainer with avatar, social links, and a sponsor button. Set social links via the JS links property."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Web Components
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-4 mt-4">
                            <tc-section-card title="Full card (name, role, bio, location, social links, sponsor)">
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
                            </tc-section-card>

                            <tc-section-card title="No social links, no sponsor button">
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
                            </tc-section-card>

                            <tc-section-card title="Minimal (name and avatar only)">
                                <div style={{ maxWidth: '320px' }}>
                                    {/* @ts-ignore */}
                                    <tc-maintainer-card
                                        ref={minimalRef}
                                        name="Taylor Kim"
                                        avatar-url="https://i.pravatar.cc/160?img=5"
                                    />
                                </div>
                            </tc-section-card>

                            <tc-section-card title="Custom sponsor label">
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
                            </tc-section-card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default MaintainerCardDemo
