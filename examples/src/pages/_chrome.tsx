import { ReactNode, useState } from 'react'
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

export const PackageIntro = ({ meta }: { meta: PackageMeta }) => (
    <section className="page-intro">
        <div>
            <div className="eyebrow">{meta.eyebrow}</div>
            <h1 className="page-title mono">
                <span className="scope">@toolcase/</span>{meta.pkg.replace('@toolcase/', '')}
            </h1>
            <p className="page-lead">{meta.tagline}</p>
            {meta.chips && meta.chips.length > 0 && (
                <div className="chip-row">
                    {meta.chips.map((chip) => <span key={chip} className="tag">{chip}</span>)}
                </div>
            )}
        </div>
        <dl className="page-meta">
            <div>
                <dt>Latest version</dt>
                <dd className="mono">{meta.version}</dd>
            </div>
            <div>
                <dt>Examples</dt>
                <dd>{meta.examples}</dd>
            </div>
            <div>
                <dt>Dependencies</dt>
                <dd>{meta.deps ?? '0'}</dd>
            </div>
            <div>
                <dt>License</dt>
                <dd>{meta.license ?? 'MIT'}</dd>
            </div>
        </dl>
    </section>
)

export const InstallBlock = ({ pkg, label }: { pkg: string; label?: string }) => {
    const managers = [
        { mgr: 'npm', cmd: `npm i ${pkg}` },
        { mgr: 'pnpm', cmd: `pnpm add ${pkg}` },
        { mgr: 'yarn', cmd: `yarn add ${pkg}` },
    ]
    return (
        <>
            <div className="section-head">
                <h2>{label ?? 'Install'}</h2>
                <span className="count">node ≥ 18</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 520 }}>
                {managers.map((m) => <CopyLine key={m.mgr} cmd={m.cmd} />)}
            </div>
        </>
    )
}

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

export const CodeBlock = ({ file, code }: { file?: string; code: string }) => {
    const [copied, setCopied] = useState(false)
    const onCopy = () => {
        navigator.clipboard?.writeText(code)
        setCopied(true)
        setTimeout(() => setCopied(false), 1200)
    }
    return (
        <div className="code-block">
            {file && (
                <div className="code-head">
                    <span className="file">{file}</span>
                    <button className="copy" onClick={onCopy} type="button">{copied ? 'copied' : 'copy'}</button>
                </div>
            )}
            <div className="code-body">
                <pre><code>{code}</code></pre>
            </div>
        </div>
    )
}

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
                    <CopyLine cmd={projectCmd} />
                </div>
                <div>
                    <div className="eyebrow" style={{ marginBottom: 10 }}>User-level</div>
                    <CopyLine cmd={userCmd} />
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
    children,
}: {
    title: string
    count?: number
    children: ReactNode
}) => (
    <>
        <div className="section-head">
            <h2>{title}</h2>
            {count !== undefined && (
                <span className="count">{String(count).padStart(2, '0')} / {String(count).padStart(2, '0')}</span>
            )}
        </div>
        {children}
    </>
)
