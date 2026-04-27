import { useNavigate } from 'react-router'
import { Badge, Button, Heading, Icon, SectionCard, Text } from '@toolcase/react-components'
import { examples, categories, ExampleCategory } from '../react-components/index'

const categoryIcons: Record<ExampleCategory, string> = {
    'Typography & Decoration': 'type',
    'Inputs & Forms': 'input-cursor-text',
    'Buttons & Actions': 'cursor-fill',
    'Layout & Structure': 'columns-gap',
    'Navigation': 'compass',
    'Overlays & Feedback': 'window-stack',
    'Data Display': 'table',
    'Charts & Metrics': 'bar-chart-line',
    'Media & Files': 'images',
    'Identity & People': 'people',
    'Marketing & Landing': 'megaphone',
    'Code & Docs': 'code-slash',
}

const formatLabel = (key: string) => {
    return key.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

export const ReactComponentsPage = () => {
    const navigate = useNavigate()

    return (
        <div className="container py-5">
            <div className="mb-4">
                <Heading as="h1">React Components</Heading>
                <Text as="p" variant="muted">{examples.length} components</Text>
            </div>
            {categories.map((category) => {
                const items = examples.filter((e) => e.category === category)
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
                                            onClick={() => navigate(`/react-components/${example.key}`)}
                                        >
                                            <span>{formatLabel(example.key)}</span>
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
