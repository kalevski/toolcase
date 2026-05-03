import { useNavigate } from 'react-router'
import { Badge, Button, Icon, InstallTabs, RichPageHeader, SectionCard } from '@toolcase/react-components'
import { serializerExamples } from '../serializer/index'

export const SerializerPage = () => {
    const navigate = useNavigate()

    return (
        <div className="container py-5">
            <RichPageHeader
                icon={{ name: 'box-seam', color: 'amber' }}
                title="@toolcase/serializer"
                sub="Protobuf-based binary serializer"
                description="Compact binary encoding with schema-driven (de)serialization. Fast under load."
                chips={
                    <>
                        <Badge variant="secondary">Binary</Badge>
                        <Badge variant="secondary">Protobuf</Badge>
                        <Badge variant="secondary">Compact</Badge>
                    </>
                }
            />
            <div className="mb-4">
                <SectionCard title="Install" icon="download">
                    <InstallTabs package="@toolcase/serializer" />
                </SectionCard>
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
