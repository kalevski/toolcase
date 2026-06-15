import React, { useEffect, useRef, useState } from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'
import type {
    AdvancedTableColumn,
    AdvancedTableFilter,
    AdvancedTableSort,
} from '@toolcase/web-components'

interface Row {
    name: string
    role: string
    commits: number
}

const DATA: Row[] = [
    { name: 'Alice Chen', role: 'Maintainer', commits: 842 },
    { name: 'Bob Müller', role: 'Contributor', commits: 311 },
    { name: 'Carol Diaz', role: 'Contributor', commits: 596 },
    { name: 'Dave Kim', role: 'Reviewer', commits: 128 },
    { name: 'Eve Okafor', role: 'Contributor', commits: 477 },
    { name: 'Frank Li', role: 'Maintainer', commits: 705 },
    { name: 'Grace Park', role: 'Reviewer', commits: 233 },
    { name: 'Heidi Novak', role: 'Contributor', commits: 388 },
    { name: 'Ivan Petrov', role: 'Contributor', commits: 162 },
    { name: 'Judy Wong', role: 'Maintainer', commits: 914 },
    { name: 'Karl Brandt', role: 'Reviewer', commits: 274 },
    { name: 'Lena Roth', role: 'Contributor', commits: 519 },
]

const COLUMNS: AdvancedTableColumn[] = [
    { key: 'name', label: 'Name' },
    { key: 'role', label: 'Role' },
    { key: 'commits', label: 'Commits', align: 'right' },
]

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
]

const SORTABLE = ['name', 'role', 'commits']
const LIMIT = 5

function esc(s: string): string {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
}

function rowsHtml(rows: Row[]): string {
    if (rows.length === 0) {
        return `<tr><td colspan="3" style="text-align:center;color:var(--tc-text-faint)">No contributors match the filters</td></tr>`
    }
    return rows
        .map(
            (r) =>
                `<tr><td>${esc(r.name)}</td><td>${esc(r.role)}</td><td style="text-align:right">${r.commits}</td></tr>`,
        )
        .join('')
}

const AdvancedTableDemo: React.FC = () => {
    const tableRef = useRef<any>(null)
    const loadingRef = useRef<any>(null)

    const [filterValues, setFilterValues] = useState<Record<string, any>>({ name: '', role: '' })
    const [sort, setSort] = useState<AdvancedTableSort | null>({ column: 'commits', direction: 'desc' })
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

    // Re-derive the filtered / sorted / paginated view and push everything to the
    // element. Body rows are set imperatively into the projected <tbody>.
    useEffect(() => {
        const el = tableRef.current
        if (!el) return

        const search = String(filterValues.name ?? '').toLowerCase()
        const role = String(filterValues.role ?? '')

        let view = DATA.filter(
            (r) => (!search || r.name.toLowerCase().includes(search)) && (!role || r.role === role),
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

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <RichPageHeader
                            chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                            title="Advanced Table"
                            description="Data table with a filter toolbar, sortable headers, a translucent loading overlay, and a paginated footer. filters / sortableColumns / sort are set via JS properties, body rows are projected as slotted <tbody> rows, and the element emits tc-filter-change, tc-sort-change, and tc-page-change."
                        />

                        <div className="d-flex flex-column gap-4 mt-4">
                            <SectionCard title="Filters + sortable headers + pagination">
                                {/* @ts-ignore */}
                                <tc-advanced-table ref={tableRef}></tc-advanced-table>
                            </SectionCard>

                            <SectionCard title="Loading overlay (controls disabled, rows blocked)">
                                {/* @ts-ignore */}
                                <tc-advanced-table ref={loadingRef}></tc-advanced-table>
                            </SectionCard>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default AdvancedTableDemo
