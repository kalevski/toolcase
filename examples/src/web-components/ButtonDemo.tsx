import React from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const ButtonDemo: React.FC = () => (
    <div className="py-4">
        <div className="container">
            <div className="row">
                <div className="col-12">
                    <RichPageHeader
                        chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                        title="Button"
                        description="Bootstrap button wrapper with variant, outline, size, loading, and link support."
                    />

                    <div className="d-flex flex-column gap-4 mt-4">
                        <SectionCard title="Variants">
                            <div className="d-flex flex-wrap gap-2">
                                {/* @ts-ignore */}
                                <tc-button variant="primary">Primary</tc-button>
                                {/* @ts-ignore */}
                                <tc-button variant="secondary">Secondary</tc-button>
                                {/* @ts-ignore */}
                                <tc-button variant="success">Success</tc-button>
                                {/* @ts-ignore */}
                                <tc-button variant="danger">Danger</tc-button>
                                {/* @ts-ignore */}
                                <tc-button variant="warning">Warning</tc-button>
                                {/* @ts-ignore */}
                                <tc-button variant="info">Info</tc-button>
                                {/* @ts-ignore */}
                                <tc-button variant="light">Light</tc-button>
                                {/* @ts-ignore */}
                                <tc-button variant="dark">Dark</tc-button>
                            </div>
                        </SectionCard>

                        <SectionCard title="Outline">
                            <div className="d-flex flex-wrap gap-2">
                                {/* @ts-ignore */}
                                <tc-button variant="primary" outline>Primary</tc-button>
                                {/* @ts-ignore */}
                                <tc-button variant="secondary" outline>Secondary</tc-button>
                                {/* @ts-ignore */}
                                <tc-button variant="success" outline>Success</tc-button>
                                {/* @ts-ignore */}
                                <tc-button variant="danger" outline>Danger</tc-button>
                                {/* @ts-ignore */}
                                <tc-button variant="warning" outline>Warning</tc-button>
                                {/* @ts-ignore */}
                                <tc-button variant="info" outline>Info</tc-button>
                                {/* @ts-ignore */}
                                <tc-button variant="light" outline>Light</tc-button>
                                {/* @ts-ignore */}
                                <tc-button variant="dark" outline>Dark</tc-button>
                            </div>
                        </SectionCard>

                        <SectionCard title="Sizes">
                            <div className="d-flex flex-wrap align-items-center gap-2">
                                {/* @ts-ignore */}
                                <tc-button variant="primary" size="lg">Large</tc-button>
                                {/* @ts-ignore */}
                                <tc-button variant="primary">Default</tc-button>
                                {/* @ts-ignore */}
                                <tc-button variant="primary" size="sm">Small</tc-button>
                            </div>
                        </SectionCard>

                        <SectionCard title="Loading">
                            <div className="d-flex flex-wrap gap-2">
                                {/* @ts-ignore */}
                                <tc-button variant="primary" loading>Saving…</tc-button>
                                {/* @ts-ignore */}
                                <tc-button variant="secondary" loading>Loading…</tc-button>
                                {/* @ts-ignore */}
                                <tc-button variant="success" outline loading>Processing…</tc-button>
                            </div>
                        </SectionCard>

                        <SectionCard title="Disabled">
                            <div className="d-flex flex-wrap gap-2">
                                {/* @ts-ignore */}
                                <tc-button variant="primary" disabled>Disabled</tc-button>
                                {/* @ts-ignore */}
                                <tc-button variant="secondary" outline disabled>Disabled</tc-button>
                            </div>
                        </SectionCard>

                        <SectionCard title="Link (href)">
                            <div className="d-flex flex-wrap gap-2">
                                {/* @ts-ignore */}
                                <tc-button variant="primary" href="#">Link button</tc-button>
                                {/* @ts-ignore */}
                                <tc-button variant="info" outline href="#">Outline link</tc-button>
                                {/* @ts-ignore */}
                                <tc-button variant="secondary" href="#" disabled>Disabled link</tc-button>
                            </div>
                        </SectionCard>
                    </div>
                </div>
            </div>
        </div>
    </div>
)

export default ButtonDemo
