import { useNavigate } from 'react-router'
import { Badge, Button, Heading, Icon, SectionCard, Text } from '@toolcase/react-components'
import { gameComponentCategories, gameComponentExamples, type GameComponentCategory } from './index'

const categoryIcons: Record<GameComponentCategory, string> = {
    'Layout': 'columns-gap',
    'Inputs': 'input-cursor-text',
    'HUD — Resource Bars': 'battery-half',
    'HUD — Combat': 'bullseye',
    'HUD — Navigation': 'compass',
    'HUD — Skills': 'stars',
    'HUD — Display': 'display',
    'HUD — Communications': 'chat-right-text',
}

const formatLabel = (key: string) => key.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')

export const GameComponentsPage = () => {
    const navigate = useNavigate()

    return (
        <div className="container py-5">
            <div className="mb-4">
                <Heading as="h1">Game Components</Heading>
                <Text as="p" variant="muted">{gameComponentExamples.length} components</Text>
                <Text as="p" variant="muted">
                    Web Component demos powered by <code>@toolcase/game-components</code>. Each component has its own page,
                    with keyboard navigation using <code>←</code> and <code>→</code>.
                </Text>
            </div>

            {gameComponentCategories.map((category) => {
                const items = gameComponentExamples.filter((example) => example.category === category)
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
                                            onClick={() => navigate(`/game-components/${example.key}`)}
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
