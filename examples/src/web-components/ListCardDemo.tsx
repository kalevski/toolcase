import React, { useEffect, useRef } from 'react'

const RANKED_ITEMS = [
    { id: '1', label: 'React', value: '42,300' },
    { id: '2', label: 'Vue', value: '18,100' },
    { id: '3', label: 'Angular', value: '11,500' },
    { id: '4', label: 'Svelte', value: '7,200' },
    { id: '5', label: 'Solid', value: '3,800' },
]

const ICON_ITEMS = [
    { id: '1', icon: 'Github', label: 'GitHub', value: '12.4k' },
    { id: '2', icon: 'Twitter', label: 'Twitter', value: '8.9k' },
    { id: '3', icon: 'Linkedin', label: 'LinkedIn', value: '5.1k' },
    { id: '4', icon: 'Youtube', label: 'YouTube', value: '2.3k' },
]

const ListCardDemo: React.FC = () => {
    const rankedRef = useRef<any>(null)
    const iconRef = useRef<any>(null)

    useEffect(() => {
        if (rankedRef.current) {
            rankedRef.current.items = RANKED_ITEMS
        }
        if (iconRef.current) {
            iconRef.current.items = ICON_ITEMS
        }
    }, [])

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="ListCard"
                            description="Dashboard card rendering a list of items with optional ranking numbers, leading icons, and trailing values."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Web Components
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-4 mt-4">
                            <tc-section-card title="Ordered — ranked list with values (JS property)">
                                <div style={{ maxWidth: 480 }}>
                                    {/* @ts-ignore */}
                                    <tc-list-card ref={rankedRef} title="Top Frameworks" ordered />
                                </div>
                            </tc-section-card>

                            <tc-section-card title="Icon list — leading lucide icons (JS property)">
                                <div style={{ maxWidth: 480 }}>
                                    {/* @ts-ignore */}
                                    <tc-list-card ref={iconRef} title="Social Channels" />
                                </div>
                            </tc-section-card>

                            <tc-section-card title="Loading state — default count (4 rows)">
                                <div style={{ maxWidth: 480 }}>
                                    {/* @ts-ignore */}
                                    <tc-list-card title="Top Frameworks" loading />
                                </div>
                            </tc-section-card>

                            <tc-section-card title="Loading state — ordered, 5 rows">
                                <div style={{ maxWidth: 480 }}>
                                    {/* @ts-ignore */}
                                    <tc-list-card
                                        title="Leaderboard"
                                        loading
                                        ordered
                                        loading-count="5"
                                    />
                                </div>
                            </tc-section-card>

                            <tc-section-card title="Loading state — no title">
                                <div style={{ maxWidth: 480 }}>
                                    {/* @ts-ignore */}
                                    <tc-list-card loading />
                                </div>
                            </tc-section-card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default ListCardDemo
