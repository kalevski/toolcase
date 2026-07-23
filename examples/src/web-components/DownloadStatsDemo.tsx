import React from 'react'
import { useTc } from '@toolcase/web-components/react'

const SPARKLINE_DATA = [12, 18, 15, 24, 20, 32, 28, 40, 35, 48, 42, 55]

const DownloadStatsDemo: React.FC = () => {
    const npmRef = useTc<HTMLElement>({ sparkline: SPARKLINE_DATA })
    const pypiRef = useTc<HTMLElement>({ sparkline: [8, 10, 9, 14, 12, 18, 16, 22, 20, 28] })
    const cratesRef = useTc<HTMLElement>({ sparkline: [3, 5, 4, 7, 6, 9, 8, 12, 11, 15] })

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="DownloadStats"
                            description="Package download statistics card showing formatted weekly, monthly, and total download counts with an optional sparkline trend chart. Supports npm, PyPI, and crates.io registries."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Web Components
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-4 mt-4">
                            <tc-section-card title="npm — weekly, monthly, total with sparkline">
                                <div style={{ maxWidth: 360 }}>
                                    {/* @ts-ignore */}
                                    <tc-download-stats
                                        ref={npmRef}
                                        package-name="@toolcase/web-components"
                                        weekly="148320"
                                        monthly="612000"
                                        total="4800000"
                                        registry="npm"
                                    />
                                </div>
                            </tc-section-card>

                            <tc-section-card title="PyPI — weekly and total only">
                                <div style={{ maxWidth: 360 }}>
                                    {/* @ts-ignore */}
                                    <tc-download-stats
                                        ref={pypiRef}
                                        package-name="toolcase-sdk"
                                        weekly="9200"
                                        total="390000"
                                        registry="pypi"
                                    />
                                </div>
                            </tc-section-card>

                            <tc-section-card title="crates.io — monthly and total only">
                                <div style={{ maxWidth: 360 }}>
                                    {/* @ts-ignore */}
                                    <tc-download-stats
                                        ref={cratesRef}
                                        package-name="toolcase"
                                        monthly="4100"
                                        total="52000"
                                        registry="crates"
                                    />
                                </div>
                            </tc-section-card>

                            <tc-section-card title="Total only, no sparkline">
                                <div style={{ maxWidth: 280 }}>
                                    {/* @ts-ignore */}
                                    <tc-download-stats
                                        package-name="toolcase-base"
                                        total="1230000"
                                        registry="npm"
                                    />
                                </div>
                            </tc-section-card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default DownloadStatsDemo
