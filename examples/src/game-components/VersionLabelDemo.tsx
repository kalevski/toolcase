import React from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'
import '@toolcase/game-components'

const VersionLabelDemo: React.FC = () => (
    <div className="container py-4">
        <div className="row">
            <div className="col-12">
                <RichPageHeader
                    chips={<RichPageHeaderChip>Game Components</RichPageHeaderChip>}
                    title="VersionLabel"
                    description="Mono micro-label with version, build, branch. Corner-stamp pattern."
                />
                <div className="d-flex flex-column gap-4 mt-4">
                    <SectionCard title="Version only">
                        {/* @ts-ignore */}
                        <gc-version-label version="1.2.3" />
                    </SectionCard>

                    <SectionCard title="Version + build">
                        {/* @ts-ignore */}
                        <gc-version-label version="1.2.3" build="4501" />
                    </SectionCard>

                    <SectionCard title="Version + build + branch">
                        {/* @ts-ignore */}
                        <gc-version-label version="1.2.3" build="4501" branch="main" />
                    </SectionCard>

                    <SectionCard title="Branch flavored">
                        {/* @ts-ignore */}
                        <gc-version-label version="0.9.0-alpha" build="dev" branch="feature/embergate" />
                    </SectionCard>
                </div>
            </div>
        </div>
    </div>
)

export default VersionLabelDemo
