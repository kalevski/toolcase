import { Breadcrumbs, CategorySection, ExampleGrid, InstallBlock, PackageIntro, SkillInstall } from './_chrome'
import { webComponentExamples, categories } from '../web-components/index'
import { versions } from '../versions'

const formatLabel = (key: string) =>
    key.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')

export const WebComponentsPage = () => {
    return (
        <main className="site-container">
            <Breadcrumbs current="@toolcase/web-components" />
            <PackageIntro
                meta={{
                    pkg: '@toolcase/web-components',
                    name: 'web-components',
                    eyebrow: 'Library · UI · Web Components',
                    tagline:
                        'Framework-free HTML5 Web Components with from-scratch toolcase styling — drop into any stack without React, Vue, or Angular.',
                    version: versions['web-components'],
                    examples: webComponentExamples.length,
                    chips: ['Web Components', 'Zero CSS deps', 'Framework-agnostic'],
                }}
            />
            <InstallBlock pkg="@toolcase/web-components" />
            <SkillInstall slug="web-components" pkg="@toolcase/web-components" />

            {categories.map((category) => {
                const items = webComponentExamples.filter((e) => e.category === category)
                if (items.length === 0) return null
                return (
                    <CategorySection key={category} title={category} count={items.length}>
                        <ExampleGrid
                            basePath="/web-components"
                            items={items.map((e) => ({ key: e.key, label: formatLabel(e.key) }))}
                        />
                    </CategorySection>
                )
            })}
        </main>
    )
}
