import React, { useEffect, useState } from 'react'
import type { FC, HTMLAttributes, ReactNode } from 'react'
import { Icon } from './Icon'

// ── Table ─────────────────────────────────────────────────────────────────────

export interface TableColumn<T = any> {
    key: string
    header: ReactNode
    render: (row: T, rowIndex: number) => ReactNode
    width?: string
    align?: 'left' | 'center' | 'right'
    headerAlign?: 'left' | 'center' | 'right'
    ariaSort?: 'ascending' | 'descending' | 'none'
}

export interface TableProps<T = any> extends HTMLAttributes<HTMLDivElement> {
    columns: TableColumn<T>[]
    data: T[]
    rowKey: (row: T, index: number) => string | number
    emptyMessage?: ReactNode
    striped?: boolean
    hoverable?: boolean
    compact?: boolean
    borderless?: boolean
    stickyHeader?: boolean
    onRowClick?: (row: T, index: number) => void
    loading?: boolean
    loadingRows?: number
}

export const Table: FC<TableProps> = ({
    columns,
    data,
    rowKey,
    emptyMessage,
    striped = false,
    hoverable = true,
    compact = false,
    borderless = false,
    stickyHeader = false,
    onRowClick,
    loading = false,
    loadingRows = 5,
    className,
    ...rest
}) => {
    const rootClass = [
        'component component-table',
        striped && 'component-table--striped',
        hoverable && 'component-table--hoverable',
        compact && 'component-table--compact',
        borderless && 'component-table--borderless',
        stickyHeader && 'component-table--sticky-header',
        onRowClick && 'component-table--clickable',
        className,
    ]
        .filter(Boolean)
        .join(' ')

    return (
        <div className={rootClass} {...rest}>
            <table className="component-table__table">
                <thead className="component-table__head">
                    <tr>
                        {columns.map((col) => (
                            <th
                                key={col.key}
                                className="component-table__th"
                                aria-sort={col.ariaSort}
                                style={{
                                    width: col.width,
                                    textAlign: col.headerAlign ?? col.align ?? 'left',
                                }}
                            >
                                {col.header}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody className="component-table__body">
                    {loading ? (
                        Array.from({ length: loadingRows }, (_, i) => (
                            <tr key={`skeleton-${i}`} className="component-table__row">
                                {columns.map((col) => (
                                    <td key={col.key} className="component-table__td">
                                        <span className="component-table__skeleton" />
                                    </td>
                                ))}
                            </tr>
                        ))
                    ) : data.length === 0 && emptyMessage !== undefined ? (
                        <tr>
                            <td className="component-table__empty" colSpan={columns.length}>
                                {emptyMessage}
                            </td>
                        </tr>
                    ) : (
                        data.map((row, index) => (
                            <tr
                                key={rowKey(row, index)}
                                className="component-table__row"
                                onClick={onRowClick ? () => onRowClick(row, index) : undefined}
                            >
                                {columns.map((col) => (
                                    <td
                                        key={col.key}
                                        className="component-table__td"
                                        style={{
                                            width: col.width,
                                            textAlign: col.align ?? 'left',
                                        }}
                                    >
                                        {col.render(row, index)}
                                    </td>
                                ))}
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>
    )
}

// ── TerminalWindow ───────────────────────────────────────────────────────────

export type TerminalLineKind = 'input' | 'output' | 'comment' | 'error'

export interface TerminalLine {
    kind: TerminalLineKind
    text: string
    delay?: number
}

export interface TerminalWindowProps extends React.HTMLAttributes<HTMLDivElement> {
    title?: string
    prompt?: string
    lines: TerminalLine[]
    animateTyping?: boolean
    speed?: number
}

export const TerminalWindow: React.FC<TerminalWindowProps> = ({
    title = 'Terminal',
    prompt = '$',
    lines,
    animateTyping = false,
    speed = 30,
    className = '',
    ...rest
}) => {
    const [revealed, setRevealed] = useState(animateTyping ? 0 : lines.length)

    useEffect(() => {
        if (!animateTyping) {
            setRevealed(lines.length)
            return
        }
        setRevealed(0)
        let cancelled = false
        let i = 0
        const tick = () => {
            if (cancelled) return
            i += 1
            setRevealed(i)
            if (i < lines.length) {
                const line = lines[i]
                const delay = line.delay ?? Math.max(line.text.length * speed, 200)
                setTimeout(tick, delay)
            }
        }
        const start = setTimeout(tick, 200)
        return () => {
            cancelled = true
            clearTimeout(start)
        }
    }, [animateTyping, lines, speed])

    const rootClass = `component component-terminal-window ${className}`.trim()

    return (
        <div className={rootClass} {...rest}>
            <div className="component-terminal-window__chrome">
                <span
                    className="component-terminal-window__dot component-terminal-window__dot--red"
                    aria-hidden="true"
                />
                <span
                    className="component-terminal-window__dot component-terminal-window__dot--yellow"
                    aria-hidden="true"
                />
                <span
                    className="component-terminal-window__dot component-terminal-window__dot--green"
                    aria-hidden="true"
                />
                <span className="component-terminal-window__title">{title}</span>
            </div>
            <div className="component-terminal-window__body" role="log" aria-live="polite">
                {lines.slice(0, revealed).map((line, i) => (
                    <div
                        key={i}
                        className={`component-terminal-window__line component-terminal-window__line--${line.kind}`}
                    >
                        {line.kind === 'input' && (
                            <span className="component-terminal-window__prompt">{prompt}</span>
                        )}
                        <span className="component-terminal-window__text">{line.text}</span>
                    </div>
                ))}
                {animateTyping && revealed < lines.length && (
                    <span className="component-terminal-window__cursor" aria-hidden="true" />
                )}
            </div>
        </div>
    )
}

// ── MetricGrid ───────────────────────────────────────────────────────────────

export interface MetricTileProps {
    label: string
    value: React.ReactNode
    unit?: string
    icon?: string
    hint?: React.ReactNode
    className?: string
}

export const MetricTile: React.FC<MetricTileProps> = ({ label, value, unit, icon, hint, className }) => {
    const rootClass = `component component-metric-tile ${className || ''}`.trim()
    return (
        <div className={rootClass}>
            <div className="component-metric-tile__eyebrow">
                {icon && (
                    <span className="component-metric-tile__icon">
                        <Icon name={icon} decorative />
                    </span>
                )}
                <span className="component-metric-tile__label">{label}</span>
            </div>
            <div className="component-metric-tile__value">
                <span className="component-metric-tile__number">{value}</span>
                {unit && <span className="component-metric-tile__unit">{unit}</span>}
            </div>
            {hint && <div className="component-metric-tile__hint">{hint}</div>}
        </div>
    )
}

export interface MetricGridProps {
    items?: (MetricTileProps & { key?: string })[]
    columns?: 2 | 3 | 4
    className?: string
    children?: React.ReactNode
}

export const MetricGrid: React.FC<MetricGridProps> = ({ items, columns = 3, className, children }) => {
    const rootClass =
        `component component-metric-grid component-metric-grid--cols-${columns} ${className || ''}`.trim()
    return (
        <div className={rootClass}>
            {items
                ? items.map((item, i) => {
                      const { key, ...rest } = item
                      return <MetricTile key={key ?? i} {...rest} />
                  })
                : children}
        </div>
    )
}

// ── UsageSummaryPanel ──────────────────────────────────────────────────────────

export type UsageConfig = {
    label: string
    used: number
    total: number
    measurementUnit: string
    warn?: boolean
}

export interface UsageSummaryPanelProps extends HTMLAttributes<HTMLDivElement> {
    usage: Array<UsageConfig>
    title?: string
    loading?: boolean
    loadingCount?: number
}

const clampPercentage = (value: number) => {
    if (Number.isNaN(value) || !Number.isFinite(value)) {
        return 0
    }
    return Math.max(0, Math.min(100, Math.round(value)))
}

const usageNumberFormatter = new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 1,
})

const formatUsageNumber = (value: number) => usageNumberFormatter.format(value)

export const UsageSummaryPanel: FC<UsageSummaryPanelProps> = ({
    title,
    usage = [],
    loading = false,
    className,
    ...rest
}) => {
    const rootClass = ['component component-usage-summary-panel', className].filter(Boolean).join(' ')

    return (
        <aside className={rootClass} {...rest}>
            {title && (
                <header className="component-usage-summary-panel__header">
                    <h3>{title}</h3>
                </header>
            )}

            {usage.map(({ label, used, total, measurementUnit, warn = false }, index) => {
                const percentage = clampPercentage(total > 0 ? (used / total) * 100 : 0)
                const key = `${label}-${index}`

                return (
                    <section className="component-usage-summary-panel__section" key={key}>
                        <div className="component-usage-summary-panel__label">
                            <span>{label}</span>
                            <span>
                                {formatUsageNumber(used)} {measurementUnit} / {formatUsageNumber(total)}{' '}
                                {measurementUnit}
                            </span>
                        </div>
                        <div
                            className="component-usage-summary-panel__progress"
                            role="meter"
                            aria-valuenow={percentage}
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-label={`${label} usage`}
                        >
                            <div
                                className={`component-usage-summary-panel__progress-bar${warn ? ' component-usage-summary-panel__progress-bar--warning' : ''}`}
                                style={{ width: `${percentage}%` }}
                            />
                        </div>
                    </section>
                )
            })}
        </aside>
    )
}

// ── ChipGroup ───────────────────────────────────────────────────────────────────

export interface ChipGroupItem {
    id: string
    label: React.ReactNode
    active?: boolean
    disabled?: boolean
    count?: number | string
}

export interface ChipGroupProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title' | 'onToggle'> {
    title?: React.ReactNode
    subtitle?: React.ReactNode
    items: ChipGroupItem[]
    onToggle?: (id: string) => void
    border?: boolean
}

export const ChipGroup: React.FC<ChipGroupProps> = ({
    title,
    subtitle,
    items,
    onToggle,
    border = false,
    className = '',
    ...rest
}) => {
    const rootClass = [
        'component component-chip-group',
        border ? 'component-chip-group--bordered' : '',
        className,
    ]
        .filter(Boolean)
        .join(' ')

    return (
        <div className={rootClass} {...rest}>
            {title && <h4 className="component-chip-group__title">{title}</h4>}
            {subtitle && <div className="component-chip-group__sub">{subtitle}</div>}
            <div className="component-chip-group__chips" role="group">
                {items.map((it) => {
                    const cls = [
                        'component-chip-group__chip',
                        it.active ? 'component-chip-group__chip--on' : '',
                        it.disabled ? 'component-chip-group__chip--off' : '',
                    ]
                        .filter(Boolean)
                        .join(' ')
                    const interactive = !!onToggle && !it.disabled
                    return (
                        <button
                            key={it.id}
                            type="button"
                            className={cls}
                            onClick={interactive ? () => onToggle!(it.id) : undefined}
                            disabled={it.disabled}
                            aria-pressed={it.active ?? false}
                        >
                            <span className="component-chip-group__chip-label">{it.label}</span>
                            {it.count !== undefined && (
                                <span className="component-chip-group__chip-count">×{it.count}</span>
                            )}
                        </button>
                    )
                })}
            </div>
        </div>
    )
}

// ── TabSections ───────────────────────────────────────────────────────────────

export interface TabSectionItem {
    key: string
    label: React.ReactNode
    content: React.ReactNode
    disabled?: boolean
}

export interface TabSectionsProps {
    items: TabSectionItem[]
    defaultActiveKey?: string
    activeKey?: string
    onChange?: (key: string) => void
    className?: string
    loading?: boolean
}

export const TabSections: React.FC<TabSectionsProps> = ({
    items,
    defaultActiveKey,
    activeKey: controlledKey,
    onChange,
    className = '',
}) => {
    const [internalKey, setInternalKey] = useState(defaultActiveKey || items[0]?.key || '')

    const isControlled = controlledKey !== undefined
    const activeKey = isControlled ? controlledKey : internalKey

    const handleSelect = (key: string) => {
        if (!isControlled) setInternalKey(key)
        onChange?.(key)
    }

    const activeItem = items.find((item) => item.key === activeKey)

    return (
        <div className={`component component-tab-sections${className ? ` ${className}` : ''}`}>
            <div className="component-tab-sections__header">
                <div className="component-tab-sections__tabs">
                    {items.map((item) => (
                        <button
                            key={item.key}
                            className={`component-tab-sections__tab${item.key === activeKey ? ' component-tab-sections__tab--active' : ''}${item.disabled ? ' component-tab-sections__tab--disabled' : ''}`}
                            onClick={() => handleSelect(item.key)}
                            disabled={item.disabled}
                            type="button"
                        >
                            <span className="component-tab-sections__tab-label">{item.label}</span>
                        </button>
                    ))}
                </div>
            </div>
            <div className="component-tab-sections__body">{activeItem?.content}</div>
        </div>
    )
}
