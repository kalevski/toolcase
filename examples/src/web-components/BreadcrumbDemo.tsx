import React from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const BreadcrumbDemo: React.FC = () => (
    <div className="py-4">
        <div className="container">
            <div className="row">
                <div className="col-12">
                    <RichPageHeader
                        chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                        title="Breadcrumb"
                        description="Navigation trail backed by Bootstrap's breadcrumb. Wrap tc-breadcrumb-item elements inside tc-breadcrumb. Use href for linked items, active to mark the current page, and divider to customise the separator character."
                    />

                    <div className="d-flex flex-column gap-4 mt-4">
                        <SectionCard title="Default breadcrumb — slash separator">
                            {/* @ts-ignore */}
                            <tc-breadcrumb>
                                {/* @ts-ignore */}
                                <tc-breadcrumb-item href="/">Home</tc-breadcrumb-item>
                                {/* @ts-ignore */}
                                <tc-breadcrumb-item href="/library">Library</tc-breadcrumb-item>
                                {/* @ts-ignore */}
                                <tc-breadcrumb-item active>Data</tc-breadcrumb-item>
                            {/* @ts-ignore */}
                            </tc-breadcrumb>
                        </SectionCard>

                        <SectionCard title="Custom divider — arrow (>)">
                            {/* @ts-ignore */}
                            <tc-breadcrumb divider=">">
                                {/* @ts-ignore */}
                                <tc-breadcrumb-item href="/">Home</tc-breadcrumb-item>
                                {/* @ts-ignore */}
                                <tc-breadcrumb-item href="/products">Products</tc-breadcrumb-item>
                                {/* @ts-ignore */}
                                <tc-breadcrumb-item active>Widget</tc-breadcrumb-item>
                            {/* @ts-ignore */}
                            </tc-breadcrumb>
                        </SectionCard>

                        <SectionCard title="Active-only breadcrumb — single item">
                            {/* @ts-ignore */}
                            <tc-breadcrumb>
                                {/* @ts-ignore */}
                                <tc-breadcrumb-item active>Home</tc-breadcrumb-item>
                            {/* @ts-ignore */}
                            </tc-breadcrumb>
                        </SectionCard>
                    </div>
                </div>
            </div>
        </div>
    </div>
)

export default BreadcrumbDemo
