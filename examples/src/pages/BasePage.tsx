import { Breadcrumbs, CategorySection, ExampleGrid, InstallBlock, PackageIntro, SkillInstall } from './_chrome'
import { baseExamples, baseCategories } from '../base/index'

export const BasePage = () => {
    return (
        <main className="site-container">
            <Breadcrumbs current="@toolcase/base" />
            <PackageIntro
                meta={{
                    pkg: '@toolcase/base',
                    name: 'base',
                    eyebrow: 'Library · Foundation',
                    tagline:
                        'Foundational primitives — events, state, data structures, generation, validation, color utilities — that every other toolcase package depends on. Zero dependencies.',
                    version: '3.0.2',
                    examples: baseExamples.length,
                    chips: ['TypeScript', 'Zero deps', 'Tree-shakeable', 'Browser + Node'],
                }}
            />
            <InstallBlock pkg="@toolcase/base" />
            <SkillInstall slug="base" pkg="@toolcase/base" />

            {baseCategories.map((category) => {
                const items = baseExamples.filter((e) => e.category === category)
                if (items.length === 0) return null
                return (
                    <CategorySection key={category} title={category} count={items.length}>
                        <ExampleGrid
                            basePath="/base"
                            items={items.map((e) => ({ key: e.key, label: e.label }))}
                        />
                    </CategorySection>
                )
            })}
        </main>
    )
}
