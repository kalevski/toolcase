import React, { useEffect, useRef } from 'react'

const STATIC_LINES = [
    { type: 'comment', text: '# Install the package' },
    { type: 'command', text: 'npm install @toolcase/web-components' },
    { type: 'output', text: 'added 12 packages in 2.4s' },
    { type: 'command', text: 'node app.js' },
    { type: 'output', text: '✔ server listening on http://localhost:3000' },
]

const TYPED_LINES = [
    { type: 'command', text: 'curl https://api.example.com/health' },
    { type: 'output', text: '{ "status": "ok", "uptime": 1042 }' },
    { type: 'comment', text: '# all systems nominal' },
]

const TerminalWindowDemo: React.FC = () => {
    const staticRef = useRef<any>(null)
    const typedRef = useRef<any>(null)

    useEffect(() => {
        if (staticRef.current) staticRef.current.lines = STATIC_LINES
    }, [])

    useEffect(() => {
        if (typedRef.current) typedRef.current.lines = TYPED_LINES
    }, [])

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="TerminalWindow"
                            description="Styled terminal/console window with macOS-style chrome, command prompts, and an optional character-by-character typing animation. Set lines via the JS lines property."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Web Components
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-4 mt-4">
                            <tc-section-card title="Static — command · output · comment">
                                {/* @ts-ignore */}
                                <tc-terminal-window ref={staticRef} title="~/projects/my-app" />
                            </tc-section-card>

                            <tc-section-card title="Animated typing — custom title, prompt & speed">
                                {/* @ts-ignore */}
                                <tc-terminal-window
                                    ref={typedRef}
                                    title="bash"
                                    prompt="❯"
                                    animate-typing=""
                                    speed="55"
                                />
                            </tc-section-card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default TerminalWindowDemo
