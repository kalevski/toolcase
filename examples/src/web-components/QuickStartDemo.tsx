import React, { useEffect, useRef } from 'react'

const QuickStartDemo: React.FC = () => {
    const basicRef = useRef<any>(null)
    const withOutputRef = useRef<any>(null)
    const titledRef = useRef<any>(null)

    useEffect(() => {
        if (basicRef.current) {
            basicRef.current.steps = [
                {
                    title: 'Install the package',
                    description: 'Add the web-components package to your project.',
                    code: 'npm install @toolcase/web-components',
                    language: 'bash',
                },
                {
                    title: 'Import and register',
                    description: 'Call register() once at your app entry point.',
                    code: [
                        `import { register } from '@toolcase/web-components'`,
                        `import '@toolcase/web-components/style.css'`,
                        ``,
                        `register()`,
                    ].join('\n'),
                    language: 'typescript',
                },
                {
                    title: 'Use the components',
                    description: 'Drop tc-* elements anywhere in your HTML.',
                    code: `<tc-button variant="primary">Get started</tc-button>`,
                    language: 'html',
                },
            ]
        }
    }, [])

    useEffect(() => {
        if (withOutputRef.current) {
            withOutputRef.current.steps = [
                {
                    title: 'Run the build',
                    description: 'Build the project and confirm it succeeds.',
                    code: 'npm run build',
                    language: 'bash',
                    output: '✓ Built in 1.23s\n  dist/index.js    12.4 kB\n  dist/style.css    8.1 kB',
                },
                {
                    title: 'Run the tests',
                    code: 'npm test',
                    language: 'bash',
                    output: 'Test Files  4 passed (4)\n     Tests  18 passed (18)',
                },
                {
                    title: 'Deploy',
                    description: 'Push to the main branch to trigger the deployment pipeline.',
                    code: 'git push origin main',
                    language: 'bash',
                },
            ]
        }
    }, [])

    useEffect(() => {
        if (titledRef.current) {
            titledRef.current.steps = [
                {
                    title: 'Configure the environment',
                    description: 'Create a .env file with the required variables.',
                    code: 'DATABASE_URL=postgres://localhost:5432/mydb\nPORT=3000',
                },
                {
                    title: 'Start the server',
                    code: 'node server.js',
                    output: 'Server running on http://localhost:3000',
                },
            ]
        }
    }, [])

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="QuickStart"
                            description="Numbered step-by-step guide with optional code snippets and output sections."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Web Components
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-4 mt-4">
                            <tc-section-card title="Basic (three steps with code)">
                                {/* @ts-ignore */}
                                <tc-quick-start ref={basicRef}></tc-quick-start>
                            </tc-section-card>

                            <tc-section-card title="Steps with code and output">
                                {/* @ts-ignore */}
                                <tc-quick-start ref={withOutputRef}></tc-quick-start>
                            </tc-section-card>

                            <tc-section-card title="With title-text attribute">
                                {/* @ts-ignore */}
                                <tc-quick-start
                                    ref={titledRef}
                                    title-text="Project Setup"
                                ></tc-quick-start>
                            </tc-section-card>

                            <tc-section-card title="No steps (empty state)">
                                {/* @ts-ignore */}
                                <tc-quick-start title-text="Getting Started"></tc-quick-start>
                            </tc-section-card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default QuickStartDemo
