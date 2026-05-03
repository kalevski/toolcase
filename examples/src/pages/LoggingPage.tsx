import { useNavigate } from 'react-router'
import { Badge, Button, Heading, Icon, SectionCard, Text } from '@toolcase/react-components'
import { loggingExamples } from '../logging/index'

export const LoggingPage = () => {
    const navigate = useNavigate()

    return (
        <div className="container py-5">
            <div className="mb-4">
                <Heading as="h1">@toolcase/logging</Heading>
                <Text as="p" variant="muted">
                    Lightweight logger for Node.js and Browser — zero dependencies
                </Text>
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
