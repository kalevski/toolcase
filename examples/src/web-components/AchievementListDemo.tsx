import React, { useEffect, useRef } from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const achievements = [
    {
        id: 'first-blood',
        name: 'First Blood',
        description: 'Defeat your first enemy.',
        icon: 'swords',
        unlocked: true,
        points: 10,
    },
    {
        id: 'explorer',
        name: 'Explorer',
        description: 'Discover 25 hidden locations across the world.',
        icon: 'map',
        progress: 18,
        target: 25,
        points: 50,
    },
    {
        id: 'collector',
        name: 'Collector',
        description: 'Gather every rare artifact in the realm.',
        icon: 'gem',
        progress: 7,
        target: 40,
        points: 100,
    },
    {
        id: 'untouchable',
        name: 'Untouchable',
        description: 'Finish a boss fight without taking damage.',
        icon: 'shield',
        unlocked: false,
        points: 75,
    },
    {
        id: 'secret-ending',
        name: 'The True Ending',
        description: 'You should not be able to read this.',
        secret: true,
        points: 250,
    },
]

const mixed = [
    {
        id: 'speedrun',
        name: 'Speedrunner',
        description: 'Complete the campaign in under two hours.',
        icon: 'timer',
        unlocked: true,
        points: 200,
    },
    {
        id: 'pacifist',
        name: 'Pacifist',
        description: 'Reach the final act without defeating any enemy.',
        icon: 'feather',
        progress: 3,
        target: 5,
        points: 150,
    },
    {
        id: 'maxed',
        name: 'Maxed Out',
        description: 'Reach the maximum character level.',
        icon: 'trending-up',
        progress: 42,
        target: 99,
    },
    {
        id: 'completionist',
        name: 'Completionist',
        description: 'Unlock every other achievement.',
        icon: 'trophy',
        unlocked: false,
    },
]

const AchievementListDemo: React.FC = () => {
    const mainRef = useRef<any>(null)
    const mixedRef = useRef<any>(null)

    useEffect(() => {
        if (mainRef.current) mainRef.current.achievements = achievements
        if (mixedRef.current) mixedRef.current.achievements = mixed
    }, [])

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <RichPageHeader
                            chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                            title="AchievementList"
                            description="Scrollable list of achievements with locked, in-progress, and unlocked states plus an optional progress bar. Set achievements via the achievements JS property. Secret achievements stay hidden until unlocked."
                        />

                        <div className="d-flex flex-column gap-4 mt-4">
                            <SectionCard title="Mixed states (with a secret)">
                                <div style={{ maxWidth: 560 }}>
                                    {/* @ts-ignore */}
                                    <tc-achievement-list ref={mainRef} />
                                </div>
                            </SectionCard>

                            <SectionCard title="Unlocked and in-progress">
                                <div style={{ maxWidth: 560 }}>
                                    {/* @ts-ignore */}
                                    <tc-achievement-list ref={mixedRef} />
                                </div>
                            </SectionCard>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default AchievementListDemo
