import React, { useRef, useEffect, useState } from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const JS_CODE = [
    'async function fetchUser(id) {',
    '  const res = await fetch(`/api/users/${id}`)',
    '  if (!res.ok) throw new Error(`HTTP ${res.status}`)',
    '  return res.json()',
    '}',
    '',
    'fetchUser(42).then(u => console.log(u.name))',
].join('\n')

const TS_CODE = [
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

const BASH_CODE = [
    '#!/usr/bin/env bash',
    '# Deploy script',
    'set -euo pipefail',
    '',
    'APP_NAME="my-app"',
    'VERSION=${1:-latest}',
    '',
    'echo "Deploying $APP_NAME @ $VERSION"',
    'git pull origin main',
    'npm install --production',
    'npm run build',
].join('\n')

const SLOT_CODE = [
    'const greet = (name: string) =>',
    '  `Hello, ${name}!`',
].join('\n')

const CodeSnippetDemo: React.FC = () => {
    const tsCopyRef = useRef<any>(null)
    const [lastCopied, setLastCopied] = useState<string | null>(null)

    useEffect(() => {
        const tsEl = tsCopyRef.current
        if (!tsEl) return

        const handler = (e: CustomEvent<{ code: string }>) => {
            setLastCopied(e.detail.code.slice(0, 40) + '…')
        }

        tsEl.onCopy = (code: string) => {
            // JS property callback also fires
            console.log('[CodeSnippet] onCopy callback, length:', code.length)
        }
        tsEl.addEventListener('tc-copy', handler)
        return () => tsEl.removeEventListener('tc-copy', handler)
    }, [])

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <RichPageHeader
                            chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                            title="CodeSnippet"
                            description="Syntax-highlighted code block with language detection, copy button, and loading skeleton."
                        />

                        <div className="d-flex flex-column gap-4 mt-4">

                            <SectionCard title="JavaScript (attribute)">
                                {/* @ts-ignore */}
                                <tc-code-snippet code={JS_CODE} language="javascript" />
                            </SectionCard>

                            <SectionCard title="TypeScript with title — tc-copy event + onCopy callback">
                                {/* @ts-ignore */}
                                <tc-code-snippet
                                    ref={tsCopyRef}
                                    code={TS_CODE}
                                    language="typescript"
                                    title="src/server.ts"
                                />
                                {lastCopied && (
                                    <p className="mt-2 text-muted" style={{ fontSize: '0.8rem' }}>
                                        <strong>tc-copy fired.</strong> First 40 chars: <code>{lastCopied}</code>
                                    </p>
                                )}
                            </SectionCard>

                            <SectionCard title="Bash">
                                {/* @ts-ignore */}
                                <tc-code-snippet code={BASH_CODE} language="bash" title="deploy.sh" />
                            </SectionCard>

                            <SectionCard title="Copy button hidden (show-copy-button=false)">
                                {/* @ts-ignore */}
                                <tc-code-snippet
                                    code={JS_CODE}
                                    language="javascript"
                                    show-copy-button="false"
                                />
                            </SectionCard>

                            <SectionCard title="Slotted text content (code attribute fallback)">
                                {/* @ts-ignore */}
                                <tc-code-snippet language="typescript">
                                    {SLOT_CODE}
                                </tc-code-snippet>
                            </SectionCard>

                            <SectionCard title="Loading skeleton">
                                {/* @ts-ignore */}
                                <tc-code-snippet loading language="javascript" title="Loading…" />
                            </SectionCard>

                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default CodeSnippetDemo
