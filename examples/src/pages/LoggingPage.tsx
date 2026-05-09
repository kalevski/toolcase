import { Breadcrumbs, CategorySection, ExampleGrid, InstallBlock, PackageIntro, SkillInstall } from './_chrome'
import { loggingExamples } from '../logging/index'

export const LoggingPage = () => {
    return (
        <main className="site-container">
            <Breadcrumbs current="@toolcase/logging" />
            <PackageIntro
                meta={{
                    pkg: '@toolcase/logging',
                    name: 'logging',
                    eyebrow: 'Library · Diagnostics',
                    tagline:
                        'Lightweight isomorphic logger — scoped loggers, custom reporters, log levels. Quiet by default, loud when you need it.',
                    version: '3.0.2',
                    examples: loggingExamples.length,
                    chips: ['Node.js', 'Browser', 'Zero deps'],
                }}
            />
            <InstallBlock pkg="@toolcase/logging" />
            <SkillInstall slug="logging" pkg="@toolcase/logging" />

            <CategorySection title="Examples" count={loggingExamples.length}>
                <ExampleGrid
                    basePath="/logging"
                    items={loggingExamples.map((e) => ({ key: e.key, label: e.label }))}
                />
            </CategorySection>
        </main>
    )
}
