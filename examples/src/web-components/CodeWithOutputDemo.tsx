import React, { useRef, useEffect } from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const JS_CODE = "function greet(name) {\n  return `Hello, ${name}!`;\n}\n\nconsole.log(greet('World'));"
const TS_CODE = "function processName(name: string): string {\n  return name.toUpperCase();\n}\n\nprocessName(undefined as any);"
const BASH_CODE = "git clone https://github.com/example/my-app.git\ncd my-app && npm install"
const STACKED_CODE = "const a = 1;\nconst b = 2;\nconsole.log(a + b);"

const CodeWithOutputDemo: React.FC = () => {
    const splitRef = useRef<any>(null)
    const stackedRef = useRef<any>(null)
    const errorRef = useRef<any>(null)
    const bashRef = useRef<any>(null)

    useEffect(() => {
        if (splitRef.current) {
            splitRef.current.output = 'Hello, World!'
        }
        if (stackedRef.current) {
            stackedRef.current.output = '3'
        }
        if (errorRef.current) {
            errorRef.current.error =
                "TypeError: Cannot read properties of undefined (reading 'toUpperCase')\n" +
                "    at processName (index.ts:2:16)\n" +
                "    at <anonymous>:5:1"
        }
        if (bashRef.current) {
            bashRef.current.output =
                "Cloning into 'my-app'...\nremote: Enumerating objects: 42, done.\nadded 312 packages in 8s"
        }
    }, [])

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <RichPageHeader
                            chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                            title="CodeWithOutput"
                            description="Code snippet and its output displayed side-by-side (split) or stacked. Supports a normal output pane and a danger-styled error pane."
                        />

                        <div className="d-flex flex-column gap-4 mt-4">
                            <SectionCard title="Split layout (default)">
                                {/* @ts-ignore */}
                                <tc-code-with-output
                                    ref={splitRef}
                                    code={JS_CODE}
                                    language="javascript"
                                    layout="split"
                                    title="JavaScript: greeting function"
                                />
                            </SectionCard>

                            <SectionCard title="Stacked layout">
                                {/* @ts-ignore */}
                                <tc-code-with-output
                                    ref={stackedRef}
                                    code={STACKED_CODE}
                                    language="javascript"
                                    layout="stacked"
                                />
                            </SectionCard>

                            <SectionCard title="Error state">
                                {/* @ts-ignore */}
                                <tc-code-with-output
                                    ref={errorRef}
                                    code={TS_CODE}
                                    language="typescript"
                                    layout="split"
                                    title="TypeError example"
                                />
                            </SectionCard>

                            <SectionCard title="Bash language">
                                {/* @ts-ignore */}
                                <tc-code-with-output
                                    ref={bashRef}
                                    code={BASH_CODE}
                                    language="bash"
                                    layout="split"
                                />
                            </SectionCard>

                            <SectionCard title="Slotted title and output">
                                {/* @ts-ignore */}
                                <tc-code-with-output code={"const pi = Math.PI;\nconsole.log(pi);"} language="javascript">
                                    <span slot="title">Slotted rich title</span>
                                    <span slot="output">3.141592653589793</span>
                                </tc-code-with-output>
                            </SectionCard>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default CodeWithOutputDemo
