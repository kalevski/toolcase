import React from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const CloseButtonDemo: React.FC = () => (
    <div className="py-4">
        <div className="container">
            <div className="row">
                <div className="col-12">
                    <RichPageHeader
                        chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                        title="Close Button"
                        description="Bootstrap standalone close button (×) with disabled and aria-label support."
                    />

                    <div className="d-flex flex-column gap-4 mt-4">
                        <SectionCard title="Default">
                            <div className="d-flex flex-wrap gap-2">
                                {/* @ts-ignore */}
                                <tc-close-button></tc-close-button>
                            </div>
                        </SectionCard>

                        <SectionCard title="Custom aria-label">
                            <div className="d-flex flex-wrap gap-2">
                                {/* @ts-ignore */}
                                <tc-close-button aria-label="Dismiss"></tc-close-button>
                            </div>
                        </SectionCard>

                        <SectionCard title="Disabled">
                            <div className="d-flex flex-wrap gap-2">
                                {/* @ts-ignore */}
                                <tc-close-button disabled></tc-close-button>
                            </div>
                        </SectionCard>
                    </div>
                </div>
            </div>
        </div>
    </div>
)

export default CloseButtonDemo
