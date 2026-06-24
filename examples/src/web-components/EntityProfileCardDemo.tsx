import React, { useEffect, useRef } from 'react'

const BASIC_META = [
    { label: 'Location', value: 'San Francisco, CA' },
    { label: 'Language', value: 'TypeScript' },
    { label: 'Stars', value: '12.4k' },
    { label: 'Joined', value: 'Jan 2019' },
]

const FULL_META = [
    { label: 'Role', value: 'Senior Engineer' },
    { label: 'Team', value: 'Frontend' },
    { label: 'Location', value: 'San Francisco, CA' },
    { label: 'Since', value: 'Mar 2021' },
    { label: 'PRs', value: '342' },
    { label: 'Reviews', value: '1,204' },
]

const EntityProfileCardDemo: React.FC = () => {
    const basicRef = useRef<any>(null)
    const fullRef = useRef<any>(null)

    useEffect(() => {
        if (basicRef.current) {
            basicRef.current.meta = BASIC_META
        }
    }, [])

    useEffect(() => {
        if (fullRef.current) {
            fullRef.current.meta = FULL_META
        }
    }, [])

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="EntityProfileCard"
                            description="Profile card with a hero section (lead avatar, title, subtitle, chips) and a meta-information grid of label-value pairs."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Web Components
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-4 mt-4">
                            <tc-section-card title="Title attribute + meta grid (JS property)">
                                <div style={{ maxWidth: 480 }}>
                                    {/* @ts-ignore */}
                                    <tc-entity-profile-card ref={basicRef} title="Anthropic AI" />
                                </div>
                            </tc-section-card>

                            <tc-section-card title="Lead avatar, title slot, subtitle, chips, and meta">
                                <div style={{ maxWidth: 480 }}>
                                    {/* @ts-ignore */}
                                    <tc-entity-profile-card ref={fullRef}>
                                        {/* @ts-ignore */}
                                        <tc-avatar slot="lead" name="Alice Chen" size="lg" />
                                        <strong slot="title">Alice Chen</strong>
                                        <span slot="subtitle">
                                            Senior Frontend Engineer · Anthropic
                                        </span>
                                        {/* @ts-ignore */}
                                        <tc-badge slot="chips" variant="primary">
                                            TypeScript
                                        </tc-badge>
                                        {/* @ts-ignore */}
                                        <tc-badge slot="chips" variant="secondary">
                                            React
                                        </tc-badge>
                                        {/* @ts-ignore */}
                                        <tc-badge slot="chips" variant="secondary">
                                            Web Components
                                        </tc-badge>
                                        {/* @ts-ignore */}
                                    </tc-entity-profile-card>
                                </div>
                            </tc-section-card>

                            <tc-section-card title="Minimal — title attribute only">
                                <div style={{ maxWidth: 360 }}>
                                    {/* @ts-ignore */}
                                    <tc-entity-profile-card title="Open Source Project" />
                                </div>
                            </tc-section-card>

                            <tc-section-card title="Loading skeleton">
                                <div
                                    style={{
                                        display: 'grid',
                                        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                                        gap: '1rem',
                                    }}
                                >
                                    {/* @ts-ignore */}
                                    <tc-entity-profile-card loading title="Profile" />
                                    {/* @ts-ignore */}
                                    <tc-entity-profile-card loading title="Profile" />
                                </div>
                            </tc-section-card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default EntityProfileCardDemo
