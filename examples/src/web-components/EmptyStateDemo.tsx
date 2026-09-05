import React from 'react'

const EmptyStateDemo: React.FC = () => (
    <div className="py-4">
        <div className="container">
            <div className="row">
                <div className="col-12">
                    <tc-rich-page-header
                        title-text="EmptyState"
                        description="Centered placeholder shown when data is unavailable. Supports an optional lucide icon and arbitrary slotted content including action buttons."
                    >
                        <tc-badge slot="chips" variant="secondary">
                            Web Components
                        </tc-badge>
                    </tc-rich-page-header>

                    <div className="d-flex flex-column gap-4 mt-4">
                        <tc-section-card title="Icon + message">
                            {/* @ts-ignore */}
                            <tc-empty-state icon="Inbox">
                                No messages yet
                                {/* @ts-ignore */}
                            </tc-empty-state>
                        </tc-section-card>

                        <tc-section-card title="Icon + message + action button">
                            {/* @ts-ignore */}
                            <tc-empty-state icon="FolderOpen">
                                No files found
                                {/* @ts-ignore */}
                                <tc-button slot="action" variant="secondary">
                                    Upload a file
                                </tc-button>
                                {/* @ts-ignore */}
                            </tc-empty-state>
                        </tc-section-card>

                        <tc-section-card title="Message only (no icon)">
                            {/* @ts-ignore */}
                            <tc-empty-state>
                                Nothing to show here yet.
                                {/* @ts-ignore */}
                            </tc-empty-state>
                        </tc-section-card>
                    </div>
                </div>
            </div>
        </div>
    </div>
)

export default EmptyStateDemo
