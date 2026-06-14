import React, { useEffect, useRef } from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const FeatureMatrixDemo: React.FC = () => {
    const fullRef = useRef<any>(null)
    const partialRef = useRef<any>(null)
    const slottedRef = useRef<any>(null)

    useEffect(() => {
        if (!fullRef.current) return
        fullRef.current.columns = [
            { id: 'free', label: 'Free' },
            { id: 'pro', label: 'Pro', highlight: true },
            { id: 'enterprise', label: 'Enterprise', highlight: true },
        ]
        fullRef.current.rows = [
            {
                label: 'Custom domains',
                hint: 'Bring your own domain',
                values: { free: false, pro: true, enterprise: true },
            },
            {
                label: 'Analytics',
                hint: 'Traffic & engagement metrics',
                values: { free: 'partial', pro: true, enterprise: true },
            },
            {
                label: 'API access',
                values: { free: false, pro: true, enterprise: true },
            },
            {
                label: 'SSO / SAML',
                hint: 'Single sign-on support',
                values: { free: false, pro: false, enterprise: true },
            },
            {
                label: 'SLA uptime',
                values: { free: '99.5%', pro: '99.9%', enterprise: '99.99%' },
            },
            {
                label: 'Priority support',
                values: { free: false, pro: 'partial', enterprise: true },
            },
        ]
    }, [])

    useEffect(() => {
        if (!partialRef.current) return
        partialRef.current.columns = [
            { id: 'basic', label: 'Basic' },
            { id: 'standard', label: 'Standard', highlight: true },
            { id: 'advanced', label: 'Advanced' },
        ]
        partialRef.current.rows = [
            { label: 'Storage', values: { basic: '5 GB', standard: '50 GB', advanced: 'Unlimited' } },
            { label: 'Collaboration', values: { basic: false, standard: true, advanced: true } },
            { label: 'Audit log', values: { basic: false, standard: 'partial', advanced: true } },
        ]
    }, [])

    useEffect(() => {
        if (!slottedRef.current) return
        slottedRef.current.columns = [
            { id: 'oss', label: 'Open Source' },
            { id: 'cloud', label: 'Cloud', highlight: true },
        ]
        slottedRef.current.rows = [
            { label: 'Self-hosted', values: { oss: true, cloud: false } },
            { label: 'Managed updates', values: { oss: false, cloud: true } },
            { label: 'Plugin support', values: { oss: true, cloud: 'partial' } },
        ]
    }, [])

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <RichPageHeader
                            chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                            title="FeatureMatrix"
                            description="Comparison table of features vs columns supporting boolean, partial, and custom values with highlight column bands."
                        />

                        <div className="d-flex flex-column gap-4 mt-4">
                            <SectionCard title="Full matrix — boolean / partial / custom values + title">
                                {/* @ts-ignore */}
                                <tc-feature-matrix
                                    ref={fullRef}
                                    title="Plan Comparison"
                                />
                            </SectionCard>

                            <SectionCard title="Compact matrix — highlighted standard column">
                                {/* @ts-ignore */}
                                <tc-feature-matrix ref={partialRef} title="Feature Overview" />
                            </SectionCard>

                            <SectionCard title="Slotted title">
                                {/* @ts-ignore */}
                                <tc-feature-matrix ref={slottedRef}>
                                    <span slot="title">
                                        <strong>Open Source</strong> vs Cloud
                                    </span>
                                </tc-feature-matrix>
                            </SectionCard>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default FeatureMatrixDemo
