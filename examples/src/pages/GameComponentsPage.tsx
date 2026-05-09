import { Breadcrumbs, CategorySection, ExampleGrid, InstallBlock, PackageIntro, SkillInstall } from './_chrome'
import { gameComponentExamples, categories } from '../game-components/index'

const formatLabel = (key: string) =>
    key.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')

export const GameComponentsPage = () => {
    return (
        <main className="site-container">
            <Breadcrumbs current="@toolcase/game-components" />
            <PackageIntro
                meta={{
                    pkg: '@toolcase/game-components',
                    name: 'game-components',
                    eyebrow: 'Library · Games · Web Components',
                    tagline:
                        'Framework-free Web Components for fantasy game UI — panels, bars, dialogs, overlays, HUD primitives. Drop into any framework or none.',
                    version: '3.0.2',
                    examples: gameComponentExamples.length,
                    chips: ['Web Components', 'Framework-agnostic', 'Shadow DOM'],
                }}
            />
            <InstallBlock pkg="@toolcase/game-components" />
            <SkillInstall slug="game-components" pkg="@toolcase/game-components" />

            {categories.map((category) => {
                const items = gameComponentExamples.filter((e) => e.category === category)
                if (items.length === 0) return null
                return (
                    <CategorySection key={category} title={category} count={items.length}>
                        <ExampleGrid
                            basePath="/game-components"
                            items={items.map((e) => ({ key: e.key, label: formatLabel(e.key) }))}
                        />
                    </CategorySection>
                )
            })}
        </main>
    )
}
