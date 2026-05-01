import { useNavigate } from 'react-router'
import { Badge, Button, Heading, Icon, SectionCard, Text } from '@toolcase/react-components'
import { phaserExamples, phaserCategories, PhaserCategory } from '../phaser-plus/index'

const categoryIcons: Record<PhaserCategory, string> = {
    'Core': 'box-seam',
    'Layers': 'layers',
    'Features': 'puzzle',
    'Debugging': 'bug',
    'Flow': 'arrow-repeat',
    'Perspective2D': 'grid-3x3',
    'Effects': 'magic',
    'AI': 'compass',
    'Cinema': 'camera-reels',
    'Input': 'controller'
}

export const PhaserPlusPage = () => {
    const navigate = useNavigate()

    return (
        <div className="container py-5">
            <div className="mb-4">
                <Heading as="h1">@toolcase/phaser-plus</Heading>
                <Text as="p" variant="muted">
                    {phaserExamples.length} runnable Phaser scenes — Scenes, Features, Debugger, Perspective2D and Effects.
                </Text>
            </div>
            {phaserCategories.map((category) => {
                const items = phaserExamples.filter((e) => e.category === category)
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
                                            onClick={() => navigate(`/phaser-plus/${example.key}`)}
                                        >
                                            <span>{example.title}</span>
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
