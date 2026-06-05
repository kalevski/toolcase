import { Breadcrumbs, CategorySection, ExampleGrid, InstallBlock, PackageIntro, SkillInstall } from './_chrome'
import { serializerExamples } from '../serializer/index'
import { versions } from '../versions'

export const SerializerPage = () => {
    return (
        <main className="site-container">
            <Breadcrumbs current="@toolcase/serializer" />
            <PackageIntro
                meta={{
                    pkg: '@toolcase/serializer',
                    name: 'serializer',
                    eyebrow: 'Library · Data',
                    tagline:
                        'Protobuf-based binary serializer — compact encoding with schema-driven (de)serialization. Fast under load.',
                    version: versions.serializer,
                    examples: serializerExamples.length,
                    chips: ['Binary', 'Protobuf', 'Compact'],
                }}
            />
            <InstallBlock pkg="@toolcase/serializer" />
            <SkillInstall slug="serializer" pkg="@toolcase/serializer" />

            <CategorySection title="Examples" count={serializerExamples.length}>
                <ExampleGrid
                    basePath="/serializer"
                    items={serializerExamples.map((e) => ({ key: e.key, label: e.label }))}
                />
            </CategorySection>
        </main>
    )
}
