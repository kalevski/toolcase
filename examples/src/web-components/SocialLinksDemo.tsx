import React from 'react'
import { useTc } from '@toolcase/web-components/react'

const LINKS_GHOST = [
    { kind: 'github', href: '#', label: 'GitHub' },
    { kind: 'x', href: '#', label: 'X (Twitter)' },
    { kind: 'linkedin', href: '#', label: 'LinkedIn' },
    { kind: 'youtube', href: '#', label: 'YouTube' },
    { kind: 'rss', href: '#', label: 'RSS Feed' },
]

const LINKS_ALL = [
    { kind: 'github', href: '#' },
    { kind: 'x', href: '#' },
    { kind: 'linkedin', href: '#' },
    { kind: 'mastodon', href: '#' },
    { kind: 'youtube', href: '#' },
    { kind: 'rss', href: '#' },
    { kind: 'discord', href: '#' },
    { kind: 'instagram', href: '#' },
    { kind: 'tiktok', href: '#' },
]

const SocialLinksDemo: React.FC = () => {
    const ghostRef = useTc<HTMLElement>({ links: LINKS_GHOST })
    const filledRef = useTc<HTMLElement>({ links: LINKS_GHOST })
    const smRef = useTc<HTMLElement>({ links: LINKS_GHOST })
    const mdRef = useTc<HTMLElement>({ links: LINKS_GHOST })
    const lgRef = useTc<HTMLElement>({ links: LINKS_GHOST })
    const allRef = useTc<HTMLElement>({ links: LINKS_ALL })

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="SocialLinks"
                            description="Horizontal row of social-media icon links. Set links via the JS links property. Two variants (ghost / filled) and three sizes (sm / md / lg)."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Web Components
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-4 mt-4">
                            <tc-section-card title="Ghost variant (default)">
                                {/* @ts-ignore */}
                                <tc-social-links ref={ghostRef} />
                            </tc-section-card>

                            <tc-section-card title="Filled variant">
                                {/* @ts-ignore */}
                                <tc-social-links ref={filledRef} variant="filled" />
                            </tc-section-card>

                            <tc-section-card title="Size sm">
                                {/* @ts-ignore */}
                                <tc-social-links ref={smRef} size="sm" />
                            </tc-section-card>

                            <tc-section-card title="Size md (default)">
                                {/* @ts-ignore */}
                                <tc-social-links ref={mdRef} />
                            </tc-section-card>

                            <tc-section-card title="Size lg">
                                {/* @ts-ignore */}
                                <tc-social-links ref={lgRef} size="lg" variant="filled" />
                            </tc-section-card>

                            <tc-section-card title="All kinds">
                                {/* @ts-ignore */}
                                <tc-social-links ref={allRef} variant="filled" />
                            </tc-section-card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default SocialLinksDemo
