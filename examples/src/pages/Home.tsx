import { Link as RouterLink } from 'react-router'
import { Card, Heading, Icon, Text } from '@toolcase/react-components'

const packages = [
    {
        name: '@toolcase/base',
        description: 'Collection of TypeScript helper functions and data structures',
        path: '/base',
        icon: 'tools',
    },
    {
        name: '@toolcase/logging',
        description: 'Lightweight logger with scoped loggers and custom reporters',
        path: '/logging',
        icon: 'journal-text',
    },
    {
        name: '@toolcase/serializer',
        description: 'Protobuf-based binary serializer for compact encoding',
        path: '/serializer',
        icon: 'box-seam',
    },
    {
        name: '@toolcase/react-components',
        description: '81+ React UI components built on Bootstrap 5',
        path: '/react-components',
        icon: 'grid-3x3-gap',
    },
    {
        name: '@toolcase/phaser-plus',
        description: 'Unified runtime for Phaser — Scenes, Features, Debugger, Perspective2D and Effects',
        path: '/phaser-plus',
        icon: 'controller',
    },
    {
        name: '@toolcase/game-components',
        description: 'Collection of Web Components for game UIs and effects, built with Lit',
        path: '/game-components',
        icon: 'puzzle',
    },
]

export const Home = () => {
    return (
        <div className="container py-5">
            <div className="mb-5">
                <Heading as="h1" gradient>@toolcase</Heading>
                <Text as="p" variant="muted" size="large">
                    A modular TypeScript toolkit — utilities, components, and more.
                </Text>
            </div>
            <div className="row g-3">
                {packages.map((pkg) => (
                    <div key={pkg.name} className="col-md-6 col-lg-6">
                        <RouterLink to={pkg.path} className="home-link">
                            <Card>
                                <div className="d-flex align-items-start gap-3">
                                    <Icon name={pkg.icon} size={28} className="text-primary" />
                                    <div>
                                        <Heading as="h3">{pkg.name}</Heading>
                                        <Text as="p" variant="muted">{pkg.description}</Text>
                                    </div>
                                </div>
                            </Card>
                        </RouterLink>
                    </div>
                ))}
            </div>
        </div>
    )
}
