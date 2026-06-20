import { useEffect, useRef, useState } from 'react'
import { Link as RouterLink } from 'react-router'
import { baseExamples } from '../base/index'
import { loggingExamples } from '../logging/index'
import { serializerExamples } from '../serializer/index'
import { webComponentExamples } from '../web-components/index'
import { phaserExamples } from '../phaser-plus/index'
import { nodeExamples } from '../node/index'
import { versions } from '../versions'

type LibCard = {
    key: string
    name: string
    scope: string
    tagline: string
    category: string
    version: string
    examples: number
    pkg: string
    path: string
}

const libs: LibCard[] = [
    {
        key: 'base',
        scope: '@toolcase/',
        name: 'base',
        tagline: 'Foundational primitives — events, registries, async helpers, data structures — that everything else in toolcase builds on.',
        category: 'Foundation',
        version: versions.base,
        examples: baseExamples.length,
        pkg: '@toolcase/base',
        path: '/base',
    },
    {
        key: 'logging',
        scope: '@toolcase/',
        name: 'logging',
        tagline: 'Lightweight logger with scoped loggers, log levels and pluggable reporters. Quiet by default, loud when you need it.',
        category: 'Diagnostics',
        version: versions.logging,
        examples: loggingExamples.length,
        pkg: '@toolcase/logging',
        path: '/logging',
    },
    {
        key: 'serializer',
        scope: '@toolcase/',
        name: 'serializer',
        tagline: 'Protobuf-based binary serializer for compact, schema-driven encoding. Fast under load.',
        category: 'Data',
        version: versions.serializer,
        examples: serializerExamples.length,
        pkg: '@toolcase/serializer',
        path: '/serializer',
    },
    {
        key: 'web-components',
        scope: '@toolcase/',
        name: 'web-components',
        tagline: 'Framework-free HTML5 Web Components with from-scratch toolcase styling — drop into any stack, no React, Vue, or Angular required.',
        category: 'UI · Web Components',
        version: versions['web-components'],
        examples: webComponentExamples.length,
        pkg: '@toolcase/web-components',
        path: '/web-components',
    },
    {
        key: 'phaser-plus',
        scope: '@toolcase/',
        name: 'phaser-plus',
        tagline: 'Unified runtime layer for Phaser 4 — Scene lifecycle, FeatureRegistry, Flow, AI, Effects, Cinema, Input.',
        category: 'Games · Phaser',
        version: versions['phaser-plus'],
        examples: phaserExamples.length,
        pkg: '@toolcase/phaser-plus',
        path: '/phaser-plus',
    },
    {
        key: 'node',
        scope: '@toolcase/',
        name: 'node',
        tagline: 'Backend helpers — Fastify endpoints, raw-SQL repositories, Redis KV service, isomorphic sanitize/pagination utils.',
        category: 'Backend · Node',
        version: versions.node,
        examples: nodeExamples.length,
        pkg: '@toolcase/node',
        path: '/node',
    },
]

const totalExamples = libs.reduce((sum, l) => sum + l.examples, 0)

const InstallRow = ({ pkg }: { pkg: string }) => {
    const [copied, setCopied] = useState(false)
    const cmd = `npm i ${pkg}`
    const onCopy = (event: React.MouseEvent) => {
        event.preventDefault()
        event.stopPropagation()
        navigator.clipboard?.writeText(cmd)
        setCopied(true)
        setTimeout(() => setCopied(false), 1200)
    }
    return (
        <div className="install">
            <span><span className="prompt">$ </span><span className="cmd">{cmd}</span></span>
            <button className="copy" onClick={onCopy} type="button">{copied ? 'copied' : 'copy'}</button>
        </div>
    )
}

// Landing hero dogfoods <tc-hero>: eyebrow + title + lead come in as
// attributes; the four headline stats are a JS property assigned via ref.
const HeroBanner = () => {
    const ref = useRef<any>(null)
    useEffect(() => {
        if (!ref.current) return
        ref.current.statCards = [
            { label: 'Packages', value: String(libs.length) },
            { label: 'Live examples', value: String(totalExamples) },
            { label: 'Runtime', value: 'Node ≥ 18' },
            { label: 'Maintained since', value: '2016' },
        ]
    }, [])
    return (
        // @ts-ignore custom element registered by @toolcase/web-components
        <tc-hero
            ref={ref}
            eyebrow="Index / Libraries"
            title="A small set of tools I keep reaching for, every project."
            description="Six npm packages I've built, used, and rewritten across a decade of web apps and games — documented and demoed here so you can install one in a single line and see how it behaves."
        />
    )
}

export const Home = () => {
    return (
        <main className="site-container" data-screen-label="Libraries">
            <HeroBanner />

            <div className="section-head">
                <h2>All libraries</h2>
                <span className="count">{String(libs.length).padStart(2, '0')} / {String(libs.length).padStart(2, '0')}</span>
            </div>

            <div className="lib-grid">
                {libs.map((lib) => (
                    <RouterLink key={lib.key} to={lib.path} className="lib-card">
                        <div className="lib-card-head">
                            <div>
                                <h3 className="lib-name"><span className="scope">{lib.scope}</span>{lib.name}</h3>
                                <p className="lib-tagline">{lib.tagline}</p>
                            </div>
                            <span className="lib-arrow">→</span>
                        </div>
                        <div className="lib-meta-row">
                            <span>{lib.category}</span>
                            <span className="sep">·</span>
                            <span className="version">v{lib.version}</span>
                            <span className="sep">·</span>
                            <span>{lib.examples} {lib.examples === 1 ? 'example' : 'examples'}</span>
                        </div>
                        <InstallRow pkg={lib.pkg} />
                    </RouterLink>
                ))}
            </div>
        </main>
    )
}
