import React from 'react'
import { RichPageHeader, RichPageHeaderChip } from '@toolcase/react-components'
import '@toolcase/game-components'

const PanelHeaderDemo: React.FC = () => (
    <div className="container py-4">
        <div className="row">
            <div className="col-12">
                <RichPageHeader
                    chips={<RichPageHeaderChip>Game Components</RichPageHeaderChip>}
                    title="PanelHeader"
                    description="Canonical eyebrow + title + diamond divider header for any framed panel or screen."
                />
                <div className="d-flex flex-column gap-4 mt-4">
                    {/* @ts-ignore */}
                    <gc-panel bordered>
                        {/* @ts-ignore */}
                        <gc-panel-header header-title="Sizes" />
                        <div className="d-flex flex-column gap-3" style={{ maxWidth: 480 }}>
                            {/* @ts-ignore */}
                            <gc-panel-header eyebrow="Chapter I" header-title="The Long Road" title-size="sm" />
                            {/* @ts-ignore */}
                            <gc-panel-header eyebrow="Chapter II" header-title="The Long Road" title-size="md" />
                            {/* @ts-ignore */}
                            <gc-panel-header eyebrow="Chapter III" header-title="The Long Road" title-size="lg" />
                            {/* @ts-ignore */}
                            <gc-panel-header eyebrow="Chapter IV" header-title="The Long Road" title-size="xl" />
                        </div>
                    {/* @ts-ignore */}
                    </gc-panel>
                </div>
            </div>
        </div>
    </div>
)

export default PanelHeaderDemo
