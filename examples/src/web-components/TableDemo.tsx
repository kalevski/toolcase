import React, { useEffect, useRef, useState } from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'
import type { TableColumn } from '@toolcase/web-components'

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
    const sortableRef = useRef<any>(null)
    const compactRef = useRef<any>(null)
    const stickyRef = useRef<any>(null)
    const clickRef = useRef<any>(null)
    const emptyRef = useRef<any>(null)
    const loadingRef = useRef<any>(null)
    const [clicked, setClicked] = useState<string | null>(null)

    useEffect(() => {
        if (sortableRef.current) {
            sortableRef.current.columns = COLUMNS
            sortableRef.current.data = ROWS
            sortableRef.current.rowKey = ROW_KEY
        }
    }, [])

    useEffect(() => {
        if (compactRef.current) {
            compactRef.current.columns = COLUMNS
            compactRef.current.data = ROWS
            compactRef.current.rowKey = ROW_KEY
        }
    }, [])

    useEffect(() => {
        if (stickyRef.current) {
            stickyRef.current.columns = COLUMNS
            // Repeat the dataset so the box actually scrolls under the pinned header.
            stickyRef.current.data = [...ROWS, ...ROWS, ...ROWS]
            stickyRef.current.rowKey = (row: UserRow, i: number) => `${row.id}-${i}`
        }
    }, [])

    useEffect(() => {
        if (clickRef.current) {
            clickRef.current.columns = COLUMNS
            clickRef.current.data = ROWS
            clickRef.current.rowKey = ROW_KEY
            clickRef.current.onrowclick = (row: UserRow) => setClicked(row.name)
            const handler = (e: Event) => setClicked((e as CustomEvent).detail.row.name)
            const el = clickRef.current
            el.addEventListener('tc-row-click', handler)
            return () => el.removeEventListener('tc-row-click', handler)
        }
    }, [])

    useEffect(() => {
        if (emptyRef.current) {
            emptyRef.current.columns = COLUMNS
            emptyRef.current.data = []
            emptyRef.current.rowKey = ROW_KEY
        }
    }, [])

    useEffect(() => {
        if (loadingRef.current) {
            loadingRef.current.columns = COLUMNS
            loadingRef.current.data = []
            loadingRef.current.rowKey = ROW_KEY
        }
    }, [])

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <RichPageHeader
                            chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                            title="Table"
                            description="Flexible table with sortable columns, loading skeletons, and optional row-click handlers. Columns, data, and rowKey are set via JS properties; rows become interactive when an onrowclick callback is set and emit a tc-row-click event."
                        />

                        <div className="d-flex flex-column gap-4 mt-4">
                            <SectionCard title="Sortable + striped + hoverable + render column">
                                {/* @ts-ignore */}
                                <tc-table ref={sortableRef} striped hoverable></tc-table>
                            </SectionCard>

                            <SectionCard title="Compact + borderless">
                                {/* @ts-ignore */}
                                <tc-table ref={compactRef} compact borderless hoverable></tc-table>
                            </SectionCard>

                            <SectionCard title="Sticky header (height-constrained, scroll the box)">
                                <div style={{ maxHeight: 220 }}>
                                    {/* @ts-ignore */}
                                    <tc-table ref={stickyRef} sticky-header hoverable striped></tc-table>
                                </div>
                            </SectionCard>

                            <SectionCard title="Row click → tc-row-click">
                                {clicked && (
                                    <p className="mb-3" style={{ fontSize: '0.875rem', color: 'var(--tc-text-muted)' }}>
                                        Last clicked row: <strong>{clicked}</strong>
                                    </p>
                                )}
                                {/* @ts-ignore */}
                                <tc-table ref={clickRef} hoverable></tc-table>
                            </SectionCard>

                            <SectionCard title="Empty state">
                                {/* @ts-ignore */}
                                <tc-table ref={emptyRef} empty-message="No contributors yet"></tc-table>
                            </SectionCard>

                            <SectionCard title="Loading skeleton">
                                {/* @ts-ignore */}
                                <tc-table ref={loadingRef} loading loading-rows="4"></tc-table>
                            </SectionCard>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default TableDemo
