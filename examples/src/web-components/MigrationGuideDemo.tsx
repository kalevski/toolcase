import React, { useEffect, useRef } from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const MigrationGuideDemo: React.FC = () => {
    const basicRef = useRef<any>(null)
    const fullRef = useRef<any>(null)
    const titledRef = useRef<any>(null)

    useEffect(() => {
        if (basicRef.current) {
            basicRef.current.steps = [
                {
                    title: 'Update the import path',
                    description: 'The package has moved to a scoped name in v2.',
                    before: `import { Button } from 'toolcase'`,
                    after: `import { Button } from '@toolcase/react-components'`,
                },
                {
                    title: 'Replace className with variant',
                    description: 'Variant is now a first-class prop instead of a CSS class string.',
                    before: `<Button className="btn-primary">Save</Button>`,
                    after: `<Button variant="primary">Save</Button>`,
                },
            ]
        }
    }, [])

    useEffect(() => {
        if (fullRef.current) {
            fullRef.current.steps = [
                {
                    title: 'Install the new package',
                    description: 'Remove the old dependency and install the scoped package.',
                    before: `npm install toolcase-ui`,
                    after: `npm install @toolcase/react-components`,
                    language: 'bash',
                },
                {
                    title: 'Update all imports',
                    before: [
                        `import { Button } from 'toolcase-ui'`,
                        `import { Modal } from 'toolcase-ui'`,
                        `import { Alert } from 'toolcase-ui'`,
                    ].join('\n'),
                    after: [
                        `import {`,
                        `  Button,`,
                        `  Modal,`,
                        `  Alert,`,
                        `} from '@toolcase/react-components'`,
                    ].join('\n'),
                    language: 'typescript',
                },
                {
                    title: 'Migrate Button variant prop',
                    description: 'The `type` prop has been renamed to `variant` to align with Bootstrap naming.',
                    before: `<Button type="primary">Submit</Button>`,
                    after: `<Button variant="primary">Submit</Button>`,
                    language: 'tsx',
                },
                {
                    title: 'Update CSS import',
                    before: `import 'toolcase-ui/dist/styles.css'`,
                    after: `import '@toolcase/react-components/style.css'`,
                    language: 'typescript',
                },
            ]
        }
    }, [])

    useEffect(() => {
        if (titledRef.current) {
            titledRef.current.steps = [
                {
                    title: 'Switch to the new API',
                    description: 'The `register()` call is now required before using any tc-* elements.',
                    before: `<script src="web-components.js"></script>`,
                    after: [
                        `import { register } from '@toolcase/web-components'`,
                        `import '@toolcase/web-components/style.css'`,
                        ``,
                        `register()`,
                    ].join('\n'),
                },
            ]
        }
    }, [])

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <RichPageHeader
                            chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                            title="MigrationGuide"
                            description="Step-by-step migration guide with a version transition header and before/after code diff panels."
                        />

                        <div className="d-flex flex-column gap-4 mt-4">
                            <SectionCard title="Basic (two steps, from/to attributes)">
                                {/* @ts-ignore */}
                                <tc-migration-guide ref={basicRef} from="v1.0" to="v2.0"></tc-migration-guide>
                            </SectionCard>

                            <SectionCard title="Full migration (multi-step with descriptions)">
                                {/* @ts-ignore */}
                                <tc-migration-guide ref={fullRef} from="v0.x" to="v1.0"></tc-migration-guide>
                            </SectionCard>

                            <SectionCard title="Custom title attribute">
                                {/* @ts-ignore */}
                                <tc-migration-guide ref={titledRef} from="0.9" to="1.0" title="Upgrading the web-components package"></tc-migration-guide>
                            </SectionCard>

                            <SectionCard title="No steps (header only)">
                                {/* @ts-ignore */}
                                <tc-migration-guide from="v3" to="v4"></tc-migration-guide>
                            </SectionCard>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default MigrationGuideDemo
