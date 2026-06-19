import React, { useRef, useEffect } from 'react'

const BEFORE_TS = [
    'interface Config {',
    '  host: string',
    '  port: number',
    '}',
    '',
    'function createServer(config: Config) {',
    '  const { host, port } = config',
    '  console.log(`Starting on ${host}:${port}`)',
    '  return { host, port }',
    '}',
].join('\n')

const AFTER_TS = [
    'interface Config {',
    '  host: string',
    '  port: number',
    '  debug?: boolean',
    '}',
    '',
    'function createServer(config: Config): void {',
    '  const { host, port, debug = false } = config',
    '  if (debug) console.log(`Starting on ${host}:${port}`)',
    '}',
].join('\n')

const BEFORE_BASH = [
    '#!/usr/bin/env bash',
    'set -e',
    '',
    'echo "Deploying app"',
    'npm install',
    'npm run build',
].join('\n')

const AFTER_BASH = [
    '#!/usr/bin/env bash',
    'set -euo pipefail',
    '',
    'APP_NAME="my-app"',
    '',
    'echo "Deploying $APP_NAME"',
    'npm ci',
    'npm run build',
    'npm run test',
].join('\n')

const DiffViewerDemo: React.FC = () => {
    const splitRef = useRef<any>(null)
    const unifiedRef = useRef<any>(null)

    useEffect(() => {
        const splitEl = splitRef.current
        const unifiedEl = unifiedRef.current
        if (splitEl) {
            splitEl.before = BEFORE_TS
            splitEl.after = AFTER_TS
        }
        if (unifiedEl) {
            unifiedEl.before = BEFORE_BASH
            unifiedEl.after = AFTER_BASH
        }
    }, [])

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="DiffViewer"
                            description="Side-by-side or unified line diff with add/remove highlighting. Set before and after via JS properties for multi-line content."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Web Components
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-4 mt-4">
                            <tc-section-card title="Split mode — TypeScript (JS property)">
                                {/* @ts-ignore */}
                                <tc-diff-viewer
                                    ref={splitRef}
                                    mode="split"
                                    language="typescript"
                                    filename="src/server.ts"
                                />
                            </tc-section-card>

                            <tc-section-card title="Unified mode — Bash (JS property)">
                                {/* @ts-ignore */}
                                <tc-diff-viewer
                                    ref={unifiedRef}
                                    mode="unified"
                                    language="bash"
                                    filename="deploy.sh"
                                />
                            </tc-section-card>

                            <tc-section-card title="Split mode — no filename, attribute-set content">
                                {/* @ts-ignore */}
                                <tc-diff-viewer
                                    mode="split"
                                    before={'hello world\nfoo bar'}
                                    after={'hello world\nbaz qux\nnew line'}
                                />
                            </tc-section-card>

                            <tc-section-card title="Unified mode — identical files (no changes)">
                                {/* @ts-ignore */}
                                <tc-diff-viewer
                                    mode="unified"
                                    before={'const x = 1\nconst y = 2'}
                                    after={'const x = 1\nconst y = 2'}
                                    filename="unchanged.ts"
                                />
                            </tc-section-card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default DiffViewerDemo
