import { Card, EmptyState, Heading, Text } from '@toolcase/react-components'

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
            <div className="mb-5">
                <Heading as="h1" gradient>Apps</Heading>
                <Text as="p" variant="muted" size="large">
                    Standalone applications built with @toolcase packages.
                </Text>
            </div>
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
                        <div key={app.name} className="col-md-6 col-lg-6">
                            <a href={app.path} className="home-link">
                                <Card>
                                    <Heading as="h3">{app.name}</Heading>
                                    <Text as="p" variant="muted">{app.description}</Text>
                                </Card>
                            </a>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
