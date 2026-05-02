import React from 'react'
import { RichPageHeader, RichPageHeaderChip } from '@toolcase/react-components'
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
                    {/* @ts-ignore */}
                    <gc-panel bordered>
                        {/* @ts-ignore */}
                        <gc-panel-header header-title="Default" />
                        {/* @ts-ignore */}
                        <gc-title-screen title-text="Realm of Ash" subtitle="Where embers remember the names of the fallen kings." />
                    {/* @ts-ignore */}
                    </gc-panel>
                    {/* @ts-ignore */}
                    <gc-panel bordered>
                        {/* @ts-ignore */}
                        <gc-panel-header header-title="Title only" />
                        {/* @ts-ignore */}
                        <gc-title-screen title-text="Wyrmsong" />
                    {/* @ts-ignore */}
                    </gc-panel>
                </div>
            </div>
        </div>
    </div>
)

export default TitleScreenDemo
