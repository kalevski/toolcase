import React, { useEffect, useRef } from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const PipelineDemo: React.FC = () => {
    const basicRef = useRef<any>(null)
    const mixedRef = useRef<any>(null)
    const completeRef = useRef<any>(null)

    useEffect(() => {
        if (basicRef.current) {
            basicRef.current.steps = [
                { title: 'Source', state: 'complete' },
                { title: 'Build', state: 'complete' },
                { title: 'Test', state: 'live' },
                { title: 'Deploy', state: 'default' },
            ]
        }
    }, [])

    useEffect(() => {
        if (mixedRef.current) {
            mixedRef.current.steps = [
                { title: 'Validate config', state: 'complete' },
                { title: 'Provision infra', state: 'complete' },
                { title: 'Deploy service', state: 'live' },
                { title: 'Run smoke tests', state: 'default' },
                { title: 'Notify team', state: 'default' },
            ]
        }
    }, [])

    useEffect(() => {
        if (completeRef.current) {
            completeRef.current.steps = [
                { title: 'Checkout', state: 'complete' },
                { title: 'Install', state: 'complete' },
                { title: 'Lint', state: 'complete' },
                { title: 'Test', state: 'complete' },
            ]
        }
    }, [])

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <RichPageHeader
                            chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                            title="Pipeline"
                            description="Horizontal pipeline / steps visualization with numbered markers, state (default / live / complete), and hairline connectors. Set steps via the JS steps property."
                        />

                        <div className="d-flex flex-column gap-4 mt-4">
                            <SectionCard title="Build pipeline (live step)">
                                {/* @ts-ignore */}
                                <tc-pipeline ref={basicRef} />
                            </SectionCard>

                            <SectionCard title="Deployment pipeline (5 steps, live mid-way)">
                                {/* @ts-ignore */}
                                <tc-pipeline ref={mixedRef} />
                            </SectionCard>

                            <SectionCard title="All complete">
                                {/* @ts-ignore */}
                                <tc-pipeline ref={completeRef} />
                            </SectionCard>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default PipelineDemo
