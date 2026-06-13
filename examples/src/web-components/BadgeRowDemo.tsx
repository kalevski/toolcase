import React, { useEffect, useRef } from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const BadgeRowDemo: React.FC = () => {
    const labelOnlyRef = useRef<any>(null)
    const mdRef = useRef<any>(null)
    const smRef = useRef<any>(null)
    const variantRef = useRef<any>(null)
    const colorRef = useRef<any>(null)

    useEffect(() => {
        if (labelOnlyRef.current) {
            labelOnlyRef.current.badges = [
                { label: 'Region' },
                { label: 'Production' },
                { label: 'v2' },
            ]
        }
    }, [])

    useEffect(() => {
        if (mdRef.current) {
            mdRef.current.badges = [
                { label: 'env', value: 'production' },
                { label: 'region', value: 'eu-west-1' },
                { label: 'replicas', value: 3 },
                { label: 'uptime', value: '99.97%' },
            ]
        }
    }, [])

    useEffect(() => {
        if (smRef.current) {
            smRef.current.badges = [
                { label: 'env', value: 'staging' },
                { label: 'region', value: 'us-east-1' },
                { label: 'replicas', value: 2 },
            ]
        }
    }, [])

    useEffect(() => {
        if (variantRef.current) {
            variantRef.current.badges = [
                { label: 'status', value: 'healthy', variant: 'success' },
                { label: 'status', value: 'degraded', variant: 'warning' },
                { label: 'status', value: 'down', variant: 'danger' },
                { label: 'tier', value: 'info', variant: 'info' },
                { label: 'type', value: 'primary', variant: 'primary' },
            ]
        }
    }, [])

    useEffect(() => {
        if (colorRef.current) {
            colorRef.current.badges = [
                { label: 'team', value: 'frontend', color: '#6366f1' },
                { label: 'team', value: 'backend', color: '#0ea5e9' },
                { label: 'team', value: 'infra', color: '#f59e0b' },
            ]
        }
    }, [])

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <RichPageHeader
                            chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                            title="BadgeRow"
                            description="Horizontal row of paired key/value chips with sharp corners, slate neutrals, and monospaced values. Set badges via the JS badges property."
                        />

                        <div className="d-flex flex-column gap-4 mt-4">
                            <SectionCard title="Label only">
                                {/* @ts-ignore */}
                                <tc-badge-row ref={labelOnlyRef} />
                            </SectionCard>

                            <SectionCard title="Label + value (md — default)">
                                {/* @ts-ignore */}
                                <tc-badge-row ref={mdRef} />
                            </SectionCard>

                            <SectionCard title="Label + value (sm)">
                                {/* @ts-ignore */}
                                <tc-badge-row ref={smRef} size="sm" />
                            </SectionCard>

                            <SectionCard title="Status variants">
                                {/* @ts-ignore */}
                                <tc-badge-row ref={variantRef} />
                            </SectionCard>

                            <SectionCard title="Custom color per item">
                                {/* @ts-ignore */}
                                <tc-badge-row ref={colorRef} />
                            </SectionCard>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default BadgeRowDemo
