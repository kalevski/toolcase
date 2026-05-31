import { useState } from 'react'
import { Link as RouterLink } from 'react-router'
import { baseExamples } from '../base/index'
import { loggingExamples } from '../logging/index'
import { serializerExamples } from '../serializer/index'
import { examples as reactComponentExamples } from '../react-components/index'
import { gameComponentExamples } from '../game-components/index'
import { phaserExamples } from '../phaser-plus/index'
import { nodeExamples } from '../node/index'

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
        version: '3.0.2',
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
        version: '3.0.2',
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
        version: '3.0.2',
        examples: serializerExamples.length,
        pkg: '@toolcase/serializer',
        path: '/serializer',
    },
    {
        key: 'react-components',
        scope: '@toolcase/',
        name: 'react-components',
        tagline: 'React UI building blocks built on Bootstrap 5 — typography, inputs, layout, navigation, charts, data display.',
        category: 'UI · React',
        version: '3.0.2',
        examples: reactComponentExamples.length,
        pkg: '@toolcase/react-components',
        path: '/react-components',
    },
    {
        key: 'game-components',
        scope: '@toolcase/',
        name: 'game-components',
        tagline: 'Framework-free Web Components for game UI — panels, bars, dialogs, overlays, fantasy HUD primitives.',
        category: 'Games · Web Components',
        version: '3.0.2',
        examples: gameComponentExamples.length,
        pkg: '@toolcase/game-components',
        path: '/game-components',
    },
    {
        key: 'phaser-plus',
        scope: '@toolcase/',
        name: 'phaser-plus',
        tagline: 'Unified runtime layer for Phaser 4 — Scene lifecycle, FeatureRegistry, Flow, AI, Effects, Cinema, Input.',
        category: 'Games · Phaser',
        version: '3.0.2',
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
        version: '1.0.0',
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

export const Home = () => {
    return (
        <main className="site-container" data-screen-label="Libraries">
            <section className="page-intro">
                <div>
                    <div className="eyebrow">Index / Libraries</div>
                    <h1 className="page-title">A small set of tools I keep<br/>reaching for, every project.</h1>
                    <p className="page-lead">
                        Seven npm packages I've built, used, and rewritten across a decade of web apps and games.
                        Documented and demoed here so you can install one in a single line and see how it behaves.
                    </p>
                </div>
                <dl className="page-meta">
                    <div>
                        <dt>Maintainer</dt>
                        <dd>Daniel Kalevski</dd>
                    </div>
                    <div>
                        <dt>License</dt>
                        <dd>MIT</dd>
                    </div>
                    <div>
                        <dt>First commit</dt>
                        <dd>2016</dd>
                    </div>
                    <div>
                        <dt>Status</dt>
                        <dd><span className="tag accent">Active</span></dd>
                    </div>
                </dl>
            </section>

            <div className="stats">
                <div className="stat">
                    <div className="stat-label">Packages</div>
                    <div className="stat-value">{libs.length}</div>
                </div>
                <div className="stat">
                    <div className="stat-label">Live examples</div>
                    <div className="stat-value">{totalExamples}</div>
                </div>
                <div className="stat">
                    <div className="stat-label">Runtime</div>
                    <div className="stat-value">Node <span className="unit">≥ 18</span></div>
                </div>
                <div className="stat">
                    <div className="stat-label">Maintained since</div>
                    <div className="stat-value">2016</div>
                </div>
            </div>

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
