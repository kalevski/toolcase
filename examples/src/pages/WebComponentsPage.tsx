import { Breadcrumbs, CategorySection, ExampleGrid, InstallBlock, PackageIntro, SkillInstall } from './_chrome'
import { webComponentExamples, complexities, type WebComponentComplexity } from '../web-components/index'
import { versions } from '../versions'

const formatLabel = (key: string) =>
    key.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')

// Demos are grouped by component complexity (derived from the source size of the
// underlying tc-* element) rather than by domain category.
const complexityBlurb: Record<WebComponentComplexity, string> = {
    Primitives: 'Atomic building blocks — single-element wrappers, layout primitives, and tiny display helpers.',
    Simple: 'Single-purpose styled components with a handful of attributes.',
    Composite: 'Multi-part components that assemble several pieces — cards, lists, rows, and richer controls.',
    Advanced: 'Complex, stateful, or data-driven components — tables, editors, charts, panels, and full screens.',
}

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

            {complexities.map((complexity) => {
                const items = webComponentExamples.filter((e) => e.complexity === complexity)
                if (items.length === 0) return null
                return (
                    <CategorySection
                        key={complexity}
                        title={complexity}
                        count={items.length}
                        subtitle={complexityBlurb[complexity]}
                    >
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
