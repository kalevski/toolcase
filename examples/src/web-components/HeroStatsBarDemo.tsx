import React, { useEffect, useRef } from 'react'

const HeroStatsBarDemo: React.FC = () => {
    const basicRef = useRef<any>(null)
    const unitsRef = useRef<any>(null)
    const zeroRef = useRef<any>(null)
    const manyRef = useRef<any>(null)

    useEffect(() => {
        if (basicRef.current) {
            basicRef.current.stats = [
                { label: 'Total Users', value: 12_847 },
                { label: 'Active Today', value: 3_201 },
                { label: 'Requests', value: '1.2M' },
                { label: 'Error Rate', value: '0.04%' },
            ]
        }
    }, [])

    useEffect(() => {
        if (unitsRef.current) {
            unitsRef.current.stats = [
                { label: 'Latency (p50)', value: 42, unit: 'ms' },
                { label: 'Latency (p99)', value: 198, unit: 'ms' },
                { label: 'Throughput', value: 4.7, unit: 'k/s' },
                { label: 'Uptime', value: 99.97, unit: '%' },
            ]
        }
    }, [])

    useEffect(() => {
        if (zeroRef.current) {
            zeroRef.current.stats = [
                { label: 'Deployments', value: 7 },
                { label: 'Failures', value: 0 },
                { label: 'Rollbacks', value: '0' },
                { label: 'Alerts', value: '' },
            ]
        }
    }, [])

    useEffect(() => {
        if (manyRef.current) {
            manyRef.current.stats = [
                { label: 'Build Time', value: 83, unit: 's' },
                { label: 'Bundle Size', value: 142, unit: 'kb' },
                { label: 'Coverage', value: '91.4', unit: '%' },
                { label: 'Lint Errors', value: 0 },
                { label: 'Type Errors', value: 0 },
                { label: 'Warnings', value: 3 },
            ]
        }
    }, [])

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="HeroStatsBar"
                            description="Horizontal bar of key-value statistics with optional units and zero-state styling. Set stats via the JS stats property."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Web Components
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-4 mt-4">
                            <tc-section-card title="Basic stats">
                                {/* @ts-ignore */}
                                <tc-hero-stats-bar ref={basicRef} />
                            </tc-section-card>

                            <tc-section-card title="With units">
                                {/* @ts-ignore */}
                                <tc-hero-stats-bar ref={unitsRef} />
                            </tc-section-card>

                            <tc-section-card title="Zero-state (0, '0', empty mute the value color)">
                                {/* @ts-ignore */}
                                <tc-hero-stats-bar ref={zeroRef} />
                            </tc-section-card>

                            <tc-section-card title="Many stats">
                                {/* @ts-ignore */}
                                <tc-hero-stats-bar ref={manyRef} />
                            </tc-section-card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default HeroStatsBarDemo
