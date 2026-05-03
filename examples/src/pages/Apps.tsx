import { Badge, Card, EmptyState, FeatureCard, Heading, Icon, RichPageHeader, Text } from '@toolcase/react-components'

type AppEntry = {
    name: string
    description: string
    path: string
    icon: string
}

const apps: AppEntry[] = []

export const Apps = () => {
    return (
        <div className="container py-5">
            <RichPageHeader
                icon={{ name: 'boxes', color: 'cyan' }}
                title="Apps"
                sub="Standalone applications"
                description="Apps developed inside the toolcase monorepo built on top of @toolcase packages."
                chips={<Badge variant="secondary">{apps.length} apps</Badge>}
            />
            {apps.length === 0 ? (
                <Card>
                    <EmptyState icon="boxes">
                        <Heading as="h3">No apps yet</Heading>
                        <Text as="p" variant="muted">
                            Apps developed inside the toolcase monorepo will appear here.
                        </Text>
                    </EmptyState>
                </Card>
            ) : (
                <div className="row g-3">
                    {apps.map((app) => (
                        <div key={app.name} className="col-md-6">
                            <a href={app.path} className="home-link">
                                <FeatureCard
                                    icon={<Icon name={app.icon} size={28} />}
                                    title={app.name}
                                    description={app.description}
                                />
                            </a>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
