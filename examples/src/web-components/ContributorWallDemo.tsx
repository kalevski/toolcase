import React, { useEffect, useRef } from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const CONTRIBUTORS_WITH_AVATARS = [
    { name: 'Alice Martin', avatarUrl: 'https://i.pravatar.cc/80?img=1', profileUrl: '#', contributions: 142 },
    { name: 'Bob Chen', avatarUrl: 'https://i.pravatar.cc/80?img=2', profileUrl: '#', contributions: 98 },
    { name: 'Chloe Dupont', avatarUrl: 'https://i.pravatar.cc/80?img=3', profileUrl: '#', contributions: 74 },
    { name: 'David Osei', avatarUrl: 'https://i.pravatar.cc/80?img=4', profileUrl: '#', contributions: 61 },
    { name: 'Eva Rossi', avatarUrl: 'https://i.pravatar.cc/80?img=5', profileUrl: '#', contributions: 43 },
]

const CONTRIBUTORS_MIXED = [
    { name: 'Alice Martin', avatarUrl: 'https://i.pravatar.cc/80?img=1', profileUrl: '#', contributions: 142 },
    { name: 'Bob Chen', profileUrl: '#', contributions: 98 },
    { name: 'Chloe Dupont', avatarUrl: 'https://i.pravatar.cc/80?img=3', profileUrl: '#', contributions: 74 },
    { name: 'David Osei', profileUrl: '#', contributions: 61 },
    { name: 'Eva Rossi', avatarUrl: 'https://i.pravatar.cc/80?img=5', profileUrl: '#', contributions: 43 },
    { name: 'Frank Müller', profileUrl: '#', contributions: 38 },
    { name: 'Grace Kim', avatarUrl: 'https://i.pravatar.cc/80?img=7', profileUrl: '#', contributions: 29 },
    { name: 'Hiro Tanaka', profileUrl: '#', contributions: 17 },
]

const CONTRIBUTORS_OVERFLOW = [
    { name: 'Alice Martin', avatarUrl: 'https://i.pravatar.cc/80?img=1', profileUrl: '#', contributions: 142 },
    { name: 'Bob Chen', profileUrl: '#', contributions: 98 },
    { name: 'Chloe Dupont', avatarUrl: 'https://i.pravatar.cc/80?img=3', profileUrl: '#', contributions: 74 },
    { name: 'David Osei', profileUrl: '#', contributions: 61 },
    { name: 'Eva Rossi', avatarUrl: 'https://i.pravatar.cc/80?img=5', profileUrl: '#', contributions: 43 },
    { name: 'Frank Müller', profileUrl: '#', contributions: 38 },
    { name: 'Grace Kim', avatarUrl: 'https://i.pravatar.cc/80?img=7', profileUrl: '#', contributions: 29 },
    { name: 'Hiro Tanaka', profileUrl: '#', contributions: 17 },
    { name: 'Isla Brown', profileUrl: '#', contributions: 12 },
    { name: 'Jake Wilson', avatarUrl: 'https://i.pravatar.cc/80?img=10', profileUrl: '#', contributions: 8 },
    { name: 'Karen Lee', profileUrl: '#', contributions: 5 },
    { name: 'Leo Santos', profileUrl: '#', contributions: 3 },
]

const CONTRIBUTORS_NO_LINKS = [
    { name: 'Alice Martin', avatarUrl: 'https://i.pravatar.cc/80?img=1', contributions: 142 },
    { name: 'Bob Chen', contributions: 98 },
    { name: 'Chloe Dupont', avatarUrl: 'https://i.pravatar.cc/80?img=3', contributions: 74 },
    { name: 'David Osei', contributions: 61 },
]

const ContributorWallDemo: React.FC = () => {
    const avatarsRef = useRef<any>(null)
    const mixedRef = useRef<any>(null)
    const overflowRef = useRef<any>(null)
    const noLinksRef = useRef<any>(null)
    const slotTitleRef = useRef<any>(null)

    useEffect(() => {
        if (avatarsRef.current) avatarsRef.current.contributors = CONTRIBUTORS_WITH_AVATARS
    }, [])

    useEffect(() => {
        if (mixedRef.current) mixedRef.current.contributors = CONTRIBUTORS_MIXED
    }, [])

    useEffect(() => {
        if (overflowRef.current) overflowRef.current.contributors = CONTRIBUTORS_OVERFLOW
    }, [])

    useEffect(() => {
        if (noLinksRef.current) noLinksRef.current.contributors = CONTRIBUTORS_NO_LINKS
    }, [])

    useEffect(() => {
        if (slotTitleRef.current) slotTitleRef.current.contributors = CONTRIBUTORS_MIXED
    }, [])

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <RichPageHeader
                            chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                            title="ContributorWall"
                            description="Grid of contributor avatar tiles with optional overflow counter and profile links. Avatars are circles; initials shown when no avatarUrl is provided. Set contributors via the JS property."
                        />

                        <div className="d-flex flex-column gap-4 mt-4">
                            <SectionCard title="Avatar images with profile links (title attribute)">
                                {/* @ts-ignore */}
                                <tc-contributor-wall ref={avatarsRef} title="Top Contributors" />
                            </SectionCard>

                            <SectionCard title="Mixed — images and initials tiles">
                                {/* @ts-ignore */}
                                <tc-contributor-wall ref={mixedRef} title="All Contributors" />
                            </SectionCard>

                            <SectionCard title="maxVisible overflow chip (max-visible=5)">
                                {/* @ts-ignore */}
                                <tc-contributor-wall ref={overflowRef} title="Contributors" max-visible="5" />
                            </SectionCard>

                            <SectionCard title="No profile links (presentational only)">
                                {/* @ts-ignore */}
                                <tc-contributor-wall ref={noLinksRef} title="Team" />
                            </SectionCard>

                            <SectionCard title="Title via slot">
                                {/* @ts-ignore */}
                                <tc-contributor-wall ref={slotTitleRef}>
                                    <span slot="title" style={{ fontStyle: 'italic' }}>
                                        Slotted heading
                                    </span>
                                </tc-contributor-wall>
                            </SectionCard>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default ContributorWallDemo
