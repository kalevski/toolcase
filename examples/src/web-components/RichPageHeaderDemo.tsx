import React from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const RichPageHeaderDemo: React.FC = () => (
    <div className="py-4">
        <div className="container">
            <div className="row">
                <div className="col-12">
                    <RichPageHeader
                        icon={{ name: 'LayoutTemplate', color: 'violet' }}
                        chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                        title="RichPageHeader"
                        sub="tc-rich-page-header"
                        description="Page-level hero with an optional icon tile, chip row, title, subtitle, description, and slotted action buttons. Attributes drive text; named slots carry interactive children."
                    />

                    <div className="d-flex flex-column gap-4 mt-4">
                        <SectionCard title="Icon + title + sub + description">
                            {/* @ts-ignore */}
                            <tc-rich-page-header
                                icon-name="Database"
                                icon-color="blue"
                                title-text="Projects"
                                sub="Manage your active projects and archives"
                                description="All projects are automatically backed up every 24 hours. Changes are tracked and can be rolled back at any time."
                            >
                                {/* @ts-ignore */}
                                <tc-badge slot="chips" variant="info">Beta</tc-badge>
                                {/* @ts-ignore */}
                                <tc-button slot="actions" variant="primary">New project</tc-button>
                                {/* @ts-ignore */}
                                <tc-button slot="actions" variant="secondary">Import</tc-button>
                            {/* @ts-ignore */}
                            </tc-rich-page-header>
                        </SectionCard>

                        <SectionCard title="Emerald icon, no description">
                            {/* @ts-ignore */}
                            <tc-rich-page-header
                                icon-name="ShieldCheck"
                                icon-color="emerald"
                                title-text="Security Overview"
                                sub="Last scan: 2 hours ago"
                            >
                                {/* @ts-ignore */}
                                <tc-badge slot="chips" variant="success">Protected</tc-badge>
                                {/* @ts-ignore */}
                                <tc-button slot="actions" variant="secondary">Run scan</tc-button>
                            {/* @ts-ignore */}
                            </tc-rich-page-header>
                        </SectionCard>

                        <SectionCard title="Amber icon, chips only">
                            {/* @ts-ignore */}
                            <tc-rich-page-header
                                icon-name="AlertTriangle"
                                icon-color="amber"
                                title-text="Incidents"
                                description="Review and resolve open incidents. Critical incidents automatically page the on-call engineer."
                            >
                                {/* @ts-ignore */}
                                <tc-badge slot="chips" variant="warning">3 open</tc-badge>
                                {/* @ts-ignore */}
                                <tc-badge slot="chips" variant="secondary">12 resolved</tc-badge>
                            {/* @ts-ignore */}
                            </tc-rich-page-header>
                        </SectionCard>

                        <SectionCard title="No icon, title only">
                            {/* @ts-ignore */}
                            <tc-rich-page-header
                                title-text="Settings"
                                description="Configure your workspace preferences, integrations, and notification rules."
                            >
                                {/* @ts-ignore */}
                                <tc-button slot="actions" variant="primary">Save changes</tc-button>
                            {/* @ts-ignore */}
                            </tc-rich-page-header>
                        </SectionCard>

                        <SectionCard title="Violet icon">
                            {/* @ts-ignore */}
                            <tc-rich-page-header
                                icon-name="Sparkles"
                                icon-color="violet"
                                title-text="AI Assistant"
                                sub="Powered by claude-sonnet-4-6"
                                description="Ask questions, generate code, summarize documents, and automate repetitive tasks."
                            >
                                {/* @ts-ignore */}
                                <tc-badge slot="chips" variant="secondary">New</tc-badge>
                                {/* @ts-ignore */}
                                <tc-button slot="actions" variant="primary">Start chat</tc-button>
                            {/* @ts-ignore */}
                            </tc-rich-page-header>
                        </SectionCard>
                    </div>
                </div>
            </div>
        </div>
    </div>
)

export default RichPageHeaderDemo
