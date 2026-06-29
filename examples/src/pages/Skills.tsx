import { Breadcrumbs, CopyLine } from './_chrome'

type SkillEntry = {
    key: string
    name: string
    description: string
}

const skills: SkillEntry[] = [
    {
        key: 'react-spa-app',
        name: 'react-spa-app',
        description:
            'Architecture blueprint for React + TypeScript SPAs — Vite, react-router v7, zustand slices, layered pages → modules → services, modal registry, AuthGuard wiring.',
    },
    {
        key: 'node-service',
        name: 'node-service',
        description:
            'Architecture blueprint for Node.js + TypeScript backends — Fastify v5, tsyringe DI, Kysely on Postgres (no ORM), domain errors, optional Rivalis real-time, single-bundle ESM.',
    },
    {
        key: 'next-static-app',
        name: 'next-static-app',
        description:
            'Architecture blueprint for statically-prerendered React Router v7 marketing/content sites — Vite + React 19, file-based routing, prerender + SPA hydration, Tailwind v4, nginx Docker build.',
    },
    {
        key: 'next-fullstack-app',
        name: 'next-fullstack-app',
        description:
            'Architecture blueprint for self-hosted full-stack Next.js App Router apps — node:sqlite system-of-record + append-only migrations, layered server (config → data → domain → infrastructure → services → web), GitHub-OAuth HMAC-cookie auth + three-tier roles, guard→validate→service→audit route contract, tc-* dashboard UI, monorepo Docker standalone build.',
    },
    {
        key: 'phaser-game-dev',
        name: 'phaser-game-dev',
        description:
            'Architecture blueprint for Phaser 4 games on @toolcase/phaser-plus — scenes/ + features/ + ui/ + prefabs/ layout, Scene/Feature/HTMLFeature/GameObject layering, FeatureRegistry pub-sub bus, GameObjectPool spawning, effects + cinema + input integration.',
    },
]

const skillUrl = (key: string) => `https://toolcase.kalevski.dev/${key}/SKILL.md`

export const Skills = () => {
    return (
        <main className="site-container">
            <Breadcrumbs current="Skills" />
            <section className="page-intro">
                <div>
                    <div className="eyebrow">Index / Skills</div>
                    <h1 className="page-title">Architecture blueprints<br />for Claude Code.</h1>
                    <p className="page-lead">
                        Independent of any @toolcase package — install once and Claude follows the layout,
                        layering, and conventions whenever you scaffold or modify a project of that shape.
                    </p>
                </div>
                <dl className="page-meta">
                    <div>
                        <dt>Skills</dt>
                        <dd>{skills.length}</dd>
                    </div>
                    <div>
                        <dt>Format</dt>
                        <dd className="mono">SKILL.md</dd>
                    </div>
                    <div>
                        <dt>Source</dt>
                        <dd>toolcase.kalevski.dev</dd>
                    </div>
                    <div>
                        <dt>License</dt>
                        <dd>MIT</dd>
                    </div>
                </dl>
            </section>

            <div className="section-head">
                <h2>All skills</h2>
                <span className="count">{String(skills.length).padStart(2, '0')} / {String(skills.length).padStart(2, '0')}</span>
            </div>

            <div className="skill-grid">
                {skills.map((skill) => (
                    <div key={skill.key} className="skill-card">
                        <div className="skill-head">
                            <div>
                                <h3 className="skill-name">{skill.name}</h3>
                                <span className="skill-id">/{skill.key}</span>
                            </div>
                            <a href={skillUrl(skill.key)} target="_blank" rel="noopener" className="skill-foot">SKILL.md ↗</a>
                        </div>
                        <p className="skill-desc">{skill.description}</p>
                    </div>
                ))}
            </div>

            <div className="section-head"><h2>Install</h2><span className="count">curl + claude code</span></div>
            <p style={{ color: 'var(--fg-2)', fontSize: 14, maxWidth: '68ch', margin: '0 0 16px' }}>
                Replace <code>&lt;skill&gt;</code> with one of the keys above. Project-level installs
                stay inside one repo; user-level installs apply across every Claude Code session on
                this machine. Restart Claude Code or run <code>/skills</code> after installing.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
                <div>
                    <div className="eyebrow" style={{ marginBottom: 10 }}>Project-level</div>
                    <CopyLine cmd="mkdir -p .claude/skills/<skill> && curl -fsSL https://toolcase.kalevski.dev/<skill>/SKILL.md -o .claude/skills/<skill>/SKILL.md" />
                </div>
                <div>
                    <div className="eyebrow" style={{ marginBottom: 10 }}>User-level</div>
                    <CopyLine cmd="mkdir -p ~/.claude/skills/<skill> && curl -fsSL https://toolcase.kalevski.dev/<skill>/SKILL.md -o ~/.claude/skills/<skill>/SKILL.md" />
                </div>
            </div>
        </main>
    )
}
