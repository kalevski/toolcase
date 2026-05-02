import React from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'
import '@toolcase/game-components'

const EyebrowDemo: React.FC = () => (
    <div className="container py-4">
        <div className="row">
            <div className="col-12">
                <RichPageHeader
                    chips={<RichPageHeaderChip>Game Components</RichPageHeaderChip>}
                    title="Eyebrow"
                    description="Tiny display caps label above a title. Slot-based."
                />
                <div className="d-flex flex-column gap-4 mt-4">
                    <SectionCard title="Default">
                        {/* @ts-ignore */}
                        <gc-eyebrow>Chapter I</gc-eyebrow>
                    </SectionCard>

                    <SectionCard title="Above a title">
                        {/* @ts-ignore */}
                        <gc-eyebrow>The Long Watch</gc-eyebrow>
                        <div style={{ height: 4 }} />
                        {/* @ts-ignore */}
                        <gc-title size={22}>Embergate Keep</gc-title>
                    </SectionCard>
                </div>
            </div>
        </div>
    </div>
)

export default EyebrowDemo
