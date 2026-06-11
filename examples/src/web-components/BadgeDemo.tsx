import React from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const BadgeDemo: React.FC = () => (
    <div className="py-4">
        <div className="container">
            <div className="row">
                <div className="col-12">
                    <RichPageHeader
                        chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                        title="Badge"
                        description="Small count and labelling components. Supports all Bootstrap theme variants and an optional pill shape."
                    />

                    <div className="d-flex flex-column gap-4 mt-4">
                        <SectionCard title="Variants (text attribute)">
                            <div className="d-flex flex-wrap gap-2">
                                {/* @ts-ignore */}
                                <tc-badge variant="primary" text="Primary"></tc-badge>
                                {/* @ts-ignore */}
                                <tc-badge variant="secondary" text="Secondary"></tc-badge>
                                {/* @ts-ignore */}
                                <tc-badge variant="success" text="Success"></tc-badge>
                                {/* @ts-ignore */}
                                <tc-badge variant="danger" text="Danger"></tc-badge>
                                {/* @ts-ignore */}
                                <tc-badge variant="warning" text="Warning"></tc-badge>
                                {/* @ts-ignore */}
                                <tc-badge variant="info" text="Info"></tc-badge>
                                {/* @ts-ignore */}
                                <tc-badge variant="light" text="Light"></tc-badge>
                                {/* @ts-ignore */}
                                <tc-badge variant="dark" text="Dark"></tc-badge>
                            </div>
                        </SectionCard>

                        <SectionCard title="Pill shape">
                            <div className="d-flex flex-wrap gap-2">
                                {/* @ts-ignore */}
                                <tc-badge variant="primary" text="Primary" pill></tc-badge>
                                {/* @ts-ignore */}
                                <tc-badge variant="secondary" text="Secondary" pill></tc-badge>
                                {/* @ts-ignore */}
                                <tc-badge variant="success" text="Success" pill></tc-badge>
                                {/* @ts-ignore */}
                                <tc-badge variant="danger" text="Danger" pill></tc-badge>
                                {/* @ts-ignore */}
                                <tc-badge variant="warning" text="Warning" pill></tc-badge>
                                {/* @ts-ignore */}
                                <tc-badge variant="info" text="Info" pill></tc-badge>
                                {/* @ts-ignore */}
                                <tc-badge variant="light" text="Light" pill></tc-badge>
                                {/* @ts-ignore */}
                                <tc-badge variant="dark" text="Dark" pill></tc-badge>
                            </div>
                        </SectionCard>

                        <SectionCard title="Slotted children">
                            <div className="d-flex flex-wrap gap-2">
                                {/* @ts-ignore */}
                                <tc-badge variant="primary">42</tc-badge>
                                {/* @ts-ignore */}
                                <tc-badge variant="success" pill>New</tc-badge>
                                {/* @ts-ignore */}
                                <tc-badge variant="danger">99+</tc-badge>
                            </div>
                        </SectionCard>
                    </div>
                </div>
            </div>
        </div>
    </div>
)

export default BadgeDemo
