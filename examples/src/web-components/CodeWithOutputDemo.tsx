import React from 'react'
import { useTc } from '@toolcase/web-components/react'

const JS_CODE =
    "function greet(name) {\n  return `Hello, ${name}!`;\n}\n\nconsole.log(greet('World'));"
const TS_CODE =
    'function processName(name: string): string {\n  return name.toUpperCase();\n}\n\nprocessName(undefined as any);'
const BASH_CODE = 'git clone https://github.com/example/my-app.git\ncd my-app && npm install'
const STACKED_CODE = 'const a = 1;\nconst b = 2;\nconsole.log(a + b);'

const CodeWithOutputDemo: React.FC = () => {
    const splitRef = useTc<HTMLElement>({ output: 'Hello, World!' })
    const stackedRef = useTc<HTMLElement>({ output: '3' })
    const errorRef = useTc<HTMLElement>({
        error:
            "TypeError: Cannot read properties of undefined (reading 'toUpperCase')\n" +
            '    at processName (index.ts:2:16)\n' +
            '    at <anonymous>:5:1',
    })
    const bashRef = useTc<HTMLElement>({
        output:
            "Cloning into 'my-app'...\nremote: Enumerating objects: 42, done.\nadded 312 packages in 8s",
    })

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="CodeWithOutput"
                            description="Code snippet and its output displayed side-by-side (split) or stacked. Supports a normal output pane and a danger-styled error pane."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Web Components
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-4 mt-4">
                            <tc-section-card title="Split layout (default)">
                                {/* @ts-ignore */}
                                <tc-code-with-output
                                    ref={splitRef}
                                    code={JS_CODE}
                                    language="javascript"
                                    layout="split"
                                    title="JavaScript: greeting function"
                                />
                            </tc-section-card>

                            <tc-section-card title="Stacked layout">
                                {/* @ts-ignore */}
                                <tc-code-with-output
                                    ref={stackedRef}
                                    code={STACKED_CODE}
                                    language="javascript"
                                    layout="stacked"
                                />
                            </tc-section-card>

                            <tc-section-card title="Error state">
                                {/* @ts-ignore */}
                                <tc-code-with-output
                                    ref={errorRef}
                                    code={TS_CODE}
                                    language="typescript"
                                    layout="split"
                                    title="TypeError example"
                                />
                            </tc-section-card>

                            <tc-section-card title="Bash language">
                                {/* @ts-ignore */}
                                <tc-code-with-output
                                    ref={bashRef}
                                    code={BASH_CODE}
                                    language="bash"
                                    layout="split"
                                />
                            </tc-section-card>

                            <tc-section-card title="Slotted title and output">
                                {/* @ts-ignore */}
                                <tc-code-with-output
                                    code={'const pi = Math.PI;\nconsole.log(pi);'}
                                    language="javascript"
                                >
                                    <span slot="title">Slotted rich title</span>
                                    <span slot="output">3.141592653589793</span>
                                </tc-code-with-output>
                            </tc-section-card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default CodeWithOutputDemo
