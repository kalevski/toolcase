import { ReactNode, useEffect, useRef, useState } from 'react'
import { Link as RouterLink, useNavigate } from 'react-router'

export type PackageMeta = {
    pkg: string
    name: string
    eyebrow: string
    tagline: string
    version: string
    examples: number
    nodeVersion?: string
    deps?: string
    license?: string
    chips?: string[]
}

export const Breadcrumbs = ({ current }: { current: string }) => (
    <div className="breadcrumbs">
        <RouterLink to="/">Libraries</RouterLink>
        <span className="sep">/</span>
        <span className="current mono">{current}</span>
    </div>
)

// Small React wrapper around <tc-metric-grid>: the component takes its rows as
// a JS property (`items`), so we assign it through a ref after mount.
type Metric = { label: string; value: string; unit?: string; hint?: string; icon?: string }

const MetricGrid = ({ items, columns }: { items: Metric[]; columns?: number }) => {
    const ref = useRef<any>(null)
    useEffect(() => {
        if (ref.current) ref.current.items = items
    }, [items])
    // @ts-ignore custom element registered by @toolcase/web-components
    return <tc-metric-grid ref={ref} columns={columns ? String(columns) : undefined} />
}

export const PackageIntro = ({ meta }: { meta: PackageMeta }) => (
    <section className="page-intro-wc">
        {/* @ts-ignore */}
        <tc-rich-page-header title-text={meta.pkg} sub={meta.eyebrow} description={meta.tagline}>
            {meta.chips?.map((chip) => (
                // @ts-ignore
                <tc-badge key={chip} slot="chips" variant="secondary">
                    {chip}
                </tc-badge>
            ))}
            {/* @ts-ignore */}
        </tc-rich-page-header>
        <div className="mt-3">
            <MetricGrid
                columns={4}
                items={[
                    { label: 'Latest version', value: meta.version },
                    { label: 'Examples', value: String(meta.examples) },
                    { label: 'Dependencies', value: meta.deps ?? '0' },
                    { label: 'License', value: meta.license ?? 'MIT' },
                ]}
            />
        </div>
    </section>
)

export const InstallBlock = ({ pkg, label }: { pkg: string; label?: string }) => (
    <>
        <div className="section-head">
            <h2>{label ?? 'Install'}</h2>
            <span className="count">node ≥ 18</span>
        </div>
        {/* @ts-ignore */}
        <tc-install-tabs package={pkg} style={{ display: 'block', maxWidth: 560 }} />
    </>
)

export const CopyLine = ({ cmd }: { cmd: string }) => {
    const [copied, setCopied] = useState(false)
    const onCopy = () => {
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

export const CodeBlock = ({ file, code, language }: { file?: string; code: string; language?: string }) => (
    // @ts-ignore custom element registered by @toolcase/web-components
    <tc-code-snippet title={file} code={code} language={language ?? 'bash'} style={{ display: 'block' }} />
)

export const SkillInstall = ({ slug, pkg }: { slug: string; pkg: string }) => {
    const url = `https://toolcase.kalevski.dev/${slug}/SKILL.md`
    const projectCmd = `mkdir -p .claude/skills/${slug} && curl -fsSL ${url} -o .claude/skills/${slug}/SKILL.md`
    const userCmd = `mkdir -p ~/.claude/skills/${slug} && curl -fsSL ${url} -o ~/.claude/skills/${slug}/SKILL.md`
    return (
        <>
            <div className="section-head">
                <h2>Install as a Claude Code skill</h2>
                <a className="count" href={url} target="_blank" rel="noopener">SKILL.md ↗</a>
            </div>
            <p style={{ color: 'var(--fg-2)', fontSize: 14, maxWidth: '68ch', margin: '0 0 16px' }}>
                <code>SKILL.md</code> is a focused reference for <code>{pkg}</code> that Claude Code loads
                as a skill. Install it once and Claude can pick the right APIs and compose examples
                without you re-explaining the package.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
                <div>
                    <div className="eyebrow" style={{ marginBottom: 10 }}>Project-level</div>
                    {/* @ts-ignore */}
                    <tc-code-snippet code={projectCmd} language="bash" style={{ display: 'block' }} />
                </div>
                <div>
                    <div className="eyebrow" style={{ marginBottom: 10 }}>User-level</div>
                    {/* @ts-ignore */}
                    <tc-code-snippet code={userCmd} language="bash" style={{ display: 'block' }} />
                </div>
            </div>
        </>
    )
}

type ExampleEntry = {
    key: string
    label: string
    description?: string
}

export const ExampleGrid = ({
    items,
    basePath,
}: {
    items: ExampleEntry[]
    basePath: string
}) => {
    const navigate = useNavigate()
    return (
        <div className="example-grid">
            {items.map((example, i) => (
                <a
                    key={example.key}
                    className="example-card"
                    href={`${basePath}/${example.key}`}
                    onClick={(e) => {
                        e.preventDefault()
                        navigate(`${basePath}/${example.key}`)
                    }}
                >
                    <div className="example-thumb">
                        <span style={{ opacity: 0.5 }}>{example.key}</span>
                        <span className="badge">{String(i + 1).padStart(2, '0')}</span>
                    </div>
                    <div className="example-body">
                        <span className="example-num">Example {String(i + 1).padStart(2, '0')}</span>
                        <h3 className="example-name">{example.label}</h3>
                        {example.description && <p className="example-desc">{example.description}</p>}
                    </div>
                </a>
            ))}
        </div>
    )
}

export const CategorySection = ({
    title,
    count,
    subtitle,
    children,
}: {
    title: string
    count?: number
    subtitle?: string
    children: ReactNode
}) => (
    // @ts-ignore custom element registered by @toolcase/web-components
    <tc-section-card title={count !== undefined ? `${title} · ${String(count).padStart(2, '0')} components` : title}>
        {subtitle && <p className="section-subtitle">{subtitle}</p>}
        {children}
        {/* @ts-ignore */}
    </tc-section-card>
)
