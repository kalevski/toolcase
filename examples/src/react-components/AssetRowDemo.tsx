import React from 'react'
import {
    AssetRow,
    AssetRowList,
    Icon,
    RichPageHeader,
    RichPageHeaderChip,
    SectionCard,
} from '@toolcase/react-components'

const AssetRowDemo: React.FC = () => (
    <div className="container py-4">
        <div className="row">
            <div className="col-12">
                <RichPageHeader
                    chips={<RichPageHeaderChip>Data Display</RichPageHeaderChip>}
                    title="AssetRow"
                    description="Compact row for listing assets — icon, name, tags, and size. Pair with AssetRowList for grouped rendering."
                />
                <div className="d-flex flex-column gap-4 mt-4">
                    <SectionCard title="Asset list">
                        <AssetRowList>
                            <AssetRow
                                icon={<Icon name="file-earmark-zip" />}
                                name="bundle.assets.zip"
                                tags={['prod', 'signed']}
                                size="12.4 MB"
                            />
                            <AssetRow
                                icon={<Icon name="file-earmark-image" />}
                                name="hero-banner.webp"
                                tags={['draft']}
                                size="482 KB"
                            />
                            <AssetRow
                                icon={<Icon name="file-earmark-code" />}
                                name="schema.proto"
                                size="3 KB"
                            />
                            <AssetRow
                                icon={<Icon name="file-earmark-font" />}
                                name="inter-var.woff2"
                                tags={['cdn']}
                                size="96 KB"
                            />
                        </AssetRowList>
                    </SectionCard>

                    <SectionCard title="Single row (no tags)">
                        <AssetRow
                            icon={<Icon name="box-seam" />}
                            name="app.main.js"
                            size="1.8 MB"
                        />
                    </SectionCard>
                </div>
            </div>
        </div>
    </div>
)

export default AssetRowDemo
