import React from 'react'
import { useTc } from '@toolcase/web-components/react'

const BundleBarDemo: React.FC = () => {
    const chipsRef = useTc<HTMLElement>({
        chips: [
            { label: 'main', value: '2.4 MB' },
            { label: 'vendor', value: '1.1 MB' },
            { label: 'lazy', value: '320 KB' },
        ],
    })
    const statusRef = useTc<HTMLElement>({
        chips: [
            { label: 'passed', value: '142', color: '#16a34a' },
            { label: 'failed', value: '3', color: '#dc2626' },
            { label: 'skipped', value: '8' },
        ],
    })

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="BundleBar"
                            description="Segmented progress bar for build / bundle visualisation. Supports a name + meta header, a discrete segment track, and chip labels via the chips JS property."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Web Components
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-4 mt-4">
                            <tc-section-card title="Fill ratios">
                                <div className="d-flex flex-column gap-3">
                                    {/* @ts-ignore */}
                                    <tc-bundle-bar
                                        segments="10"
                                        filled-segments="0"
                                        name="Empty bundle"
                                        meta="0 / 10"
                                    ></tc-bundle-bar>
                                    {/* @ts-ignore */}
                                    <tc-bundle-bar
                                        segments="10"
                                        filled-segments="4"
                                        name="Partial build"
                                        meta="4 / 10"
                                    ></tc-bundle-bar>
                                    {/* @ts-ignore */}
                                    <tc-bundle-bar
                                        segments="10"
                                        filled-segments="10"
                                        name="Complete bundle"
                                        meta="10 / 10"
                                    ></tc-bundle-bar>
                                    {/* @ts-ignore */}
                                    <tc-bundle-bar
                                        segments="20"
                                        filled-segments="13"
                                        name="Build progress"
                                        meta="65%"
                                    ></tc-bundle-bar>
                                </div>
                            </tc-section-card>

                            <tc-section-card title="No header (track only)">
                                {/* @ts-ignore */}
                                <tc-bundle-bar segments="12" filled-segments="9"></tc-bundle-bar>
                            </tc-section-card>

                            <tc-section-card title="With chips (bundle sizes via JS property)">
                                {/* @ts-ignore */}
                                <tc-bundle-bar
                                    ref={chipsRef}
                                    segments="10"
                                    filled-segments="7"
                                    name="dist/app"
                                    meta="3.8 MB"
                                ></tc-bundle-bar>
                            </tc-section-card>

                            <tc-section-card title="With chips (test results, coloured accents)">
                                {/* @ts-ignore */}
                                <tc-bundle-bar
                                    ref={statusRef}
                                    segments="15"
                                    filled-segments="14"
                                    name="Test suite"
                                    meta="142 / 153"
                                ></tc-bundle-bar>
                            </tc-section-card>

                            <tc-section-card title="Named slots (name + meta)">
                                {/* @ts-ignore */}
                                <tc-bundle-bar segments="8" filled-segments="5">
                                    <strong slot="name">Custom name via slot</strong>
                                    <em slot="meta">slot meta</em>
                                    {/* @ts-ignore */}
                                </tc-bundle-bar>
                            </tc-section-card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default BundleBarDemo
