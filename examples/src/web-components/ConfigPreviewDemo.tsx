import React, { useEffect, useRef } from 'react'

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
                        <tc-rich-page-header
                            title-text="ConfigPreview"
                            description="JSON-like configuration preview with syntax-highlighted key-value pairs. Set entries via the JS entries property; show a live status badge with the live-label attribute or slot."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Web Components
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-4 mt-4">
                            <tc-section-card title="Entries — string · number · boolean · null">
                                {/* @ts-ignore */}
                                <tc-config-preview ref={basicRef} />
                            </tc-section-card>

                            <tc-section-card title="With live-label attribute">
                                {/* @ts-ignore */}
                                <tc-config-preview ref={liveRef} live-label="Live" />
                            </tc-section-card>

                            <tc-section-card title="live-label via slot">
                                {/* @ts-ignore */}
                                <tc-config-preview ref={slotLabelRef}>
                                    {/* @ts-ignore */}
                                    <span slot="live-label">Connected</span>
                                    {/* @ts-ignore */}
                                </tc-config-preview>
                            </tc-section-card>

                            <tc-section-card title="Children-based body (custom content, no entries)">
                                {/* @ts-ignore */}
                                <tc-config-preview live-label="Custom">
                                    <span
                                        style={{
                                            color: 'var(--tc-text-inverse)',
                                            fontFamily: 'var(--tc-font-mono)',
                                            fontSize: '0.85rem',
                                        }}
                                    >
                                        {
                                            '# Manually authored config\nregion: us-east-1\nzone:   us-east-1a'
                                        }
                                    </span>
                                    {/* @ts-ignore */}
                                </tc-config-preview>
                            </tc-section-card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default ConfigPreviewDemo
