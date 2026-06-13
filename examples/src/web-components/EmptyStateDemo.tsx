import React from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const EmptyStateDemo: React.FC = () => (
    <div className="py-4">
        <div className="container">
            <div className="row">
                <div className="col-12">
                    <RichPageHeader
                        chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                        title="EmptyState"
                        description="Centered placeholder shown when data is unavailable. Supports an optional lucide icon and arbitrary slotted content including action buttons."
                    />

                    <div className="d-flex flex-column gap-4 mt-4">
                        <SectionCard title="Icon + message">
                            {/* @ts-ignore */}
                            <tc-empty-state icon="Inbox">
                                No messages yet
                            {/* @ts-ignore */}
                            </tc-empty-state>
                        </SectionCard>

                        <SectionCard title="Icon + message + action button">
                            {/* @ts-ignore */}
                            <tc-empty-state icon="FolderOpen">
                                No files found
                                {/* @ts-ignore */}
                                <tc-button variant="secondary">Upload a file</tc-button>
                            {/* @ts-ignore */}
                            </tc-empty-state>
                        </SectionCard>

                        <SectionCard title="Message only (no icon)">
                            {/* @ts-ignore */}
                            <tc-empty-state>
                                Nothing to show here yet.
                            {/* @ts-ignore */}
                            </tc-empty-state>
                        </SectionCard>
                    </div>
                </div>
            </div>
        </div>
    </div>
)

export default EmptyStateDemo
