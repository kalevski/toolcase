import React from 'react'
import { RichPageHeader, RichPageHeaderChip } from '@toolcase/react-components'
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
                    {/* @ts-ignore */}
                    <gc-panel bordered>
                        {/* @ts-ignore */}
                        <gc-panel-header header-title="Version only" />
                        {/* @ts-ignore */}
                        <gc-version-label version="1.2.3" />
                    {/* @ts-ignore */}
                    </gc-panel>

                    {/* @ts-ignore */}

                    <gc-panel bordered>

                        {/* @ts-ignore */}

                        <gc-panel-header header-title="Version + build" />
                        {/* @ts-ignore */}
                        <gc-version-label version="1.2.3" build="4501" />
                    {/* @ts-ignore */}
                    </gc-panel>

                    {/* @ts-ignore */}

                    <gc-panel bordered>

                        {/* @ts-ignore */}

                        <gc-panel-header header-title="Version + build + branch" />
                        {/* @ts-ignore */}
                        <gc-version-label version="1.2.3" build="4501" branch="main" />
                    {/* @ts-ignore */}
                    </gc-panel>

                    {/* @ts-ignore */}

                    <gc-panel bordered>

                        {/* @ts-ignore */}

                        <gc-panel-header header-title="Branch flavored" />
                        {/* @ts-ignore */}
                        <gc-version-label version="0.9.0-alpha" build="dev" branch="feature/embergate" />
                    {/* @ts-ignore */}
                    </gc-panel>
                </div>
            </div>
        </div>
    </div>
)

export default VersionLabelDemo
