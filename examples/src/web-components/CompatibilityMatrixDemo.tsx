import React from 'react'
import { useTc } from '@toolcase/web-components/react'

const CompatibilityMatrixDemo: React.FC = () => {
    const fullRef = useTc<HTMLElement>({
        versions: ['v1.0', 'v2.0', 'v3.0', 'v4.0'],
        platforms: ['Chrome', 'Firefox', 'Safari', 'Node.js'],
        support: {
            'v1.0': { Chrome: 'yes', Firefox: 'yes', Safari: 'partial', 'Node.js': 'no' },
            'v2.0': { Chrome: 'yes', Firefox: 'yes', Safari: 'yes', 'Node.js': 'partial' },
            'v3.0': { Chrome: 'yes', Firefox: 'yes', Safari: 'yes', 'Node.js': 'yes' },
            'v4.0': { Chrome: 'yes', Firefox: 'partial', Safari: 'unknown', 'Node.js': 'yes' },
        },
    })

    const partialRef = useTc<HTMLElement>({
        versions: ['v0.8', 'v0.9', 'v1.0'],
        platforms: ['Windows', 'macOS', 'Linux', 'iOS', 'Android'],
        support: {
            'v0.8': {
                Windows: 'yes',
                macOS: 'partial',
                Linux: 'no',
                iOS: 'no',
                Android: 'unknown',
            },
            'v0.9': { Windows: 'yes', macOS: 'yes', Linux: 'partial', iOS: 'no', Android: 'no' },
            'v1.0': {
                Windows: 'yes',
                macOS: 'yes',
                Linux: 'yes',
                iOS: 'partial',
                Android: 'partial',
            },
        },
    })

    const minimalRef = useTc<HTMLElement>({
        versions: ['stable', 'beta'],
        platforms: ['x86', 'arm64'],
        support: {
            stable: { x86: 'yes', arm64: 'yes' },
            beta: { x86: 'yes', arm64: 'partial' },
        },
    })

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="CompatibilityMatrix"
                            description="Matrix table showing compatibility status across versions and platforms with icons and legend."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Web Components
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-4 mt-4">
                            <tc-section-card title="Full matrix — all four statuses (with title)">
                                {/* @ts-ignore */}
                                <tc-compatibility-matrix
                                    ref={fullRef}
                                    title="Browser & Runtime Compatibility"
                                />
                            </tc-section-card>

                            <tc-section-card title="Platform matrix — partial/unknown statuses">
                                {/* @ts-ignore */}
                                <tc-compatibility-matrix
                                    ref={partialRef}
                                    title="Platform Support Matrix"
                                />
                            </tc-section-card>

                            <tc-section-card title="Minimal — no title">
                                {/* @ts-ignore */}
                                <tc-compatibility-matrix ref={minimalRef} />
                            </tc-section-card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default CompatibilityMatrixDemo
