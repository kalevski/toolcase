import React, { useEffect, useRef, useState } from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const CoolButtonDemo: React.FC = () => {
    const [clicked, setClicked] = useState('')
    const loadingRef = useRef<any>(null)
    const addonLeftRef = useRef<any>(null)
    const addonRightSlotRef = useRef<any>(null)

    useEffect(() => {
        const el = loadingRef.current
        if (!el) return
        el.addEventListener('tc-click', () => setClicked('loading button clicked'))
    }, [])

    useEffect(() => {
        const el = addonLeftRef.current
        if (!el) return
        el.addEventListener('tc-click', () => setClicked('addon-left button clicked'))
    }, [])

    useEffect(() => {
        const el = addonRightSlotRef.current
        if (!el) return
        el.addEventListener('tc-click', () => setClicked('addon-right slot button clicked'))
    }, [])

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <RichPageHeader
                            chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                            title="CoolButton"
                            description="Grouped button with variants, sizes, loading state, and an optional addon region separated by a 1px divider."
                        />

                        {clicked && (
                            <div className="alert alert-info mt-3">
                                Event: <strong>{clicked}</strong>
                            </div>
                        )}

                        <div className="d-flex flex-column gap-4 mt-4">
                            <SectionCard title="Variants">
                                <div className="d-flex flex-wrap gap-2">
                                    {/* @ts-ignore */}
                                    <tc-cool-button variant="primary" label="Primary"></tc-cool-button>
                                    {/* @ts-ignore */}
                                    <tc-cool-button variant="secondary" label="Secondary"></tc-cool-button>
                                    {/* @ts-ignore */}
                                    <tc-cool-button variant="success" label="Success"></tc-cool-button>
                                    {/* @ts-ignore */}
                                    <tc-cool-button variant="danger" label="Danger"></tc-cool-button>
                                    {/* @ts-ignore */}
                                    <tc-cool-button variant="warning" label="Warning"></tc-cool-button>
                                    {/* @ts-ignore */}
                                    <tc-cool-button variant="info" label="Info"></tc-cool-button>
                                </div>
                            </SectionCard>

                            <SectionCard title="Outline variants">
                                <div className="d-flex flex-wrap gap-2">
                                    {/* @ts-ignore */}
                                    <tc-cool-button variant="primary" outline label="Primary"></tc-cool-button>
                                    {/* @ts-ignore */}
                                    <tc-cool-button variant="secondary" outline label="Secondary"></tc-cool-button>
                                    {/* @ts-ignore */}
                                    <tc-cool-button variant="success" outline label="Success"></tc-cool-button>
                                    {/* @ts-ignore */}
                                    <tc-cool-button variant="danger" outline label="Danger"></tc-cool-button>
                                    {/* @ts-ignore */}
                                    <tc-cool-button variant="warning" outline label="Warning"></tc-cool-button>
                                    {/* @ts-ignore */}
                                    <tc-cool-button variant="info" outline label="Info"></tc-cool-button>
                                </div>
                            </SectionCard>

                            <SectionCard title="Sizes">
                                <div className="d-flex flex-wrap align-items-center gap-2">
                                    {/* @ts-ignore */}
                                    <tc-cool-button variant="primary" size="small" label="Small"></tc-cool-button>
                                    {/* @ts-ignore */}
                                    <tc-cool-button variant="primary" size="default" label="Default"></tc-cool-button>
                                    {/* @ts-ignore */}
                                    <tc-cool-button variant="primary" size="large" label="Large"></tc-cool-button>
                                </div>
                            </SectionCard>

                            <SectionCard title="Loading state">
                                <div className="d-flex flex-wrap gap-2">
                                    {/* @ts-ignore */}
                                    <tc-cool-button ref={loadingRef} variant="primary" loading label="Saving…"></tc-cool-button>
                                    {/* @ts-ignore */}
                                    <tc-cool-button variant="secondary" loading label="Processing"></tc-cool-button>
                                    {/* @ts-ignore */}
                                    <tc-cool-button variant="success" outline loading label="Uploading"></tc-cool-button>
                                </div>
                            </SectionCard>

                            <SectionCard title="Disabled">
                                <div className="d-flex flex-wrap gap-2">
                                    {/* @ts-ignore */}
                                    <tc-cool-button variant="primary" disabled label="Disabled"></tc-cool-button>
                                    {/* @ts-ignore */}
                                    <tc-cool-button variant="secondary" outline disabled label="Disabled outline"></tc-cool-button>
                                </div>
                            </SectionCard>

                            <SectionCard title="Addon — attribute (right, default)">
                                <div className="d-flex flex-wrap gap-2">
                                    {/* @ts-ignore */}
                                    <tc-cool-button variant="primary" label="Deploy" addon="▶"></tc-cool-button>
                                    {/* @ts-ignore */}
                                    <tc-cool-button variant="success" label="Approve" addon="✓"></tc-cool-button>
                                    {/* @ts-ignore */}
                                    <tc-cool-button variant="secondary" outline label="Options" addon="▾"></tc-cool-button>
                                </div>
                            </SectionCard>

                            <SectionCard title="Addon — attribute (left)">
                                <div className="d-flex flex-wrap gap-2">
                                    {/* @ts-ignore */}
                                    <tc-cool-button ref={addonLeftRef} variant="primary" label="Download" addon="↓" addon-position="left"></tc-cool-button>
                                    {/* @ts-ignore */}
                                    <tc-cool-button variant="danger" label="Delete" addon="✕" addon-position="left"></tc-cool-button>
                                </div>
                            </SectionCard>

                            <SectionCard title="Addon — slot children (right)">
                                <div className="d-flex flex-wrap gap-2">
                                    {/* @ts-ignore */}
                                    <tc-cool-button ref={addonRightSlotRef} variant="primary">
                                        Publish
                                        {/* @ts-ignore */}
                                        <span slot="addon" style={{ fontSize: '0.75rem', fontWeight: 700 }}>v2</span>
                                    </tc-cool-button>
                                    {/* @ts-ignore */}
                                    <tc-cool-button variant="secondary" outline>
                                        Share
                                        {/* @ts-ignore */}
                                        <span slot="addon" style={{ fontSize: '0.8rem' }}>↗</span>
                                    </tc-cool-button>
                                </div>
                            </SectionCard>

                            <SectionCard title="Slotted label (default children)">
                                <div className="d-flex flex-wrap gap-2">
                                    {/* @ts-ignore */}
                                    <tc-cool-button variant="primary">
                                        <strong>Bold label</strong>
                                    </tc-cool-button>
                                    {/* @ts-ignore */}
                                    <tc-cool-button variant="info" outline>
                                        <em>Italic label</em>
                                    </tc-cool-button>
                                </div>
                            </SectionCard>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default CoolButtonDemo
