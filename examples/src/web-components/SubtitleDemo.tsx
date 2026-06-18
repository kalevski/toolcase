import React from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const SubtitleDemo: React.FC = () => {
    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <RichPageHeader
                            chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                            title="Subtitle"
                            description="Secondary heading / subtitle text line with optional speaker label, boxed treatment, and alignment control."
                        />

                        <div className="d-flex flex-column gap-4 mt-4">

                            <SectionCard title="Default (center)">
                                {/* @ts-ignore */}
                                <tc-subtitle text="The journey of a thousand miles begins with a single step." />
                            </SectionCard>

                            <SectionCard title="With speaker label">
                                {/* @ts-ignore */}
                                <tc-subtitle speaker="Narrator" text="The kingdom fell silent as the last light faded." />
                            </SectionCard>

                            <SectionCard title="Left-aligned">
                                {/* @ts-ignore */}
                                <tc-subtitle align="left" text="Left-aligned subtitle for content-heavy layouts." />
                            </SectionCard>

                            <SectionCard title="Right-aligned">
                                {/* @ts-ignore */}
                                <tc-subtitle align="right" text="Right-aligned for trailing captions." />
                            </SectionCard>

                            <SectionCard title="Boxed variant">
                                {/* @ts-ignore */}
                                <tc-subtitle boxed speaker="Aldric of the Vale" text="He had walked three continents before he turned eighteen." />
                            </SectionCard>

                            <SectionCard title="Boxed, left-aligned, max-width">
                                {/* @ts-ignore */}
                                <tc-subtitle boxed align="left" speaker="System" text="Initialising quantum resonance array…" max-width="480" />
                            </SectionCard>

                            <SectionCard title="Custom font size">
                                {/* @ts-ignore */}
                                <tc-subtitle text="Larger subtitle for hero sections." font-size="20" />
                            </SectionCard>

                            <SectionCard title="Custom theme (accent border)">
                                {/* @ts-ignore */}
                                <tc-subtitle
                                    boxed
                                    speaker="Warning"
                                    text="This action cannot be undone."
                                    style={{ '--bs-subtitle-border-color': 'var(--tc-danger)', '--bs-subtitle-speaker-color': 'var(--tc-danger)', '--bs-subtitle-color': 'var(--tc-text)' }}
                                />
                            </SectionCard>

                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default SubtitleDemo
