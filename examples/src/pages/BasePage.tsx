import { useNavigate } from 'react-router'
import { Badge, Button, Heading, Icon, SectionCard, Text } from '@toolcase/react-components'
import { baseExamples, baseCategories, type BaseCategory } from '../base/index'

const categoryIcons: Record<BaseCategory, string> = {
    'Events & State': 'broadcast',
    'Data Structures': 'diagram-3',
    'Generation & Validation': 'gear',
    'Utilities & Colors': 'palette',
}

export const BasePage = () => {
    const navigate = useNavigate()

    return (
        <div className="container py-5">
            <div className="mb-4">
                <Heading as="h1">@toolcase/base</Heading>
                <Text as="p" variant="muted">
                    {baseExamples.length} helpers and data structures — zero dependencies
                </Text>
            </div>
            {baseCategories.map((category) => {
                const items = baseExamples.filter((e) => e.category === category)
                if (items.length === 0) return null
                return (
                    <div key={category} className="mb-4">
                        <SectionCard
                            title={category}
                            icon={categoryIcons[category]}
                            action={<Badge variant="secondary">{items.length}</Badge>}
                        >
                            <div className="row g-2">
                                {items.map((example) => (
                                    <div key={example.key} className="col-sm-6 col-lg-4">
                                        <Button
                                            variant="secondary"
                                            outline
                                            className="w-100 d-flex align-items-center justify-content-between"
                                            onClick={() => navigate(`/base/${example.key}`)}
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
            })}
        </div>
    )
}
