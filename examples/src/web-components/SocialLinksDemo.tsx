import React, { useEffect, useRef } from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

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
    const ghostRef = useRef<any>(null)
    const filledRef = useRef<any>(null)
    const smRef = useRef<any>(null)
    const mdRef = useRef<any>(null)
    const lgRef = useRef<any>(null)
    const allRef = useRef<any>(null)

    useEffect(() => {
        if (ghostRef.current) ghostRef.current.links = LINKS_GHOST
    }, [])

    useEffect(() => {
        if (filledRef.current) filledRef.current.links = LINKS_GHOST
    }, [])

    useEffect(() => {
        if (smRef.current) smRef.current.links = LINKS_GHOST
    }, [])

    useEffect(() => {
        if (mdRef.current) mdRef.current.links = LINKS_GHOST
    }, [])

    useEffect(() => {
        if (lgRef.current) lgRef.current.links = LINKS_GHOST
    }, [])

    useEffect(() => {
        if (allRef.current) allRef.current.links = LINKS_ALL
    }, [])

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <RichPageHeader
                            chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                            title="SocialLinks"
                            description="Horizontal row of social-media icon links. Set links via the JS links property. Two variants (ghost / filled) and three sizes (sm / md / lg)."
                        />

                        <div className="d-flex flex-column gap-4 mt-4">
                            <SectionCard title="Ghost variant (default)">
                                {/* @ts-ignore */}
                                <tc-social-links ref={ghostRef} />
                            </SectionCard>

                            <SectionCard title="Filled variant">
                                {/* @ts-ignore */}
                                <tc-social-links ref={filledRef} variant="filled" />
                            </SectionCard>

                            <SectionCard title="Size sm">
                                {/* @ts-ignore */}
                                <tc-social-links ref={smRef} size="sm" />
                            </SectionCard>

                            <SectionCard title="Size md (default)">
                                {/* @ts-ignore */}
                                <tc-social-links ref={mdRef} />
                            </SectionCard>

                            <SectionCard title="Size lg">
                                {/* @ts-ignore */}
                                <tc-social-links ref={lgRef} size="lg" variant="filled" />
                            </SectionCard>

                            <SectionCard title="All kinds">
                                {/* @ts-ignore */}
                                <tc-social-links ref={allRef} variant="filled" />
                            </SectionCard>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default SocialLinksDemo
