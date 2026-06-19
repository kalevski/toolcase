import React, { useEffect, useRef } from 'react'

const AssetRowListDemo: React.FC = () => {
    const taggedRef = useRef<any>(null)
    const pkgRef = useRef<any>(null)

    useEffect(() => {
        if (!taggedRef.current) return
        taggedRef.current.tags = ['v2.1.0', 'stable']
    }, [])

    useEffect(() => {
        if (!pkgRef.current) return
        pkgRef.current.tags = ['ts', 'esm', 'minified']
    }, [])

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="AssetRowList"
                            description="A bordered container wrapping one or more tc-asset-row elements. Provides a single 1px outer hairline frame; inner row separators are provided by tc-asset-row itself, with the last row's border collapsed to avoid double-borders."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Web Components
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-4 mt-4">
                            <tc-section-card title="Basic file list">
                                {/* @ts-ignore */}
                                <tc-asset-row-list>
                                    {/* @ts-ignore */}
                                    <tc-asset-row icon="FileText" name="README.md" size="4.2 KB" />
                                    {/* @ts-ignore */}
                                    <tc-asset-row icon="Image" name="logo.png" size="18 KB" />
                                    {/* @ts-ignore */}
                                    <tc-asset-row icon="FileCode" name="index.ts" size="2.1 KB" />
                                    {/* @ts-ignore */}
                                    <tc-asset-row icon="Music" name="track.mp3" size="3.8 MB" />
                                    {/* @ts-ignore */}
                                </tc-asset-row-list>
                            </tc-section-card>

                            <tc-section-card title="Rows with tags (set via JS property)">
                                {/* @ts-ignore */}
                                <tc-asset-row-list>
                                    {/* @ts-ignore */}
                                    <tc-asset-row
                                        ref={taggedRef}
                                        icon="Package"
                                        name="@toolcase/base"
                                        size="12 KB"
                                    />
                                    {/* @ts-ignore */}
                                    <tc-asset-row
                                        ref={pkgRef}
                                        icon="Box"
                                        name="bundle.min.js"
                                        size="48 KB"
                                    />
                                    {/* @ts-ignore */}
                                    <tc-asset-row
                                        icon="Archive"
                                        name="release-1.0.0.tar.gz"
                                        size="2.3 MB"
                                    />
                                    {/* @ts-ignore */}
                                </tc-asset-row-list>
                            </tc-section-card>

                            <tc-section-card title="Single row">
                                {/* @ts-ignore */}
                                <tc-asset-row-list>
                                    {/* @ts-ignore */}
                                    <tc-asset-row icon="File" name="config.json" size="512 B" />
                                    {/* @ts-ignore */}
                                </tc-asset-row-list>
                            </tc-section-card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default AssetRowListDemo
