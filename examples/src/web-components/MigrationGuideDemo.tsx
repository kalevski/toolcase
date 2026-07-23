import React from 'react'
import { useTc } from '@toolcase/web-components/react'

const MigrationGuideDemo: React.FC = () => {
    const basicRef = useTc<HTMLElement>({
        steps: [
            {
                title: 'Swap the package',
                description: 'The React library is replaced by framework-free custom elements.',
                before: `import { Button } from '@toolcase/react-components'`,
                after: `import { register } from '@toolcase/web-components'`,
            },
            {
                title: 'Register the elements once at startup',
                description: 'Call register() before the first render so the tc-* tags upgrade.',
                before: `import '@toolcase/react-components/style.css'`,
                after: [`import '@toolcase/web-components/style.css'`, ``, `register()`].join('\n'),
            },
        ],
    })

    const fullRef = useTc<HTMLElement>({
        steps: [
            {
                title: 'Install the new package',
                description: 'Remove the React library and install the framework-free web components.',
                before: `npm install @toolcase/react-components`,
                after: `npm install @toolcase/web-components`,
                language: 'bash',
            },
            {
                title: 'Register elements + load the stylesheet',
                before: [
                    `import { Button, Card } from '@toolcase/react-components'`,
                    `import '@toolcase/react-components/style.css'`,
                ].join('\n'),
                after: [
                    `import { register } from '@toolcase/web-components'`,
                    `import '@toolcase/web-components/style.css'`,
                    ``,
                    `register()`,
                ].join('\n'),
                language: 'typescript',
            },
            {
                title: 'Replace JSX components with custom elements',
                description:
                    'Props become attributes; children stay as light-DOM content.',
                before: `<Button variant="primary">Submit</Button>`,
                after: `<tc-button variant="primary">Submit</tc-button>`,
                language: 'tsx',
            },
            {
                title: 'Map handlers to DOM events',
                description:
                    'onClick becomes a native listener; richer components emit tc-* CustomEvents.',
                before: `<Button onClick={save}>Save</Button>`,
                after: [`<tc-button id="save">Save</tc-button>`, ``, `el.addEventListener('click', save)`].join('\n'),
                language: 'tsx',
            },
        ],
    })

    const titledRef = useTc<HTMLElement>({
        steps: [
            {
                title: 'Switch to the new API',
                description:
                    'The `register()` call is now required before using any tc-* elements.',
                before: `<script src="web-components.js"></script>`,
                after: [
                    `import { register } from '@toolcase/web-components'`,
                    `import '@toolcase/web-components/style.css'`,
                    ``,
                    `register()`,
                ].join('\n'),
            },
        ],
    })

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="MigrationGuide"
                            description="Step-by-step migration guide with a version transition header and before/after code diff panels."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Web Components
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-4 mt-4">
                            <tc-section-card title="Basic (two steps, from/to attributes)">
                                {/* @ts-ignore */}
                                <tc-migration-guide
                                    ref={basicRef}
                                    from="react-components"
                                    to="web-components"
                                ></tc-migration-guide>
                            </tc-section-card>

                            <tc-section-card title="Full migration (multi-step with descriptions)">
                                {/* @ts-ignore */}
                                <tc-migration-guide
                                    ref={fullRef}
                                    from="react-components"
                                    to="web-components"
                                ></tc-migration-guide>
                            </tc-section-card>

                            <tc-section-card title="Custom title attribute">
                                {/* @ts-ignore */}
                                <tc-migration-guide
                                    ref={titledRef}
                                    from="0.9"
                                    to="1.0"
                                    title="Upgrading the web-components package"
                                ></tc-migration-guide>
                            </tc-section-card>

                            <tc-section-card title="No steps (header only)">
                                {/* @ts-ignore */}
                                <tc-migration-guide from="v3" to="v4"></tc-migration-guide>
                            </tc-section-card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default MigrationGuideDemo
