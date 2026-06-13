import React from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const SimpleFileDemo: React.FC = () => (
    <div className="py-4">
        <div className="container">
            <div className="row">
                <div className="col-12">
                    <RichPageHeader
                        chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                        title="SimpleFile"
                        description="A file icon tile showing a format-specific glyph alongside the file name and extension. Purely presentational — no interaction, no events."
                    />

                    <div className="d-flex flex-column gap-4 mt-4">
                        <SectionCard title="All formats">
                            <div className="d-flex flex-wrap gap-4">
                                {/* @ts-ignore */}
                                <tc-simple-file name="document" extension=".txt" format="unknown" />
                                {/* @ts-ignore */}
                                <tc-simple-file name="photo" extension=".png" format="image" />
                                {/* @ts-ignore */}
                                <tc-simple-file name="track" extension=".mp3" format="audio" />
                                {/* @ts-ignore */}
                                <tc-simple-file name="archive" extension=".bin" format="binary" />
                            </div>
                        </SectionCard>

                        <SectionCard title="Unknown (default)">
                            <div className="d-flex flex-wrap gap-4">
                                {/* @ts-ignore */}
                                <tc-simple-file name="readme" extension=".md" />
                                {/* @ts-ignore */}
                                <tc-simple-file name="config" extension=".json" format="unknown" />
                            </div>
                        </SectionCard>

                        <SectionCard title="Image">
                            <div className="d-flex flex-wrap gap-4">
                                {/* @ts-ignore */}
                                <tc-simple-file name="hero" extension=".jpg" format="image" />
                                {/* @ts-ignore */}
                                <tc-simple-file name="avatar" extension=".png" format="image" />
                            </div>
                        </SectionCard>

                        <SectionCard title="Audio">
                            <div className="d-flex flex-wrap gap-4">
                                {/* @ts-ignore */}
                                <tc-simple-file name="intro" extension=".mp3" format="audio" />
                                {/* @ts-ignore */}
                                <tc-simple-file name="soundscape" extension=".wav" format="audio" />
                            </div>
                        </SectionCard>

                        <SectionCard title="Binary">
                            <div className="d-flex flex-wrap gap-4">
                                {/* @ts-ignore */}
                                <tc-simple-file name="firmware" extension=".bin" format="binary" />
                                {/* @ts-ignore */}
                                <tc-simple-file name="package" extension=".tar.gz" format="binary" />
                            </div>
                        </SectionCard>
                    </div>
                </div>
            </div>
        </div>
    </div>
)

export default SimpleFileDemo
