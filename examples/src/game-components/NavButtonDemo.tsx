import React from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'
import '@toolcase/game-components'

const NavButtonDemo: React.FC = () => (
    <div className="container py-4">
        <div className="row">
            <div className="col-12">
                <RichPageHeader
                    chips={<RichPageHeaderChip>Game Components</RichPageHeaderChip>}
                    title="NavButton"
                    description="Square gilded nav button. Kinds: back (←), close (✕). Sets aria-label automatically."
                />
                <div className="d-flex flex-column gap-4 mt-4">
                    <SectionCard title="Default kind=back">
                        {/* @ts-ignore */}
                        <gc-nav-button />
                    </SectionCard>

                    <SectionCard title="Kind=close">
                        {/* @ts-ignore */}
                        <gc-nav-button kind="close" />
                    </SectionCard>

                    <SectionCard title="With explicit label (aria-label override)">
                        <div className="d-flex gap-3 align-items-center">
                            {/* @ts-ignore */}
                            <gc-nav-button kind="back" label="Return to menu" />
                            {/* @ts-ignore */}
                            <gc-nav-button kind="close" label="Dismiss dialog" />
                        </div>
                    </SectionCard>

                    <SectionCard title="Sizes (24, 36, 48, 64)">
                        <div className="d-flex gap-3 align-items-center">
                            {/* @ts-ignore */}
                            <gc-nav-button kind="back" size="24" />
                            {/* @ts-ignore */}
                            <gc-nav-button kind="back" size="36" />
                            {/* @ts-ignore */}
                            <gc-nav-button kind="close" size="48" />
                            {/* @ts-ignore */}
                            <gc-nav-button kind="close" size="64" />
                        </div>
                    </SectionCard>
                </div>
            </div>
        </div>
    </div>
)

export default NavButtonDemo
