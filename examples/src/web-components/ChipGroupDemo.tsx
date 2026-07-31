import React from 'react'
import { useTc } from '@toolcase/web-components/react'

const ChipGroupDemo: React.FC = () => {
    const basicRef = useTc<HTMLElement>(
        {
            items: [
                { id: 'react', label: 'React', selected: true },
                { id: 'typescript', label: 'TypeScript', selected: true },
                { id: 'nodejs', label: 'Node.js' },
                { id: 'rust', label: 'Rust', icon: 'Zap' },
                { id: 'graphql', label: 'GraphQL', count: 12 },
                { id: 'legacy', label: 'Legacy', disabled: true },
            ],
        },
        {
            'tc-toggle': (e: CustomEvent) => {
                console.log('[tc-toggle] id:', e.detail.id)
            },
        }
    )
    const borderedRef = useTc<HTMLElement>({
        items: [
            { id: 'frontend', label: 'Frontend', selected: true, variant: 'primary' },
            { id: 'backend', label: 'Backend', variant: 'info' },
            { id: 'devops', label: 'DevOps', variant: 'success' },
            { id: 'design', label: 'Design', count: 3 },
        ],
    })
    const subtitleRef = useTc<HTMLElement>({
        items: [
            { id: 'bug', label: 'Bug', icon: 'Bug', variant: 'danger' },
            { id: 'feature', label: 'Feature', icon: 'Star', variant: 'success' },
            { id: 'docs', label: 'Docs', icon: 'FileText' },
            { id: 'chore', label: 'Chore', icon: 'Settings' },
        ],
    })
    // Eight chips — enough that they wrap onto three lines at 390px, which is what the
    // rail exists to avoid.
    const railRef = useTc<HTMLElement>({
        items: [
            { id: 'all', label: 'Сите', selected: true },
            { id: 'main', label: 'Главно јадење' },
            { id: 'salad', label: 'Салата' },
            { id: 'soup', label: 'Супа' },
            { id: 'dessert', label: 'Десерт' },
            { id: 'side', label: 'Прилог' },
            { id: 'drink', label: 'Пијалак' },
            { id: 'preserve', label: 'Зимница' },
        ],
    })
    const toggleLogRef = useTc<HTMLElement>({
        items: [
            { id: 'a', label: 'Alpha' },
            { id: 'b', label: 'Beta', selected: true },
            { id: 'c', label: 'Gamma' },
        ],
        onToggle: (id: string) => {
            console.log('[onToggle callback] id:', id)
        },
    })

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="ChipGroup"
                            description="Grouped set of interactive chip buttons with optional title, subtitle, and border frame. Composes tc-chip internally. Dispatches tc-toggle with the item id when a chip is activated."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Web Components
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-4 mt-4">
                            <tc-section-card title="Basic (tc-toggle logged to console)">
                                {/* @ts-ignore */}
                                <tc-chip-group ref={basicRef} title="Tags" />
                            </tc-section-card>

                            <tc-section-card title="Bordered with title">
                                {/* @ts-ignore */}
                                <tc-chip-group ref={borderedRef} title="Teams" border />
                            </tc-section-card>

                            <tc-section-card title="With title and subtitle (bordered)">
                                {/* @ts-ignore */}
                                <tc-chip-group
                                    ref={subtitleRef}
                                    title="Issue labels"
                                    subtitle="Select one or more labels to filter by"
                                    border
                                />
                            </tc-section-card>

                            <tc-section-card title="Rail layout (layout=&quot;rail&quot;)">
                                <p className="text-muted small mb-3">
                                    One horizontally scrolling line instead of a wrapping block —
                                    screen <code>1f</code>'s filter rail. A phone fits two or three
                                    chips per line, so eight wrapping chips become three lines of
                                    chrome above the content; scrolling keeps it to one and signals
                                    that there are more. Free-scrolling on purpose: scroll-snap
                                    fights the user for a resting place between two chips.
                                </p>
                                <div style={{ maxWidth: 390 }}>
                                    {/* @ts-ignore */}
                                    <tc-chip-group ref={railRef} layout="rail" size="md" />
                                </div>
                            </tc-section-card>

                            <tc-section-card title="onToggle callback property (logged to console)">
                                {/* @ts-ignore */}
                                <tc-chip-group ref={toggleLogRef} title="Options" />
                            </tc-section-card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default ChipGroupDemo
