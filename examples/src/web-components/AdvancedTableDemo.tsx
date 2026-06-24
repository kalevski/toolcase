import React, { useEffect, useRef, useState } from 'react'
import type {
    AdvancedTableColumn,
    AdvancedTableFilter,
    AdvancedTableSort,
} from '@toolcase/web-components'

interface Row {
    name: string
    role: string
    team: string
    commits: number
    active: boolean
}

const DATA: Row[] = [
    { name: 'Alice Chen', role: 'Maintainer', team: 'Core', commits: 842, active: true },
    { name: 'Bob Müller', role: 'Contributor', team: 'Docs', commits: 311, active: true },
    { name: 'Carol Diaz', role: 'Contributor', team: 'Core', commits: 596, active: false },
    { name: 'Dave Kim', role: 'Reviewer', team: 'Infra', commits: 128, active: true },
    { name: 'Eve Okafor', role: 'Contributor', team: 'Infra', commits: 477, active: true },
    { name: 'Frank Li', role: 'Maintainer', team: 'Core', commits: 705, active: false },
    { name: 'Grace Park', role: 'Reviewer', team: 'Docs', commits: 233, active: true },
    { name: 'Heidi Novak', role: 'Contributor', team: 'Infra', commits: 388, active: true },
    { name: 'Ivan Petrov', role: 'Contributor', team: 'Docs', commits: 162, active: false },
    { name: 'Judy Wong', role: 'Maintainer', team: 'Core', commits: 914, active: true },
    { name: 'Karl Brandt', role: 'Reviewer', team: 'Infra', commits: 274, active: true },
    { name: 'Lena Roth', role: 'Contributor', team: 'Docs', commits: 519, active: false },
]

const COLUMNS: AdvancedTableColumn[] = [
    { key: 'name', label: 'Name' },
    { key: 'role', label: 'Role' },
    { key: 'team', label: 'Team' },
    { key: 'commits', label: 'Commits', align: 'right' },
]

// Built-in toolbar filters (text + selects). The "active-only" toggle lives in a
// custom toolbar above the table (tc-switch isn't a built-in filter type) but is
// wired into the same filterValues state, so every control filters the one dataset.
const FILTERS: AdvancedTableFilter[] = [
    { key: 'name', label: 'Search name', type: 'text', placeholder: 'Type to filter…' },
    {
        key: 'role',
        label: 'Role',
        type: 'select',
        placeholder: 'All roles',
        options: [
            { value: 'Maintainer', label: 'Maintainer' },
            { value: 'Contributor', label: 'Contributor' },
            { value: 'Reviewer', label: 'Reviewer' },
        ],
    },
    {
        key: 'team',
        label: 'Team',
        type: 'select',
        placeholder: 'All teams',
        options: [
            { value: 'Core', label: 'Core' },
            { value: 'Docs', label: 'Docs' },
            { value: 'Infra', label: 'Infra' },
        ],
    },
    {
        key: 'minCommits',
        label: 'Min commits',
        type: 'select',
        placeholder: 'Any',
        options: [
            { value: '250', label: '250+' },
            { value: '500', label: '500+' },
            { value: '750', label: '750+' },
        ],
    },
]

const SORTABLE = ['name', 'role', 'team', 'commits']
const LIMIT = 5

const INITIAL_FILTERS: Record<string, any> = {
    name: '',
    role: '',
    team: '',
    minCommits: '',
    activeOnly: false,
}

function esc(s: string): string {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
}

function rowsHtml(rows: Row[]): string {
    if (rows.length === 0) {
        return `<tr><td colspan="4" style="text-align:center;color:var(--tc-text-faint)">No contributors match the filters</td></tr>`
    }
    return rows
        .map(
            (r) =>
                `<tr><td>${esc(r.name)}</td><td>${esc(r.role)}</td><td>${esc(r.team)}</td><td style="text-align:right">${r.commits}</td></tr>`,
        )
        .join('')
}

const AdvancedTableDemo: React.FC = () => {
    const tableRef = useRef<any>(null)
    const switchRef = useRef<any>(null)
    const loadingRef = useRef<any>(null)

    const [filterValues, setFilterValues] = useState<Record<string, any>>(INITIAL_FILTERS)
    const [sort, setSort] = useState<AdvancedTableSort | null>({
        column: 'commits',
        direction: 'desc',
    })
    const [offset, setOffset] = useState(0)

    // Wire events once. The element drives its own internal sort/offset and emits
    // the CustomEvents; we mirror them into React state and push the values back.
    useEffect(() => {
        const el = tableRef.current
        if (!el) return

        const onFilter = (e: Event) => {
            const { key, value } = (e as CustomEvent).detail
            setFilterValues((prev) => ({ ...prev, [key]: value }))
            setOffset(0) // a changed filter resets to the first page
        }
        const onSortChange = (e: Event) => {
            const { column, direction } = (e as CustomEvent).detail
            setSort(column ? { column, direction } : null)
        }
        const onPage = (e: Event) => setOffset((e as CustomEvent).detail.offset)

        el.addEventListener('tc-filter-change', onFilter)
        el.addEventListener('tc-sort-change', onSortChange)
        el.addEventListener('tc-page-change', onPage)
        return () => {
            el.removeEventListener('tc-filter-change', onFilter)
            el.removeEventListener('tc-sort-change', onSortChange)
            el.removeEventListener('tc-page-change', onPage)
        }
    }, [])

    // The tc-switch toggle ("Active only") is a separate control above the table,
    // wired into the same filterValues state — it filters the same dataset.
    useEffect(() => {
        const el = switchRef.current
        if (!el) return
        const onToggle = (e: Event) => {
            const value = !!(e as CustomEvent).detail.value
            setFilterValues((prev) => ({ ...prev, activeOnly: value }))
            setOffset(0)
        }
        el.addEventListener('tc-change', onToggle)
        return () => el.removeEventListener('tc-change', onToggle)
    }, [])

    // Re-derive the filtered / sorted / paginated view and push everything to the
    // element. Body rows are set imperatively into the projected <tbody>.
    useEffect(() => {
        const el = tableRef.current
        if (!el) return

        const search = String(filterValues.name ?? '').toLowerCase()
        const role = String(filterValues.role ?? '')
        const team = String(filterValues.team ?? '')
        const minCommits = parseInt(String(filterValues.minCommits ?? ''), 10) || 0
        const activeOnly = !!filterValues.activeOnly

        let view = DATA.filter(
            (r) =>
                (!search || r.name.toLowerCase().includes(search)) &&
                (!role || r.role === role) &&
                (!team || r.team === team) &&
                r.commits >= minCommits &&
                (!activeOnly || r.active),
        )

        if (sort) {
            const dir = sort.direction === 'asc' ? 1 : -1
            view = [...view].sort((a, b) => {
                const av = (a as any)[sort.column]
                const bv = (b as any)[sort.column]
                if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir
                return String(av).localeCompare(String(bv)) * dir
            })
        }

        const total = view.length
        const page = view.slice(offset, offset + LIMIT)

        el.columns = COLUMNS
        el.filters = FILTERS
        el.sortableColumns = SORTABLE
        el.filterValues = filterValues
        el.sort = sort
        el.limit = LIMIT
        el.offset = offset
        el.total = total

        const body = el.querySelector('.tc-advanced-table-body')
        if (body) body.innerHTML = rowsHtml(page)
    }, [filterValues, sort, offset])

    // Static loading-overlay example.
    useEffect(() => {
        const el = loadingRef.current
        if (!el) return
        el.columns = COLUMNS
        el.sortableColumns = SORTABLE
        el.sort = { column: 'commits', direction: 'desc' }
        el.limit = LIMIT
        el.offset = 0
        el.total = DATA.length
        el.loading = true
        const body = el.querySelector('.tc-advanced-table-body')
        if (body) body.innerHTML = rowsHtml(DATA.slice(0, LIMIT))
    }, [])

    const matchCount = DATA.filter(
        (r) =>
            (!filterValues.name ||
                r.name.toLowerCase().includes(String(filterValues.name).toLowerCase())) &&
            (!filterValues.role || r.role === filterValues.role) &&
            (!filterValues.team || r.team === filterValues.team) &&
            r.commits >= (parseInt(String(filterValues.minCommits ?? ''), 10) || 0) &&
            (!filterValues.activeOnly || r.active),
    ).length

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="Advanced Table"
                            description="Data table with a filter toolbar, sortable headers, a translucent loading overlay, and a paginated footer driven by the shared tc-pagination component. filters / sortableColumns / sort are set via JS properties, body rows are projected as slotted <tbody> rows, and the element emits tc-filter-change, tc-sort-change, and tc-page-change."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Web Components
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-4 mt-4">
                            <tc-section-card title="Filters + sortable headers + pagination">
                                {/* Extra control above the table: a tc-switch wired into
                                    the same filterValues state as the built-in filters. */}
                                <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-3">
                                    {/* @ts-ignore */}
                                    <tc-switch
                                        ref={switchRef}
                                        label="Active contributors only"
                                    ></tc-switch>
                                    <span
                                        className="font-monospace"
                                        style={{
                                            fontSize: '0.75rem',
                                            color: 'var(--tc-text-muted)',
                                        }}
                                    >
                                        {matchCount} of {DATA.length} match
                                    </span>
                                </div>
                                {/* @ts-ignore */}
                                <tc-advanced-table ref={tableRef}></tc-advanced-table>
                            </tc-section-card>

                            <tc-section-card title="Loading overlay (controls disabled, rows blocked)">
                                {/* @ts-ignore */}
                                <tc-advanced-table ref={loadingRef}></tc-advanced-table>
                            </tc-section-card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default AdvancedTableDemo
