import { Breadcrumbs, CategorySection, ExampleGrid, InstallBlock, PackageIntro, SkillInstall } from './_chrome'
import { phaserExamples, phaserCategories } from '../phaser-plus/index'

export const PhaserPlusPage = () => {
    return (
        <main className="site-container">
            <Breadcrumbs current="@toolcase/phaser-plus" />
            <PackageIntro
                meta={{
                    pkg: '@toolcase/phaser-plus',
                    name: 'phaser-plus',
                    eyebrow: 'Library · Games · Phaser',
                    tagline:
                        'Unified runtime for Phaser 4 — Scene lifecycle, FeatureRegistry, Flow, AI, Effects, Cinema, Input. Less boilerplate, more game.',
                    version: '3.0.2',
                    examples: phaserExamples.length,
                    chips: ['Phaser 4', 'TypeScript', 'ESM'],
                }}
            />
            <InstallBlock pkg="@toolcase/phaser-plus" />
            <SkillInstall slug="phaser-plus" pkg="@toolcase/phaser-plus" />

            {phaserCategories.map((category) => {
                const items = phaserExamples.filter((e) => e.category === category)
                if (items.length === 0) return null
                return (
                    <CategorySection key={category} title={category} count={items.length}>
                        <ExampleGrid
                            basePath="/phaser-plus"
                            items={items.map((e) => ({ key: e.key, label: e.title }))}
                        />
                    </CategorySection>
                )
            })}
        </main>
    )
}
