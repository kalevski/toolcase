import React from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'
import '@toolcase/game-components'

const TitleDemo: React.FC = () => (
    <div className="container py-4">
        <div className="row">
            <div className="col-12">
                <RichPageHeader
                    chips={<RichPageHeaderChip>Game Components</RichPageHeaderChip>}
                    title="Title"
                    description="Display caps title in gold-bright. Prop: size (px)."
                />
                <div className="d-flex flex-column gap-4 mt-4">
                    <SectionCard title="Default (18px)">
                        {/* @ts-ignore */}
                        <gc-title>Inventory</gc-title>
                    </SectionCard>

                    <SectionCard title="Size 14">
                        {/* @ts-ignore */}
                        <gc-title size={14}>Stats</gc-title>
                    </SectionCard>

                    <SectionCard title="Size 26">
                        {/* @ts-ignore */}
                        <gc-title size={26}>Realm of Embers</gc-title>
                    </SectionCard>

                    <SectionCard title="Size 36">
                        {/* @ts-ignore */}
                        <gc-title size={36}>Codex Arcana</gc-title>
                    </SectionCard>
                </div>
            </div>
        </div>
    </div>
)

export default TitleDemo
