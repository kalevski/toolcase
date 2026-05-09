import { Breadcrumbs, CategorySection, ExampleGrid, InstallBlock, PackageIntro, SkillInstall } from './_chrome'
import { examples, categories } from '../react-components/index'

const formatLabel = (key: string) =>
    key.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')

export const ReactComponentsPage = () => {
    return (
        <main className="site-container">
            <Breadcrumbs current="@toolcase/react-components" />
            <PackageIntro
                meta={{
                    pkg: '@toolcase/react-components',
                    name: 'react-components',
                    eyebrow: 'Library · UI · React',
                    tagline:
                        'React UI components built on Bootstrap 5 — typography, inputs, layout, navigation, charts, data display, marketing surfaces.',
                    version: '3.0.2',
                    examples: examples.length,
                    chips: ['React 18+', 'Bootstrap 5', 'TypeScript'],
                }}
            />
            <InstallBlock pkg="@toolcase/react-components" />
            <SkillInstall slug="react-components" pkg="@toolcase/react-components" />

            {categories.map((category) => {
                const items = examples.filter((e) => e.category === category)
                if (items.length === 0) return null
                return (
                    <CategorySection key={category} title={category} count={items.length}>
                        <ExampleGrid
                            basePath="/react-components"
                            items={items.map((e) => ({ key: e.key, label: formatLabel(e.key) }))}
                        />
                    </CategorySection>
                )
            })}
        </main>
    )
}
