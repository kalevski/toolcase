import React, { useEffect, useRef } from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const gameCredits = [
    { role: 'Game Director', names: ['Mira Calloway'] },
    { role: 'Lead Engineering', names: ['Tomas Reyes', 'Aiko Nakamura'] },
    { role: 'Art & Animation', names: ['Priya Anand', 'Lukas Berg', 'Sofia Marek'] },
    { role: 'Sound Design', names: ['Daniel Cho'] },
]

const teamCredits = [
    { role: 'Maintainers', names: ['Dafo Kalevski', 'Jordan Wells'] },
    { role: 'Core Contributors', names: ['Elena Ruiz', 'Marco Tan', 'Nadia Osei', 'Kenji Watanabe'] },
    { role: 'Documentation', names: ['Hannah Lindqvist'] },
    { role: 'Special Thanks', names: ['The entire community'] },
]

const CreditsListDemo: React.FC = () => {
    const gameRef = useRef<any>(null)
    const teamRef = useRef<any>(null)

    useEffect(() => {
        if (gameRef.current) gameRef.current.sections = gameCredits
        if (teamRef.current) teamRef.current.sections = teamCredits
    }, [])

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <RichPageHeader
                            chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                            title="CreditsList"
                            description="Static grouped credits roll — each section pairs a role heading (JetBrains Mono micro-label) with one or more names (Inter). Set sections via the sections JS property."
                        />

                        <div className="d-flex flex-column gap-4 mt-4">
                            <SectionCard title="Game credits">
                                <div style={{ maxWidth: 480, margin: '0 auto' }}>
                                    {/* @ts-ignore */}
                                    <tc-credits-list ref={gameRef} />
                                </div>
                            </SectionCard>

                            <SectionCard title="Project credits">
                                <div style={{ maxWidth: 480, margin: '0 auto' }}>
                                    {/* @ts-ignore */}
                                    <tc-credits-list ref={teamRef} />
                                </div>
                            </SectionCard>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default CreditsListDemo
