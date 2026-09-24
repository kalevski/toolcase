import React, { useEffect, useRef, useState } from 'react'
import type { ChipGroup, FilterSearch, FilterSearchGroup } from '@toolcase/web-components'

const note: React.CSSProperties = {
    fontSize: '0.8125rem',
    color: 'var(--tc-text-muted)',
    lineHeight: 1.5,
}

const VOCABULARY: FilterSearchGroup[] = [
    {
        key: 'tags',
        options: [
            { value: 'decision', label: 'decision', prefix: '#' },
            { value: 'gotcha', label: 'gotcha', prefix: '#' },
            { value: 'runbook', label: 'runbook', prefix: '#' },
            { value: 'question', label: 'question', prefix: '#' },
            { value: 'todo', label: 'todo', prefix: '#' },
        ],
    },
    {
        key: 'labels',
        options: [
            { value: 'yellow', label: 'In review', color: '#f2b705' },
            { value: 'green', label: 'Shipped', color: '#12775a' },
            { value: 'red', label: 'Blocked', color: '#c7362b' },
            { value: 'sky', label: 'Reference', color: '#16359e' },
        ],
    },
]

const TITLES: Record<string, string> = { tags: 'Tags', labels: 'Labels' }

type Filters = Record<string, string[]>

const SheetGroup: React.FC<{
    group: FilterSearchGroup
    picked: string[]
    onToggle: (value: string) => void
}> = ({ group, picked, onToggle }) => {
    const ref = useRef<ChipGroup | null>(null)

    useEffect(() => {
        const el = ref.current
        if (!el) return
        el.items = group.options.map((option) => ({
            id: option.value,
            label: `${option.prefix ?? ''}${option.label}`,
            selected: picked.includes(option.value),
        }))
        el.onToggle = onToggle
    }, [group, picked, onToggle])

    return <tc-chip-group ref={ref} title={TITLES[group.key]} />
}

const FilterSearchDemo: React.FC = () => {
    const search = useRef<FilterSearch | null>(null)
    const [sheet, setSheet] = useState(false)
    const [filters, setFilters] = useState<Filters>({ tags: [], labels: [] })
    const [submitted, setSubmitted] = useState('—')

    useEffect(() => {
        if (!search.current) return
        search.current.groups = VOCABULARY.map((group) => ({
            ...group,
            selected: filters[group.key] ?? [],
        }))
    }, [filters])

    const toggle = (key: string) => (value: string) =>
        setFilters((current) => {
            const held = current[key] ?? []
            return {
                ...current,
                [key]: held.includes(value) ? held.filter((v) => v !== value) : [...held, value],
            }
        })

    const picked = Object.entries(filters)
        .filter(([, values]) => values.length > 0)
        .map(([key, values]) => `${key}: ${values.join(', ')}`)
        .join(' · ')

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="FilterSearch"
                            description="A search field with a filter button on its leading edge, and every picked filter kept on screen as a removable chip. The button opens nothing — the app shows its own filter surface."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Browse
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-3 mt-4">
                            <tc-section-card title="Filters in a bottom sheet">
                                <tc-filter-search
                                    ref={search}
                                    label="Search notes"
                                    placeholder="Search titles, bodies and tags"
                                    open={sheet}
                                    ontc-open={() => setSheet(true)}
                                    ontc-search={(e) => setSubmitted(e.detail.value)}
                                    ontc-change={(e) => setFilters(e.detail.filters)}
                                />
                                <p style={note} className="mt-3">
                                    submitted: <strong>{submitted}</strong> · filters:{' '}
                                    <strong>{picked || 'none'}</strong>
                                </p>
                                <p style={note}>
                                    The filter icon fires <code>tc-open</code> and draws no
                                    dropdown: here the app answers with a{' '}
                                    <code>tc-bottom-sheet</code>, a dashboard might open a side
                                    panel. While the sheet is up the app sets <code>open</code>,
                                    which drives <code>aria-expanded</code> and the button's active
                                    state.
                                </p>
                                <p style={note}>
                                    What stays in the element is the part that is the same
                                    everywhere: the count on the button, and the picks as chips that
                                    remove themselves. An option with a <code>prefix</code> reads as
                                    a tag; one with a <code>color</code> draws a swatch.
                                </p>
                            </tc-section-card>

                            <tc-section-card title="Any icon on the button">
                                <tc-filter-search
                                    label="Search notes"
                                    placeholder="Search, and pick where to look"
                                    filters-icon="list-filter"
                                />
                                <p style={note} className="mt-3">
                                    <code>filters-icon</code> takes any lucide name —{' '}
                                    <code>list-filter</code> here, <code>arrow-down-up</code> for a
                                    sort surface. <code>sliders-horizontal</code> is the default,
                                    and an unknown name falls back to it rather than leaving the
                                    button blank.
                                </p>
                            </tc-section-card>

                            <tc-section-card title="Themes and variants">
                                <p style={note}>
                                    Every colour is a token: the field reads the surface, border and
                                    text ramp, chips tint from the accent or their own colour, and
                                    the submit button and the count paint the accent gradient, so
                                    the <code>sunset</code> and <code>twilight</code> variants
                                    sweep. Switch the theme and variant from the site header.
                                </p>
                            </tc-section-card>
                        </div>

                        <tc-bottom-sheet
                            heading="Filters"
                            open={sheet}
                            ontc-sheet-close={() => {
                                setSheet(false)
                                search.current?.focusFilters()
                            }}
                        >
                            <div className="d-flex flex-column gap-3">
                                {VOCABULARY.map((group) => (
                                    <SheetGroup
                                        key={group.key}
                                        group={group}
                                        picked={filters[group.key] ?? []}
                                        onToggle={toggle(group.key)}
                                    />
                                ))}
                                <div className="d-flex justify-content-between gap-2">
                                    <tc-button
                                        variant="secondary"
                                        outline
                                        onClick={() => setFilters({ tags: [], labels: [] })}
                                    >
                                        Clear
                                    </tc-button>
                                    <tc-button variant="primary" onClick={() => setSheet(false)}>
                                        Done
                                    </tc-button>
                                </div>
                            </div>
                        </tc-bottom-sheet>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default FilterSearchDemo
