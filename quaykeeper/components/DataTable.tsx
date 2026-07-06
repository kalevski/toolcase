'use client'

// Relocation-safe `tc-table` wrapper (P1). The admin/routing surfaces used to
// hand-roll their structured rows as raw `<ul class="quaykeeper-admin-list">` because
// slot-moving custom elements fight React reconciliation. `tc-table` is the SAFE
// class of component for this: it renders its ENTIRE table (thead + tbody) from
// its own `columns` + `data` *properties* — it never captures or relocates React
// children — so there is no reconciliation hazard.
//
//   • `columns`/`data` are set as element properties through `useTc` (JSX can only
//     stringify them). Memoise both at the call site so identity changes only when
//     the data does.
//   • A column's `render(row)` returns an HTML *string* (not React), so any user
//     data interpolated into it MUST be escaped with `escapeHtml` (from `@/lib/tc`).
//     Columns without a `render` have their raw value auto-escaped by tc-table.
//   • Row-action controls live inside the rendered HTML as plain `<button>`s
//     carrying `data-*` attributes; clicks are caught by one delegated listener on
//     the table host and routed back through `onAction` — the same pattern the
//     existing `/admin/sites` `tc-advanced-table` already uses.

import { useCallback, useMemo } from 'react'
import type { TableColumn } from '@toolcase/web-components'
import { useTc } from '@/lib/tc'

export interface DataTableProps<T extends Record<string, unknown>> {
    columns: TableColumn[]
    rows: T[]
    /** Stable per-row key (falls back to the row index). */
    rowKey?: (row: T, index: number) => string | number
    emptyMessage?: string
    striped?: boolean
    hoverable?: boolean
    compact?: boolean
    /**
     * Delegated handler for a row-action `<button>` (or any element) carrying a
     * `data-action` attribute. Receives the action name plus the element's full
     * dataset, so a render callback can stash ids/labels on `data-*` attributes.
     */
    onAction?: (action: string, dataset: DOMStringMap, event: Event) => void
    className?: string
}

export function DataTable<T extends Record<string, unknown>>({
    columns,
    rows,
    rowKey,
    emptyMessage = 'Nothing here yet.',
    striped = true,
    hoverable,
    compact = true,
    onAction,
    className,
}: DataTableProps<T>) {
    // Catch clicks (buttons/links) and changes (selects) on any rendered control
    // carrying `data-action` and route them back to the caller (the controls live
    // in the tc-table-generated HTML, so a host-level delegated listener is the
    // only way to reach them).
    const onDelegated = useCallback(
        (event: Event) => {
            if (!onAction) return
            const el = (event.target as HTMLElement)?.closest?.('[data-action]') as HTMLElement | null
            if (!el) return
            const action = el.getAttribute('data-action')
            if (action) onAction(action, el.dataset, event)
        },
        [onAction],
    )

    const props = useMemo(
        () => ({
            columns,
            data: rows,
            emptyMessage,
            ...(rowKey ? { rowKey } : {}),
        }),
        [columns, rows, emptyMessage, rowKey],
    )
    const ref = useTc<HTMLElement>(props, { click: onDelegated, change: onDelegated })

    return (
        <tc-table
            ref={ref}
            striped={striped || undefined}
            hoverable={hoverable || undefined}
            compact={compact || undefined}
            className={className}
        />
    )
}
