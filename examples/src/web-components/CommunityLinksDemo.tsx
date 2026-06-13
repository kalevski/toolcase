import React, { useEffect, useRef } from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const LINKS_BASIC = [
    { label: 'GitHub', href: '#', icon: 'github', count: '12.4k' },
    { label: 'Discord', href: '#', icon: 'discord', count: '8.2k' },
    { label: 'Twitter / X', href: '#', icon: 'x', count: '5.1k' },
]

const LINKS_FULL = [
    { label: 'GitHub', href: '#', icon: 'github', count: '12.4k', description: 'Source code & issues' },
    { label: 'Discord', href: '#', icon: 'discord', count: '8.2k', description: 'Live chat & support' },
    { label: 'Twitter / X', href: '#', icon: 'x', count: '5.1k', description: 'Announcements' },
    { label: 'YouTube', href: '#', icon: 'youtube', count: '2.3k', description: 'Tutorials & demos' },
    { label: 'Reddit', href: '#', icon: 'reddit', count: '1.8k', description: 'Community discussions' },
    { label: 'npm', href: '#', icon: 'npm', count: '450k', description: 'Package registry' },
]

const LINKS_NO_COUNT = [
    { label: 'GitHub', href: '#', icon: 'github' },
    { label: 'Discord', href: '#', icon: 'discord' },
    { label: 'Twitter / X', href: '#', icon: 'x' },
    { label: 'Forum', href: '#', icon: 'forum' },
]

const CommunityLinksDemo: React.FC = () => {
    const basicRef = useRef<any>(null)
    const fullRef = useRef<any>(null)
    const noCountRef = useRef<any>(null)
    const slotTitleRef = useRef<any>(null)

    useEffect(() => {
        if (basicRef.current) basicRef.current.links = LINKS_BASIC
    }, [])

    useEffect(() => {
        if (fullRef.current) fullRef.current.links = LINKS_FULL
    }, [])

    useEffect(() => {
        if (noCountRef.current) noCountRef.current.links = LINKS_NO_COUNT
    }, [])

    useEffect(() => {
        if (slotTitleRef.current) slotTitleRef.current.links = LINKS_BASIC
    }, [])

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <RichPageHeader
                            chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                            title="CommunityLinks"
                            description="Grid of community platform links (GitHub, Discord, etc.) with icons, labels, optional descriptions, and counts. Set links via the JS links property."
                        />

                        <div className="d-flex flex-column gap-4 mt-4">
                            <SectionCard title="Basic (icons + counts, title attribute)">
                                {/* @ts-ignore */}
                                <tc-community-links ref={basicRef} title="Join our community" />
                            </SectionCard>

                            <SectionCard title="Full (icons + descriptions + counts)">
                                {/* @ts-ignore */}
                                <tc-community-links ref={fullRef} title="Community &amp; resources" />
                            </SectionCard>

                            <SectionCard title="Without counts or title">
                                {/* @ts-ignore */}
                                <tc-community-links ref={noCountRef} />
                            </SectionCard>

                            <SectionCard title="Title via slot">
                                {/* @ts-ignore */}
                                <tc-community-links ref={slotTitleRef}>
                                    <span slot="title" style={{ fontStyle: 'italic' }}>
                                        Slotted heading
                                    </span>
                                </tc-community-links>
                            </SectionCard>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default CommunityLinksDemo
