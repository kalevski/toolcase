import React from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'
import '@toolcase/game-components'

const TitleScreenDemo: React.FC = () => (
    <div className="container py-4">
        <div className="row">
            <div className="col-12">
                <RichPageHeader
                    chips={<RichPageHeaderChip>Game Components</RichPageHeaderChip>}
                    title="Title Screen"
                    description="Top-level title card with display title and italic subtitle."
                />
                <div className="d-flex flex-column gap-4 mt-4">
                    <SectionCard title="Default">
                        {/* @ts-ignore */}
                        <gc-title-screen title-text="Realm of Ash" subtitle="Where embers remember the names of the fallen kings." />
                    </SectionCard>
                    <SectionCard title="Title only">
                        {/* @ts-ignore */}
                        <gc-title-screen title-text="Wyrmsong" />
                    </SectionCard>
                </div>
            </div>
        </div>
    </div>
)

export default TitleScreenDemo
