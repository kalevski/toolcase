import { useNavigate } from 'react-router'
import { Badge, Button, Heading, Icon, SectionCard, Text } from '@toolcase/react-components'
import { serializerExamples } from '../serializer/index'

export const SerializerPage = () => {
    const navigate = useNavigate()

    return (
        <div className="container py-5">
            <div className="mb-4">
                <Heading as="h1">@toolcase/serializer</Heading>
                <Text as="p" variant="muted">
                    Protobuf-based binary serializer — compact and fast
                </Text>
            </div>
            <SectionCard
                title="Examples"
                icon="box-seam"
                action={<Badge variant="secondary">{serializerExamples.length}</Badge>}
            >
                <div className="row g-2">
                    {serializerExamples.map((example) => (
                        <div key={example.key} className="col-sm-6 col-lg-4">
                            <Button
                                variant="secondary"
                                outline
                                className="w-100 d-flex align-items-center justify-content-between"
                                onClick={() => navigate(`/serializer/${example.key}`)}
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
