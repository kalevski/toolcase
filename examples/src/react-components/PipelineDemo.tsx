import React from 'react'
import {
    Icon,
    Pipeline,
    RichPageHeader,
    RichPageHeaderChip,
    SectionCard,
} from '@toolcase/react-components'

const PipelineDemo: React.FC = () => (
    <div className="container py-4">
        <div className="row">
            <div className="col-12">
                <RichPageHeader
                    chips={<RichPageHeaderChip>Data Display</RichPageHeaderChip>}
                    title="Pipeline"
                    description="Left-to-right step indicator for build/deploy stages. Each step can be default, live (running), or complete."
                />
                <div className="d-flex flex-column gap-4 mt-4">
                    <SectionCard title="Build pipeline">
                        <Pipeline
                            steps={[
                                { num: 1, title: 'Install', sub: 'deps restored', icon: <Icon name="box-seam" />, state: 'complete' },
                                { num: 2, title: 'Lint', sub: '0 errors', icon: <Icon name="check2-square" />, state: 'complete' },
                                { num: 3, title: 'Test', sub: 'running…', icon: <Icon name="play-circle" />, state: 'live' },
                                { num: 4, title: 'Build', sub: 'pending', icon: <Icon name="hammer" /> },
                                { num: 5, title: 'Deploy', sub: 'pending', icon: <Icon name="cloud-upload" /> },
                            ]}
                        />
                    </SectionCard>

                    <SectionCard title="All complete">
                        <Pipeline
                            steps={[
                                { num: 'A', title: 'Draft', state: 'complete' },
                                { num: 'B', title: 'Review', state: 'complete' },
                                { num: 'C', title: 'Published', state: 'complete' },
                            ]}
                        />
                    </SectionCard>

                    <SectionCard title="Minimal">
                        <Pipeline
                            steps={[
                                { title: 'Plan' },
                                { title: 'Build', state: 'live' },
                                { title: 'Ship' },
                            ]}
                        />
                    </SectionCard>
                </div>
            </div>
        </div>
    </div>
)

export default PipelineDemo
