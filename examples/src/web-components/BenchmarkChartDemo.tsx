import React, { useState } from 'react'
import { useTc } from '@toolcase/web-components/react'

const throughputBars = [
    { label: '@your/server', value: 124000, unit: 'req/s' },
    { label: 'fastify', value: 102000, unit: 'req/s' },
    { label: 'koa', value: 78000, unit: 'req/s' },
    { label: 'express', value: 41000, unit: 'req/s', baseline: true },
]

const latencyBars = [
    { label: '@your/server', value: 8, unit: 'ms' },
    { label: 'fastify', value: 11, unit: 'ms' },
    { label: 'express', value: 24, unit: 'ms' },
]

const logBars = [
    { label: 'in-memory', value: 12 },
    { label: 'redis', value: 480 },
    { label: 'postgres', value: 5200 },
    { label: 's3', value: 140000 },
]

const coloredBars = [
    { label: 'JavaScript', value: 4820, color: '#f59e0b' },
    { label: 'TypeScript', value: 3140, color: '#6366f1' },
    { label: 'Python', value: 2200, color: '#22c55e' },
    { label: 'Rust', value: 980, color: '#ef4444' },
]

const BenchmarkChartDemo: React.FC = () => {
    const [clicked, setClicked] = useState<string | null>(null)
    const throughputRef = useTc<HTMLElement>({ bars: throughputBars })
    const latencyRef = useTc<HTMLElement>({ bars: latencyBars })
    const logRef = useTc<HTMLElement>({ bars: logBars })
    const interactiveRef = useTc<HTMLElement>(
        { bars: coloredBars },
        {
            'tc-bar-click': (e: any) => setClicked(`${e.detail.bar.label} (#${e.detail.index})`),
        },
    )
    const slotRef = useTc<HTMLElement>({ bars: throughputBars })

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="BenchmarkChart"
                            description="Horizontal SVG bar chart comparing benchmark values with leader highlighting and linear/log scale. Bars are set via the `bars` JS property."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Web Components
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-4 mt-4">
                            <tc-section-card title="Throughput — higher is better (linear)">
                                {/* @ts-ignore */}
                                <tc-benchmark-chart
                                    ref={throughputRef}
                                    title="Requests per second"
                                />
                            </tc-section-card>

                            <tc-section-card title="P99 latency — lower is better">
                                {/* @ts-ignore */}
                                <tc-benchmark-chart
                                    ref={latencyRef}
                                    lower-is-better
                                    title="P99 latency"
                                />
                            </tc-section-card>

                            <tc-section-card title="Read latency — log scale (values span orders of magnitude)">
                                {/* @ts-ignore */}
                                <tc-benchmark-chart
                                    ref={logRef}
                                    scale="log"
                                    lower-is-better
                                    title="Storage read latency (µs, log scale)"
                                />
                            </tc-section-card>

                            <tc-section-card title="Per-bar colors">
                                {/* @ts-ignore */}
                                <tc-benchmark-chart
                                    ref={interactiveRef}
                                    interactive
                                    title="Lines of code by language"
                                />
                                <p className="text-muted small mt-2 mb-0">
                                    Interactive — last clicked bar:{' '}
                                    <strong>{clicked ?? 'none'}</strong>
                                </p>
                            </tc-section-card>

                            <tc-section-card title="Rich title via slot">
                                {/* @ts-ignore */}
                                <tc-benchmark-chart ref={slotRef}>
                                    <span slot="title">
                                        Requests per second <code>v2.4</code>
                                    </span>
                                </tc-benchmark-chart>
                            </tc-section-card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default BenchmarkChartDemo
