import React, { useState } from 'react'
import type { TableColumn } from '@toolcase/web-components'
import { useTc } from '@toolcase/web-components/react'

interface UserRow {
    id: number
    name: string
    role: string
    commits: number
    status: 'active' | 'away' | 'offline'
}

const STATUS_VARIANT: Record<UserRow['status'], string> = {
    active: 'success',
    away: 'warning',
    offline: 'secondary',
}

const ROWS: UserRow[] = [
    { id: 1, name: 'Alice Chen', role: 'Maintainer', commits: 842, status: 'active' },
    { id: 2, name: 'Bob Müller', role: 'Contributor', commits: 311, status: 'away' },
    { id: 3, name: 'Carol Diaz', role: 'Contributor', commits: 596, status: 'active' },
    { id: 4, name: 'Dave Kim', role: 'Reviewer', commits: 128, status: 'offline' },
    { id: 5, name: 'Eve Okafor', role: 'Contributor', commits: 477, status: 'active' },
]

const COLUMNS: TableColumn[] = [
    { key: 'name', header: 'Name', sortable: true },
    { key: 'role', header: 'Role', sortable: true },
    { key: 'commits', header: 'Commits', sortable: true, align: 'right' },
    {
        key: 'status',
        header: 'Status',
        align: 'center',
        render: (row: UserRow) =>
            `<tc-badge variant="${STATUS_VARIANT[row.status]}" text="${row.status}"></tc-badge>`,
    },
]

const ROW_KEY = (row: UserRow) => row.id

const TableDemo: React.FC = () => {
    const [clicked, setClicked] = useState<string | null>(null)

    const sortableRef = useTc<HTMLElement>({ columns: COLUMNS, data: ROWS, rowKey: ROW_KEY })

    const compactRef = useTc<HTMLElement>({ columns: COLUMNS, data: ROWS, rowKey: ROW_KEY })

    const stickyRef = useTc<HTMLElement>({
        columns: COLUMNS,
        // Repeat the dataset so the box actually scrolls under the pinned header.
        data: [...ROWS, ...ROWS, ...ROWS],
        rowKey: (row: UserRow, i: number) => `${row.id}-${i}`,
    })

    const clickRef = useTc<HTMLElement>(
        {
            columns: COLUMNS,
            data: ROWS,
            rowKey: ROW_KEY,
            onrowclick: (row: UserRow) => setClicked(row.name),
        },
        { 'tc-row-click': (e: Event) => setClicked((e as CustomEvent).detail.row.name) }
    )

    const emptyRef = useTc<HTMLElement>({ columns: COLUMNS, data: [], rowKey: ROW_KEY })

    const loadingRef = useTc<HTMLElement>({ columns: COLUMNS, data: [], rowKey: ROW_KEY })

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="Table"
                            description="Flexible table with sortable columns, loading skeletons, and optional row-click handlers. Columns, data, and rowKey are set via JS properties; rows become interactive when an onrowclick callback is set and emit a tc-row-click event."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Web Components
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-4 mt-4">
                            <tc-section-card title="Sortable + striped + hoverable + render column">
                                {/* @ts-ignore */}
                                <tc-table ref={sortableRef} striped hoverable></tc-table>
                            </tc-section-card>

                            <tc-section-card title="Compact + borderless">
                                {/* @ts-ignore */}
                                <tc-table ref={compactRef} compact borderless hoverable></tc-table>
                            </tc-section-card>

                            <tc-section-card title="Sticky header (height-constrained, scroll the box)">
                                <div style={{ maxHeight: 220, overflowY: 'auto' }}>
                                    {/* @ts-ignore */}
                                    <tc-table
                                        ref={stickyRef}
                                        sticky-header
                                        hoverable
                                        striped
                                    ></tc-table>
                                </div>
                            </tc-section-card>

                            <tc-section-card title="Row click → tc-row-click">
                                {clicked && (
                                    <p
                                        className="mb-3"
                                        style={{
                                            fontSize: '0.875rem',
                                            color: 'var(--tc-text-muted)',
                                        }}
                                    >
                                        Last clicked row: <strong>{clicked}</strong>
                                    </p>
                                )}
                                {/* @ts-ignore */}
                                <tc-table ref={clickRef} hoverable></tc-table>
                            </tc-section-card>

                            <tc-section-card title="Empty state">
                                {/* @ts-ignore */}
                                <tc-table
                                    ref={emptyRef}
                                    empty-message="No contributors yet"
                                ></tc-table>
                            </tc-section-card>

                            <tc-section-card title="Loading skeleton">
                                {/* @ts-ignore */}
                                <tc-table ref={loadingRef} loading loading-rows="4"></tc-table>
                            </tc-section-card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default TableDemo
