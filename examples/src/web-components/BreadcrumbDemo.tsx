import React from 'react'

const BreadcrumbDemo: React.FC = () => (
    <div className="py-4">
        <div className="container">
            <div className="row">
                <div className="col-12">
                    <tc-rich-page-header
                        title-text="Breadcrumb"
                        description="Navigation trail backed by Bootstrap's breadcrumb. Wrap tc-breadcrumb-item elements inside tc-breadcrumb. Use href for linked items, active to mark the current page, and divider to customise the separator character."
                    >
                        <tc-badge slot="chips" variant="secondary">
                            Web Components
                        </tc-badge>
                    </tc-rich-page-header>

                    <div className="d-flex flex-column gap-4 mt-4">
                        <tc-section-card title="Default breadcrumb — slash separator">
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
                        </tc-section-card>

                        <tc-section-card title="Custom divider — arrow (>)">
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
                        </tc-section-card>

                        <tc-section-card title="Active-only breadcrumb — single item">
                            {/* @ts-ignore */}
                            <tc-breadcrumb>
                                {/* @ts-ignore */}
                                <tc-breadcrumb-item active>Home</tc-breadcrumb-item>
                                {/* @ts-ignore */}
                            </tc-breadcrumb>
                        </tc-section-card>
                    </div>
                </div>
            </div>
        </div>
    </div>
)

export default BreadcrumbDemo
