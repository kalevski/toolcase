import React from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const TitleDemo: React.FC = () => {
    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <RichPageHeader
                            chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                            title="Title"
                            description="Large display title text for hero sections, screen headings, and prominent labels. Port of gc-title restyled to the web-components design system."
                        />

                        <div className="d-flex flex-column gap-4 mt-4">

                            <SectionCard title="Default">
                                {/* @ts-ignore */}
                                <tc-title>The World Awaits</tc-title>
                            </SectionCard>

                            <SectionCard title="Center-aligned">
                                {/* @ts-ignore */}
                                <tc-title align="center">Forge Your Legend</tc-title>
                            </SectionCard>

                            <SectionCard title="Right-aligned">
                                {/* @ts-ignore */}
                                <tc-title align="right">Season IV</tc-title>
                            </SectionCard>

                            <SectionCard title="Custom size (48 px)">
                                {/* @ts-ignore */}
                                <tc-title size="48">Victory Achieved</tc-title>
                            </SectionCard>

                            <SectionCard title="Large display (72 px, center)">
                                {/* @ts-ignore */}
                                <tc-title size="72" align="center">GAME OVER</tc-title>
                            </SectionCard>

                            <SectionCard title="Custom accent color">
                                {/* @ts-ignore */}
                                <tc-title
                                    align="center"
                                    style={{ '--bs-title-color': 'var(--tc-app-accent)' }}
                                >
                                    Champion
                                </tc-title>
                            </SectionCard>

                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default TitleDemo
