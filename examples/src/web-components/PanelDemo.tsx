import React from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const PanelDemo: React.FC = () => {
    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <RichPageHeader
                            chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                            title="Panel"
                            description="A themed surface panel with an optional header. Compose tc-panel-header as a child to add a heading row with an optional icon and action slot."
                        />

                        <div className="d-flex flex-column gap-4 mt-4">
                            <SectionCard title="Basic panel (no border)">
                                {/* @ts-ignore */}
                                <tc-panel>
                                    <p className="m-0">Panel body content — no border by default.</p>
                                </tc-panel>
                            </SectionCard>

                            <SectionCard title="Bordered panel">
                                {/* @ts-ignore */}
                                <tc-panel bordered>
                                    <p className="m-0">Panel body with a 1px hairline border.</p>
                                </tc-panel>
                            </SectionCard>

                            <SectionCard title="Bordered panel with header">
                                {/* @ts-ignore */}
                                <tc-panel bordered>
                                    {/* @ts-ignore */}
                                    <tc-panel-header heading="Panel Title"></tc-panel-header>
                                    <p className="m-0">Body content below the header.</p>
                                </tc-panel>
                            </SectionCard>

                            <SectionCard title="Header with icon">
                                {/* @ts-ignore */}
                                <tc-panel bordered>
                                    {/* @ts-ignore */}
                                    <tc-panel-header heading="Settings" icon="Settings"></tc-panel-header>
                                    <div>
                                        <p className="mb-1">Configure your preferences below.</p>
                                        <p className="m-0 text-muted small">Changes apply immediately.</p>
                                    </div>
                                </tc-panel>
                            </SectionCard>

                            <SectionCard title="Header with action slot">
                                {/* @ts-ignore */}
                                <tc-panel bordered>
                                    {/* @ts-ignore */}
                                    <tc-panel-header heading="Recent Activity" icon="Activity">
                                        <button slot="action" className="btn btn-sm btn-outline-secondary">View all</button>
                                    </tc-panel-header>
                                    <ul className="m-0 ps-3">
                                        <li>Deploy completed</li>
                                        <li>PR #42 merged</li>
                                        <li>Build passed</li>
                                    </ul>
                                </tc-panel>
                            </SectionCard>

                            <SectionCard title="Unbordered panel with header">
                                {/* @ts-ignore */}
                                <tc-panel>
                                    {/* @ts-ignore */}
                                    <tc-panel-header heading="Summary" icon="BarChart2"></tc-panel-header>
                                    <p className="m-0">Panels without a border can still use a header for structure.</p>
                                </tc-panel>
                            </SectionCard>

                            <SectionCard title="Multiple panels stacked">
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                                    {/* @ts-ignore */}
                                    <tc-panel bordered>
                                        {/* @ts-ignore */}
                                        <tc-panel-header heading="Alpha" icon="Layers"></tc-panel-header>
                                        <p className="m-0">First panel content.</p>
                                    </tc-panel>
                                    {/* @ts-ignore */}
                                    <tc-panel bordered>
                                        {/* @ts-ignore */}
                                        <tc-panel-header heading="Beta" icon="Box"></tc-panel-header>
                                        <p className="m-0">Second panel content.</p>
                                    </tc-panel>
                                    {/* @ts-ignore */}
                                    <tc-panel bordered>
                                        {/* @ts-ignore */}
                                        <tc-panel-header heading="Gamma" icon="Cpu"></tc-panel-header>
                                        <p className="m-0">Third panel content.</p>
                                    </tc-panel>
                                </div>
                            </SectionCard>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default PanelDemo
