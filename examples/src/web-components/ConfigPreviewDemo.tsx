import React, { useEffect, useRef } from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const ENTRIES_BASIC = [
    { key: 'host', value: 'db.internal', comment: 'primary database host' },
    { key: 'port', value: 5432 },
    { key: 'database', value: 'app_production' },
    { key: 'ssl', value: true },
    { key: 'pool_size', value: 10 },
    { key: 'timeout', value: null, comment: 'uses driver default' },
]

const ENTRIES_SERVICE = [
    { key: 'name', value: 'api-gateway' },
    { key: 'version', value: '2.1.0' },
    { key: 'port', value: 8080, comment: 'HTTP port' },
    { key: 'debug', value: false },
    { key: 'workers', value: 4 },
    { key: 'secret', value: null, comment: 'injected at runtime' },
]

const ConfigPreviewDemo: React.FC = () => {
    const basicRef = useRef<any>(null)
    const liveRef = useRef<any>(null)
    const slotLabelRef = useRef<any>(null)

    useEffect(() => {
        if (basicRef.current) basicRef.current.entries = ENTRIES_BASIC
    }, [])

    useEffect(() => {
        if (liveRef.current) liveRef.current.entries = ENTRIES_SERVICE
    }, [])

    useEffect(() => {
        if (slotLabelRef.current) slotLabelRef.current.entries = ENTRIES_BASIC
    }, [])

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <RichPageHeader
                            chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                            title="ConfigPreview"
                            description="JSON-like configuration preview with syntax-highlighted key-value pairs. Set entries via the JS entries property; show a live status badge with the live-label attribute or slot."
                        />

                        <div className="d-flex flex-column gap-4 mt-4">
                            <SectionCard title="Entries — string · number · boolean · null">
                                {/* @ts-ignore */}
                                <tc-config-preview ref={basicRef} />
                            </SectionCard>

                            <SectionCard title="With live-label attribute">
                                {/* @ts-ignore */}
                                <tc-config-preview ref={liveRef} live-label="Live" />
                            </SectionCard>

                            <SectionCard title="live-label via slot">
                                {/* @ts-ignore */}
                                <tc-config-preview ref={slotLabelRef}>
                                    {/* @ts-ignore */}
                                    <span slot="live-label">Connected</span>
                                    {/* @ts-ignore */}
                                </tc-config-preview>
                            </SectionCard>

                            <SectionCard title="Children-based body (custom content, no entries)">
                                {/* @ts-ignore */}
                                <tc-config-preview live-label="Custom">
                                    <span style={{ color: 'var(--tc-text-inverse)', fontFamily: 'var(--tc-font-mono)', fontSize: '0.85rem' }}>
                                        {'# Manually authored config\nregion: us-east-1\nzone:   us-east-1a'}
                                    </span>
                                    {/* @ts-ignore */}
                                </tc-config-preview>
                            </SectionCard>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default ConfigPreviewDemo
