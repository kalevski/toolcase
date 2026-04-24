import React from 'react'
import {
    ConfigPreview,
    RichPageHeader,
    RichPageHeaderChip,
    SectionCard,
} from '@toolcase/react-components'

const ConfigPreviewDemo: React.FC = () => (
    <div className="container py-4">
        <div className="row">
            <div className="col-12">
                <RichPageHeader
                    chips={<RichPageHeaderChip>Data Display</RichPageHeaderChip>}
                    title="ConfigPreview"
                    description="Read-only JSON config renderer that highlights live-editable keys. Good for feature flag dashboards or settings diffs."
                />
                <div className="d-flex flex-column gap-4 mt-4">
                    <SectionCard title="Mixed value types">
                        <ConfigPreview
                            entries={[
                                { key: 'region', value: 'eu-west-1' },
                                { key: 'maxRetries', value: 5, live: true },
                                { key: 'featureFlags.newCheckout', value: true, live: true },
                                { key: 'featureFlags.betaDashboard', value: false },
                                { key: 'cacheTtl', value: 3600 },
                            ]}
                        />
                    </SectionCard>

                    <SectionCard title="Custom live label">
                        <ConfigPreview
                            liveLabel="editable"
                            entries={[
                                { key: 'apiBase', value: 'https://api.example.com', live: true },
                                { key: 'timeoutMs', value: 8000, live: true },
                            ]}
                        />
                    </SectionCard>
                </div>
            </div>
        </div>
    </div>
)

export default ConfigPreviewDemo
