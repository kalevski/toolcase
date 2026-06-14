import React, { useEffect, useRef } from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const CompatibilityMatrixDemo: React.FC = () => {
    const fullRef = useRef<any>(null)
    const partialRef = useRef<any>(null)
    const minimalRef = useRef<any>(null)

    useEffect(() => {
        if (!fullRef.current) return
        fullRef.current.versions = ['v1.0', 'v2.0', 'v3.0', 'v4.0']
        fullRef.current.platforms = ['Chrome', 'Firefox', 'Safari', 'Node.js']
        fullRef.current.support = {
            'v1.0': { Chrome: 'yes', Firefox: 'yes', Safari: 'partial', 'Node.js': 'no' },
            'v2.0': { Chrome: 'yes', Firefox: 'yes', Safari: 'yes', 'Node.js': 'partial' },
            'v3.0': { Chrome: 'yes', Firefox: 'yes', Safari: 'yes', 'Node.js': 'yes' },
            'v4.0': { Chrome: 'yes', Firefox: 'partial', Safari: 'unknown', 'Node.js': 'yes' },
        }
    }, [])

    useEffect(() => {
        if (!partialRef.current) return
        partialRef.current.versions = ['v0.8', 'v0.9', 'v1.0']
        partialRef.current.platforms = ['Windows', 'macOS', 'Linux', 'iOS', 'Android']
        partialRef.current.support = {
            'v0.8': { Windows: 'yes', macOS: 'partial', Linux: 'no', iOS: 'no', Android: 'unknown' },
            'v0.9': { Windows: 'yes', macOS: 'yes', Linux: 'partial', iOS: 'no', Android: 'no' },
            'v1.0': { Windows: 'yes', macOS: 'yes', Linux: 'yes', iOS: 'partial', Android: 'partial' },
        }
    }, [])

    useEffect(() => {
        if (!minimalRef.current) return
        minimalRef.current.versions = ['stable', 'beta']
        minimalRef.current.platforms = ['x86', 'arm64']
        minimalRef.current.support = {
            stable: { x86: 'yes', arm64: 'yes' },
            beta:   { x86: 'yes', arm64: 'partial' },
        }
    }, [])

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <RichPageHeader
                            chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                            title="CompatibilityMatrix"
                            description="Matrix table showing compatibility status across versions and platforms with icons and legend."
                        />

                        <div className="d-flex flex-column gap-4 mt-4">
                            <SectionCard title="Full matrix — all four statuses (with title)">
                                {/* @ts-ignore */}
                                <tc-compatibility-matrix
                                    ref={fullRef}
                                    title="Browser & Runtime Compatibility"
                                />
                            </SectionCard>

                            <SectionCard title="Platform matrix — partial/unknown statuses">
                                {/* @ts-ignore */}
                                <tc-compatibility-matrix
                                    ref={partialRef}
                                    title="Platform Support Matrix"
                                />
                            </SectionCard>

                            <SectionCard title="Minimal — no title">
                                {/* @ts-ignore */}
                                <tc-compatibility-matrix ref={minimalRef} />
                            </SectionCard>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default CompatibilityMatrixDemo
