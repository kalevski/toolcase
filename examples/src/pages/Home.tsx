import { Link as RouterLink } from 'react-router'
import { FeatureCard, Hero, Icon, SectionCard, Text } from '@toolcase/react-components'

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
        description: '180+ React UI components built on Bootstrap 5',
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
        description: 'Web Components for game UIs and effects, built with Lit',
        path: '/game-components',
        icon: 'puzzle',
    },
]

export const Home = () => {
    return (
        <div>
            <div id="packages" className="container py-5">
                <SectionCard title="Packages" icon="boxes">
                    <div className="row g-3">
                        {packages.map((pkg) => (
                            <div key={pkg.name} className="col-md-4">
                                <RouterLink to={pkg.path} className="home-link">
                                    <FeatureCard
                                        icon={<Icon name={pkg.icon} size={28} />}
                                        title={pkg.name}
                                        description={pkg.description}
                                    />
                                </RouterLink>
                            </div>
                        ))}
                    </div>
                </SectionCard>
            </div>
        </div>
    )
}
