import React from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'
import '@toolcase/game-components'

const ControllerLayoutPreviewDemo: React.FC = () => (
    <div className="container py-4">
        <div className="row">
            <div className="col-12">
                <RichPageHeader
                    chips={<RichPageHeaderChip>Game Components</RichPageHeaderChip>}
                    title="ControllerLayoutPreview"
                    description="Stylised controller silhouette with layout-specific face button glyphs and colors."
                />
                <div className="d-flex flex-column gap-4 mt-4">
                    <SectionCard title="All layouts">
                        <div className="d-flex flex-wrap gap-3">
                            {/* @ts-ignore */}
                            <gc-controller-layout-preview layout="xbox" />
                            {/* @ts-ignore */}
                            <gc-controller-layout-preview layout="playstation" />
                            {/* @ts-ignore */}
                            <gc-controller-layout-preview layout="nintendo" />
                            {/* @ts-ignore */}
                            <gc-controller-layout-preview layout="generic" />
                        </div>
                    </SectionCard>
                </div>
            </div>
        </div>
    </div>
)

export default ControllerLayoutPreviewDemo
