import { useNavigate } from 'react-router'
import { Badge, Button, Icon, InstallTabs, RichPageHeader, SectionCard } from '@toolcase/react-components'
import { loggingExamples } from '../logging/index'

export const LoggingPage = () => {
    const navigate = useNavigate()

    return (
        <div className="container py-5">
            <RichPageHeader
                icon={{ name: 'journal-text', color: 'emerald' }}
                title="@toolcase/logging"
                sub="Lightweight logger for Node.js and Browser"
                description="Scoped loggers, custom reporters, log levels — zero dependencies."
                chips={
                    <>
                        <Badge variant="secondary">Node.js</Badge>
                        <Badge variant="secondary">Browser</Badge>
                        <Badge variant="secondary">Zero deps</Badge>
                    </>
                }
            />
            <div className="mb-4">
                <SectionCard title="Install" icon="download">
                    <InstallTabs package="@toolcase/logging" />
                </SectionCard>
            </div>
            <SectionCard
                title="Examples"
                icon="journal-text"
                action={<Badge variant="secondary">{loggingExamples.length}</Badge>}
            >
                <div className="row g-2">
                    {loggingExamples.map((example) => (
                        <div key={example.key} className="col-sm-6 col-lg-4">
                            <Button
                                variant="secondary"
                                outline
                                className="w-100 d-flex align-items-center justify-content-between"
                                onClick={() => navigate(`/logging/${example.key}`)}
                            >
                                <span>{example.label}</span>
                                <Icon name="arrow-right" />
                            </Button>
                        </div>
                    ))}
                </div>
            </SectionCard>
        </div>
    )
}
