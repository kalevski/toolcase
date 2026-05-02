import React from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'
import '@toolcase/game-components'

const DividerDemo: React.FC = () => {
    return (
        <div className="container py-4">
            <div className="row">
                <div className="col-12">
                    <RichPageHeader
                        chips={<RichPageHeaderChip>Game Components</RichPageHeaderChip>}
                        title="Divider"
                        description="Gold gradient rule with optional diamond ornament."
                    />
                    <div className="d-flex flex-column gap-4 mt-4">
                        <SectionCard title="Default (with diamond)">
                            {/* @ts-ignore */}
                            <gc-divider />
                        </SectionCard>
                        <SectionCard title="No diamond">
                            {/* @ts-ignore */}
                            <gc-divider no-diamond />
                        </SectionCard>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default DividerDemo
