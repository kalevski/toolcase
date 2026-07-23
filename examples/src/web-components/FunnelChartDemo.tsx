import React, { useState } from 'react'
import { useTc } from '@toolcase/web-components/react'

const conversion = [
    { label: 'Visitors', value: 12400 },
    { label: 'Signups', value: 5600 },
    { label: 'Activated', value: 3100 },
    { label: 'Paying', value: 1450 },
    { label: 'Renewed', value: 820 },
]

const checkout = [
    { label: 'Cart', value: 4800, color: 'var(--tc-app-accent)' },
    { label: 'Shipping', value: 3600, color: 'var(--tc-slate-600)' },
    { label: 'Payment', value: 2400, color: 'var(--tc-warning)' },
    { label: 'Confirmed', value: 1900, color: 'var(--tc-success)' },
]

const FunnelChartDemo: React.FC = () => {
    const [selected, setSelected] = useState<string | null>(null)

    const mainRef = useTc<HTMLElement>(
        {
            data: conversion,
            // also exercise the onSelect callback property
            onSelect: (step: any, index: number) =>
                console.log('onSelect', step.label, step.value, index),
        },
        {
            'tc-select': (e: any) =>
                setSelected(
                    `${e.detail.step.label} = ${e.detail.step.value} (index ${e.detail.index})`,
                ),
        },
    )
    const noLabelsRef = useTc<HTMLElement>({ data: conversion })
    const coloredRef = useTc<HTMLElement>({ data: checkout })

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="FunnelChart"
                            description="SVG funnel chart visualising a conversion flow as a vertical stack of tapering trapezoids, each labelled with its stage name and its percentage of the first step. data is set via a JS property; title/subtitle/height/show-labels/loading are attributes. Hovering a segment shows a tooltip; clicking/activating one fires tc-select and calls the onSelect callback."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Web Components
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-4 mt-4">
                            <tc-section-card title="Conversion funnel — labels + click">
                                {/* @ts-ignore */}
                                <tc-funnel-chart
                                    ref={mainRef}
                                    title="Activation funnel"
                                    subtitle="Last 30 days, by stage"
                                    height="320"
                                />
                                <p className="text-muted small mt-2 mb-0">
                                    Last selected step: <strong>{selected ?? 'none'}</strong>
                                </p>
                            </tc-section-card>

                            <tc-section-card title="Labels hidden">
                                {/* @ts-ignore */}
                                <tc-funnel-chart
                                    ref={noLabelsRef}
                                    title="Activation funnel"
                                    subtitle="show-labels=false — geometry only"
                                    height="280"
                                    show-labels="false"
                                />
                            </tc-section-card>

                            <tc-section-card title="Per-step colors">
                                {/* @ts-ignore */}
                                <tc-funnel-chart
                                    ref={coloredRef}
                                    title="Checkout funnel"
                                    subtitle="Explicit status colors per step"
                                    height="260"
                                />
                            </tc-section-card>

                            <tc-section-card title="Loading skeleton">
                                {/* @ts-ignore */}
                                <tc-funnel-chart loading title="Loading…" height="280" />
                            </tc-section-card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default FunnelChartDemo
