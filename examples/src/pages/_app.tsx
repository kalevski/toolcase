import { ReactNode } from 'react'
import { Link as RouterLink } from 'react-router'
import { CodeBlock } from './_chrome'

// Shared chrome for the standalone-app pages under /apps.

export type AppIntroProps = {
    name: string
    eyebrow: string
    lead: ReactNode
    chips: string[]
    meta: { label: string; value: string }[]
}

export const AppIntro = ({ name, eyebrow, lead, chips, meta }: AppIntroProps) => (
    <>
        <div className="breadcrumbs">
            <RouterLink to="/apps">Apps</RouterLink>
            <span className="sep">/</span>
            <span className="current mono">{name}</span>
        </div>

        <section className="page-intro">
            <div>
                <div className="eyebrow">{eyebrow}</div>
                <h1 className="page-title mono">{name}</h1>
                <p className="page-lead">{lead}</p>
                <div className="chip-row">
                    {chips.map((chip) => (
                        <span key={chip} className="tag">{chip}</span>
                    ))}
                </div>
            </div>
            <dl className="page-meta">
                {meta.map((m) => (
                    <div key={m.label}>
                        <dt>{m.label}</dt>
                        <dd>{m.value}</dd>
                    </div>
                ))}
            </dl>
        </section>
    </>
)

export const FeatureGrid = ({ features }: { features: { title: string; body: string }[] }) => (
    <div className="lib-grid">
        {features.map((f) => (
            <div key={f.title} className="lib-card">
                <div className="lib-card-head">
                    <div>
                        <h3 className="lib-name">{f.title}</h3>
                        <p className="lib-tagline">{f.body}</p>
                    </div>
                </div>
            </div>
        ))}
    </div>
)

export const SectionHead = ({ title, count }: { title: ReactNode; count?: ReactNode }) => (
    <div className="section-head">
        <h2>{title}</h2>
        {count ? <span className="count">{count}</span> : null}
    </div>
)

export const CodeSection = ({
    title,
    count,
    file,
    code,
}: {
    title: ReactNode
    count?: ReactNode
    file: string
    code: string
}) => (
    <>
        <SectionHead title={title} count={count} />
        <CodeBlock file={file} code={code} />
    </>
)

export const SourceCard = ({ dir, tagline }: { dir: string; tagline: string }) => (
    <>
        <SectionHead title="Source" count="lives in the toolcase monorepo" />
        <div className="lib-grid">
            <a
                href={`https://github.com/kalevski/toolcase/tree/main/${dir}`}
                target="_blank"
                rel="noreferrer"
                className="lib-card"
            >
                <div className="lib-card-head">
                    <div>
                        <h3 className="lib-name">kalevski/toolcase</h3>
                        <p className="lib-tagline">
                            {dir}/ — {tagline}
                        </p>
                    </div>
                    <span className="lib-arrow">→</span>
                </div>
            </a>
        </div>
    </>
)
