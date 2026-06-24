import React, { useEffect, useRef } from 'react'

const SAMPLE_ACTIVITIES = [
    {
        id: '1',
        icon: 'GitCommit',
        title: 'Pushed 3 commits to main',
        description: 'feat: add activity card web component',
        timestamp: '2m ago',
    },
    {
        id: '2',
        icon: 'CheckCircle',
        title: 'CI pipeline passed',
        description: 'All 42 tests passed in 18s',
        timestamp: '4m ago',
    },
    {
        id: '3',
        icon: 'MessageSquare',
        title: 'New comment on PR #84',
        description: 'Looks good, approving',
        timestamp: '12m ago',
    },
    {
        id: '4',
        icon: 'UserPlus',
        title: 'Alice Martin joined the team',
        timestamp: '1h ago',
    },
]

const SAMPLE_SHORT = [
    { id: '1', icon: 'Upload', title: 'Deployed v2.4.1 to production', timestamp: 'just now' },
    {
        id: '2',
        icon: 'AlertTriangle',
        title: 'Error rate spike detected',
        description: '3 errors in the last minute',
        timestamp: '30s ago',
    },
]

const ActivityCardDemo: React.FC = () => {
    const loadedRef = useRef<any>(null)
    const noTitleRef = useRef<any>(null)
    const shortRef = useRef<any>(null)

    useEffect(() => {
        if (loadedRef.current) {
            loadedRef.current.activities = SAMPLE_ACTIVITIES
        }
        if (noTitleRef.current) {
            noTitleRef.current.activities = SAMPLE_ACTIVITIES
        }
        if (shortRef.current) {
            shortRef.current.activities = SAMPLE_SHORT
        }
    }, [])

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="ActivityCard"
                            description="Dashboard card showing a vertical timeline of activity items with icons, descriptions, and timestamps."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Web Components
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-4 mt-4">
                            <tc-section-card title="Loaded — with title (JS property)">
                                <div style={{ maxWidth: 480 }}>
                                    {/* @ts-ignore */}
                                    <tc-activity-card ref={loadedRef} title="Recent Activity" />
                                </div>
                            </tc-section-card>

                            <tc-section-card title="Loaded — no title (JS property)">
                                <div style={{ maxWidth: 480 }}>
                                    {/* @ts-ignore */}
                                    <tc-activity-card ref={noTitleRef} />
                                </div>
                            </tc-section-card>

                            <tc-section-card title="Short feed — 2 items">
                                <div style={{ maxWidth: 480 }}>
                                    {/* @ts-ignore */}
                                    <tc-activity-card ref={shortRef} title="Deployment Log" />
                                </div>
                            </tc-section-card>

                            <tc-section-card title="Loading state — default count (3 rows)">
                                <div style={{ maxWidth: 480 }}>
                                    {/* @ts-ignore */}
                                    <tc-activity-card title="Recent Activity" loading />
                                </div>
                            </tc-section-card>

                            <tc-section-card title="Loading state — 5 rows (loading-count attribute)">
                                <div style={{ maxWidth: 480 }}>
                                    {/* @ts-ignore */}
                                    <tc-activity-card
                                        title="Activity Feed"
                                        loading
                                        loading-count="5"
                                    />
                                </div>
                            </tc-section-card>

                            <tc-section-card title="Loading state — no title">
                                <div style={{ maxWidth: 480 }}>
                                    {/* @ts-ignore */}
                                    <tc-activity-card loading />
                                </div>
                            </tc-section-card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default ActivityCardDemo
