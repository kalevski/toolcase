import React from 'react'
import { useTc } from '@toolcase/web-components/react'

const PipelineDemo: React.FC = () => {
    const basicRef = useTc<HTMLElement>({
        steps: [
            { title: 'Source', state: 'complete' },
            { title: 'Build', state: 'complete' },
            { title: 'Test', state: 'live' },
            { title: 'Deploy', state: 'default' },
        ],
    })
    const mixedRef = useTc<HTMLElement>({
        steps: [
            { title: 'Validate config', state: 'complete' },
            { title: 'Provision infra', state: 'complete' },
            { title: 'Deploy service', state: 'live' },
            { title: 'Run smoke tests', state: 'default' },
            { title: 'Notify team', state: 'default' },
        ],
    })
    const completeRef = useTc<HTMLElement>({
        steps: [
            { title: 'Checkout', state: 'complete' },
            { title: 'Install', state: 'complete' },
            { title: 'Lint', state: 'complete' },
            { title: 'Test', state: 'complete' },
        ],
    })

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="Pipeline"
                            description="Horizontal pipeline / steps visualization with numbered markers, state (default / live / complete), and hairline connectors. Set steps via the JS steps property."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Web Components
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-4 mt-4">
                            <tc-section-card title="Build pipeline (live step)">
                                {/* @ts-ignore */}
                                <tc-pipeline ref={basicRef} />
                            </tc-section-card>

                            <tc-section-card title="Deployment pipeline (5 steps, live mid-way)">
                                {/* @ts-ignore */}
                                <tc-pipeline ref={mixedRef} />
                            </tc-section-card>

                            <tc-section-card title="All complete">
                                {/* @ts-ignore */}
                                <tc-pipeline ref={completeRef} />
                            </tc-section-card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default PipelineDemo
