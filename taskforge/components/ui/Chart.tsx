'use client'

import React, { useState } from 'react'

const PALETTE = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6']

interface TooltipState {
    cx: number
    cy: number
    text: string
}

const niceMax = (v: number): number => {
    if (v <= 0) return 10
    const e = Math.pow(10, Math.floor(Math.log10(v)))
    return Math.ceil(v / e) * e
}

const defaultFmt = (v: number): string => {
    if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
    if (v >= 1_000) return `${(v / 1_000).toFixed(1)}k`
    return String(Math.round(v))
}

// ── LineChart ─────────────────────────────────────────────────────────────────

export interface LineChartPoint {
    x: string | number
    y: number
}

export interface LineChartSeries {
    label: string
    data: LineChartPoint[]
    color?: string
}

export interface LineChartProps {
    series: LineChartSeries[]
    title?: string
    subtitle?: string
    height?: number
    showGrid?: boolean
    showLegend?: boolean
    xFormatter?: (v: string | number) => string
    yFormatter?: (v: number) => string
    loading?: boolean
    className?: string
}

export const LineChart: React.FC<LineChartProps> = ({
    series,
    title,
    subtitle,
    height = 260,
    showGrid = true,
    showLegend = true,
    xFormatter,
    yFormatter,
    className = '',
}) => {
    const [tooltip, setTooltip] = useState<TooltipState | null>(null)
    const fmt = yFormatter ?? defaultFmt

    if (!series?.length) {
        return (
            <div className={`component component-chart component-chart__inner--line${className ? ` ${className}` : ''}`}>
                {(title || subtitle) && (
                    <div className="component-chart__header">
                        {title && <div className="component-chart__title">{title}</div>}
                        {subtitle && <div className="component-chart__subtitle">{subtitle}</div>}
                    </div>
                )}
                <div className="component-chart__empty">No data</div>
            </div>
        )
    }

    const allX = Array.from(new Set(series.flatMap((s) => s.data.map((p) => String(p.x)))))
    const allYVals = series.flatMap((s) => s.data.map((p) => p.y))
    const yMax = niceMax(Math.max(...allYVals) * 1.05)

    const VW = 560,
        VH = height
    const PL = 52,
        PR = 20,
        PT = 18,
        PB = 40
    const cW = VW - PL - PR
    const cH = VH - PT - PB

    const YTICKS = 5
    const yTicks = Array.from({ length: YTICKS + 1 }, (_, i) => (yMax / YTICKS) * i)

    const xPos = (xVal: string | number): number => {
        const idx = allX.indexOf(String(xVal))
        if (allX.length <= 1) return PL + cW / 2
        return PL + (idx / (allX.length - 1)) * cW
    }
    const yPos = (yVal: number): number => PT + cH - (yVal / yMax) * cH

    return (
        <div className={`component component-chart component-chart__inner--line${className ? ` ${className}` : ''}`}>
            {(title || subtitle) && (
                <div className="component-chart__header">
                    {title && <div className="component-chart__title">{title}</div>}
                    {subtitle && <div className="component-chart__subtitle">{subtitle}</div>}
                </div>
            )}
            <svg
                viewBox={`0 0 ${VW} ${VH}`}
                width="100%"
                height={VH}
                aria-label={title ?? 'Line chart'}
                onMouseLeave={() => setTooltip(null)}
            >
                {showGrid &&
                    yTicks.map((t, i) => {
                        const y = yPos(t)
                        return (
                            <g key={i}>
                                <line
                                    x1={PL}
                                    y1={y}
                                    x2={PL + cW}
                                    y2={y}
                                    stroke="var(--tc-chart-grid, #e2e8f0)"
                                    strokeWidth="1"
                                />
                                <text
                                    x={PL - 6}
                                    y={y + 4}
                                    textAnchor="end"
                                    fontSize="11"
                                    fill="var(--tc-chart-axis, #94a3b8)"
                                >
                                    {fmt(t)}
                                </text>
                            </g>
                        )
                    })}
                {allX.map((x, i) => {
                    const skip = Math.ceil(allX.length / 10)
                    if (i % skip !== 0 && i !== allX.length - 1) return null
                    return (
                        <text
                            key={i}
                            x={xPos(x)}
                            y={PT + cH + 18}
                            textAnchor="middle"
                            fontSize="11"
                            fill="var(--tc-chart-label, #64748b)"
                        >
                            {xFormatter ? xFormatter(x) : x}
                        </text>
                    )
                })}
                <line x1={PL} y1={PT + cH} x2={PL + cW} y2={PT + cH} stroke="var(--tc-chart-axis-strong, #cbd5e1)" strokeWidth="1" />
                <line x1={PL} y1={PT} x2={PL} y2={PT + cH} stroke="var(--tc-chart-grid, #e2e8f0)" strokeWidth="1" />
                {series.map((s, si) => {
                    const color = s.color ?? PALETTE[si % PALETTE.length]
                    const pts = s.data.filter((p) => allX.includes(String(p.x)))
                    if (!pts.length) return null
                    const d = pts
                        .map((p, pi) => `${pi === 0 ? 'M' : 'L'} ${xPos(p.x).toFixed(1)} ${yPos(p.y).toFixed(1)}`)
                        .join(' ')
                    return (
                        <g key={si}>
                            <path
                                d={d}
                                fill="none"
                                stroke={color}
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                            {pts.map((p, pi) => (
                                <circle
                                    key={pi}
                                    cx={xPos(p.x)}
                                    cy={yPos(p.y)}
                                    r="3.5"
                                    fill={color}
                                    stroke="var(--tc-surface, #fff)"
                                    strokeWidth="1.5"
                                    style={{ cursor: 'pointer' }}
                                    onMouseEnter={() =>
                                        setTooltip({
                                            cx: xPos(p.x),
                                            cy: yPos(p.y) - 14,
                                            text: `${s.label}: ${fmt(p.y)}`,
                                        })
                                    }
                                />
                            ))}
                        </g>
                    )
                })}
                {tooltip && (
                    <g>
                        <rect x={tooltip.cx - 52} y={tooltip.cy - 17} width={104} height={19} rx="3" fill="#1e293b" />
                        <text x={tooltip.cx} y={tooltip.cy - 4} textAnchor="middle" fontSize="11" fill="#fff">
                            {tooltip.text}
                        </text>
                    </g>
                )}
            </svg>
            {showLegend && series.length > 1 && (
                <div className="component-chart__legend">
                    {series.map((s, si) => (
                        <div key={si} className="component-chart__legend-item">
                            <span
                                className="component-chart__legend-dot"
                                style={{ background: s.color ?? PALETTE[si % PALETTE.length] }}
                            />
                            <span>{s.label}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

// ── BarChart ─────────────────────────────────────────────────────────────────

export interface BarChartDataItem {
    label: string
    value: number
    color?: string
}

export interface BarChartProps {
    data: BarChartDataItem[]
    title?: string
    subtitle?: string
    orientation?: 'vertical' | 'horizontal'
    height?: number
    showValues?: boolean
    yFormatter?: (v: number) => string
    onClick?: (item: BarChartDataItem, index: number) => void
    loading?: boolean
    className?: string
}

export const BarChart: React.FC<BarChartProps> = ({
    data,
    title,
    subtitle,
    orientation = 'vertical',
    height = 260,
    showValues = false,
    yFormatter,
    onClick,
    className = '',
}) => {
    const [tooltip, setTooltip] = useState<TooltipState | null>(null)
    const fmt = yFormatter ?? defaultFmt

    if (!data?.length) {
        return (
            <div className={`component component-chart component-chart__inner--bar${className ? ` ${className}` : ''}`}>
                {(title || subtitle) && (
                    <div className="component-chart__header">
                        {title && <div className="component-chart__title">{title}</div>}
                        {subtitle && <div className="component-chart__subtitle">{subtitle}</div>}
                    </div>
                )}
                <div className="component-chart__empty">No data</div>
            </div>
        )
    }

    const VW = 560
    const VH = height
    const PL = 52,
        PR = 12,
        PT = 18,
        PB = 38
    const cW = VW - PL - PR
    const cH = VH - PT - PB
    const maxVal = niceMax(Math.max(...data.map((d) => d.value)))
    const TICKS = 5
    const ticks = Array.from({ length: TICKS + 1 }, (_, i) => (maxVal / TICKS) * i)

    if (orientation === 'vertical') {
        const bGroup = cW / data.length
        const bW = bGroup * 0.65
        const bOff = bGroup * 0.175

        return (
            <div className={`component component-chart component-chart__inner--bar${className ? ` ${className}` : ''}`}>
                {(title || subtitle) && (
                    <div className="component-chart__header">
                        {title && <div className="component-chart__title">{title}</div>}
                        {subtitle && <div className="component-chart__subtitle">{subtitle}</div>}
                    </div>
                )}
                <svg
                    viewBox={`0 0 ${VW} ${VH}`}
                    width="100%"
                    height={VH}
                    aria-label={title ?? 'Bar chart'}
                    onMouseLeave={() => setTooltip(null)}
                >
                    {ticks.map((t, i) => {
                        const y = PT + cH - (t / maxVal) * cH
                        return (
                            <g key={i}>
                                <line
                                    x1={PL}
                                    y1={y}
                                    x2={PL + cW}
                                    y2={y}
                                    stroke="var(--tc-chart-grid, #e2e8f0)"
                                    strokeWidth="1"
                                />
                                <text
                                    x={PL - 6}
                                    y={y + 4}
                                    textAnchor="end"
                                    fontSize="11"
                                    fill="var(--tc-chart-axis, #94a3b8)"
                                >
                                    {fmt(t)}
                                </text>
                            </g>
                        )
                    })}
                    <line x1={PL} y1={PT + cH} x2={PL + cW} y2={PT + cH} stroke="var(--tc-chart-axis-strong, #cbd5e1)" strokeWidth="1" />
                    {data.map((d, i) => {
                        const bH = (d.value / maxVal) * cH
                        const x = PL + i * bGroup + bOff
                        const y = PT + cH - bH
                        const color = d.color ?? PALETTE[i % PALETTE.length]
                        return (
                            <g
                                key={i}
                                style={{ cursor: onClick ? 'pointer' : undefined }}
                                onClick={() => onClick?.(d, i)}
                                onMouseEnter={() =>
                                    setTooltip({ cx: x + bW / 2, cy: y - 12, text: `${d.label}: ${fmt(d.value)}` })
                                }
                            >
                                <rect x={x} y={y} width={bW} height={bH} fill={color} />
                                {showValues && (
                                    <text
                                        x={x + bW / 2}
                                        y={y - 5}
                                        textAnchor="middle"
                                        fontSize="11"
                                        fill="var(--tc-chart-value, #1e293b)"
                                        fontWeight="600"
                                    >
                                        {fmt(d.value)}
                                    </text>
                                )}
                                <text
                                    x={x + bW / 2}
                                    y={PT + cH + 18}
                                    textAnchor="middle"
                                    fontSize="11"
                                    fill="var(--tc-chart-label, #64748b)"
                                >
                                    {d.label}
                                </text>
                            </g>
                        )
                    })}
                    {tooltip && (
                        <g>
                            <rect
                                x={tooltip.cx - 44}
                                y={tooltip.cy - 17}
                                width={88}
                                height={19}
                                rx="3"
                                fill="#1e293b"
                            />
                            <text x={tooltip.cx} y={tooltip.cy - 4} textAnchor="middle" fontSize="11" fill="#fff">
                                {tooltip.text}
                            </text>
                        </g>
                    )}
                </svg>
            </div>
        )
    }

    // Horizontal orientation
    const bGroup = cH / data.length
    const bH2 = bGroup * 0.65
    const bOff2 = bGroup * 0.175
    const xTicks = Array.from({ length: TICKS + 1 }, (_, i) => (maxVal / TICKS) * i)

    return (
        <div className={`component component-chart component-chart__inner--bar${className ? ` ${className}` : ''}`}>
            {(title || subtitle) && (
                <div className="component-chart__header">
                    {title && <div className="component-chart__title">{title}</div>}
                    {subtitle && <div className="component-chart__subtitle">{subtitle}</div>}
                </div>
            )}
            <svg
                viewBox={`0 0 ${VW} ${VH}`}
                width="100%"
                height={VH}
                aria-label={title ?? 'Bar chart'}
                onMouseLeave={() => setTooltip(null)}
            >
                {xTicks.map((t, i) => {
                    const x = PL + (t / maxVal) * cW
                    return (
                        <g key={i}>
                            <line
                                x1={x}
                                y1={PT}
                                x2={x}
                                y2={PT + cH}
                                stroke="var(--tc-chart-grid, #e2e8f0)"
                                strokeWidth="1"
                            />
                            <text
                                x={x}
                                y={PT + cH + 16}
                                textAnchor="middle"
                                fontSize="11"
                                fill="var(--tc-chart-axis, #94a3b8)"
                            >
                                {fmt(t)}
                            </text>
                        </g>
                    )
                })}
                <line x1={PL} y1={PT} x2={PL} y2={PT + cH} stroke="var(--tc-chart-axis-strong, #cbd5e1)" strokeWidth="1" />
                {data.map((d, i) => {
                    const bW2 = (d.value / maxVal) * cW
                    const y = PT + i * bGroup + bOff2
                    const color = d.color ?? PALETTE[i % PALETTE.length]
                    return (
                        <g
                            key={i}
                            style={{ cursor: onClick ? 'pointer' : undefined }}
                            onClick={() => onClick?.(d, i)}
                            onMouseEnter={() =>
                                setTooltip({ cx: PL + bW2 + 4, cy: y + bH2 / 2, text: `${d.label}: ${fmt(d.value)}` })
                            }
                        >
                            <rect x={PL} y={y} width={bW2} height={bH2} fill={color} />
                            {showValues && (
                                <text
                                    x={PL + bW2 + 6}
                                    y={y + bH2 / 2 + 4}
                                    fontSize="11"
                                    fill="var(--tc-chart-value, #1e293b)"
                                    fontWeight="600"
                                >
                                    {fmt(d.value)}
                                </text>
                            )}
                            <text
                                x={PL - 6}
                                y={y + bH2 / 2 + 4}
                                textAnchor="end"
                                fontSize="11"
                                fill="var(--tc-chart-label, #64748b)"
                            >
                                {d.label}
                            </text>
                        </g>
                    )
                })}
                {tooltip && (
                    <g>
                        <rect x={tooltip.cx} y={tooltip.cy - 14} width={84} height={19} rx="3" fill="#1e293b" />
                        <text x={tooltip.cx + 42} y={tooltip.cy - 1} textAnchor="middle" fontSize="11" fill="#fff">
                            {tooltip.text}
                        </text>
                    </g>
                )}
            </svg>
        </div>
    )
}
