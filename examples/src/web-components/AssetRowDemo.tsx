import React, { useEffect, useRef } from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const AssetRowDemo: React.FC = () => {
    const withTagsRef = useRef<any>(null)
    const multiTagsRef = useRef<any>(null)

    useEffect(() => {
        if (!withTagsRef.current) return
        withTagsRef.current.tags = ['v1.2.0', 'stable']
    }, [])

    useEffect(() => {
        if (!multiTagsRef.current) return
        multiTagsRef.current.tags = ['ts', 'esm', 'minified']
    }, [])

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <RichPageHeader
                            chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                            title="AssetRow"
                            description="A single row displaying an asset with leading icon, name, optional tags, and trailing size. Set tags via the tags JS property. Non-interactive; dispatches no events."
                        />

                        <div className="d-flex flex-column gap-4 mt-4">
                            <SectionCard title="Icon + name + size (all attributes)">
                                <div style={{ border: '1px solid var(--tc-border)' }}>
                                    {/* @ts-ignore */}
                                    <tc-asset-row icon="FileText" name="README.md" size="4.2 KB" />
                                    {/* @ts-ignore */}
                                    <tc-asset-row icon="Image" name="logo.png" size="18 KB" />
                                    {/* @ts-ignore */}
                                    <tc-asset-row icon="FileCode" name="index.ts" size="2.1 KB" />
                                </div>
                            </SectionCard>

                            <SectionCard title="With tags (set via JS property)">
                                <div style={{ border: '1px solid var(--tc-border)' }}>
                                    {/* @ts-ignore */}
                                    <tc-asset-row ref={withTagsRef} icon="Package" name="@toolcase/base" size="12 KB" />
                                    {/* @ts-ignore */}
                                    <tc-asset-row ref={multiTagsRef} icon="Box" name="bundle.min.js" size="48 KB" />
                                </div>
                            </SectionCard>

                            <SectionCard title="Slotted icon and name">
                                <div style={{ border: '1px solid var(--tc-border)' }}>
                                    {/* @ts-ignore */}
                                    <tc-asset-row size="8 KB">
                                        <span slot="icon" style={{ color: 'var(--tc-text-muted)', display: 'inline-flex' }}>
                                            <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                                                <polyline points="14 2 14 8 20 8" />
                                            </svg>
                                        </span>
                                        <span slot="name" style={{ fontStyle: 'italic' }}>custom-name.json</span>
                                        {/* @ts-ignore */}
                                    </tc-asset-row>
                                    {/* @ts-ignore */}
                                    <tc-asset-row icon="Music" name="track.mp3" size="3.8 MB" />
                                </div>
                            </SectionCard>

                            <SectionCard title="No icon">
                                <div style={{ border: '1px solid var(--tc-border)' }}>
                                    {/* @ts-ignore */}
                                    <tc-asset-row name="plain-file.txt" size="512 B" />
                                    {/* @ts-ignore */}
                                    <tc-asset-row name="notes.md" size="1.1 KB" />
                                </div>
                            </SectionCard>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default AssetRowDemo
