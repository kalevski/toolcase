import React from 'react'
import { RichPageHeader, RichPageHeaderChip } from '@toolcase/react-components'
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
                    {/* @ts-ignore */}
                    <gc-panel bordered>
                        {/* @ts-ignore */}
                        <gc-panel-header header-title="Default" />
                        {/* @ts-ignore */}
                        <gc-eyebrow>Chapter I</gc-eyebrow>
                    {/* @ts-ignore */}
                    </gc-panel>

                    {/* @ts-ignore */}

                    <gc-panel bordered>

                        {/* @ts-ignore */}

                        <gc-panel-header header-title="Above a title" />
                        {/* @ts-ignore */}
                        <gc-eyebrow>The Long Watch</gc-eyebrow>
                        <div style={{ height: 4 }} />
                        {/* @ts-ignore */}
                        <gc-title size={22}>Embergate Keep</gc-title>
                    {/* @ts-ignore */}
                    </gc-panel>
                </div>
            </div>
        </div>
    </div>
)

export default EyebrowDemo
