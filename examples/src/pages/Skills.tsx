import { Badge, CodeSnippet, Heading, Icon, Link, RichPageHeader, SectionCard, Text } from '@toolcase/react-components'

type SkillEntry = {
    key: string
    name: string
    description: string
    icon: string
}

const skills: SkillEntry[] = [
    {
        key: 'react-spa-app',
        name: 'react-spa-app',
        description:
            'Architecture blueprint for React + TypeScript SPAs — Vite, react-router v7, zustand slices, layered pages → modules → services, modal registry, AuthGuard wiring.',
        icon: 'window-stack',
    },
    {
        key: 'node-service',
        name: 'node-service',
        description:
            'Architecture blueprint for Node.js + TypeScript backends — Fastify v5, tsyringe DI, Kysely on Postgres (no ORM), domain errors, optional Rivalis real-time, single-bundle ESM.',
        icon: 'hdd-network',
    },
    {
        key: 'next-static-app',
        name: 'next-static-app',
        description:
            'Architecture blueprint for statically-prerendered React Router v7 marketing/content sites — Vite + React 19, file-based routing, prerender + SPA hydration, Tailwind v4, nginx Docker build.',
        icon: 'file-earmark-richtext',
    },
    {
        key: 'phaser-game-dev',
        name: 'phaser-game-dev',
        description:
            'Architecture blueprint for Phaser 4 games on @toolcase/phaser-plus — scenes/ + features/ + ui/ + prefabs/ layout, Scene/Feature/HTMLFeature/GameObject layering, FeatureRegistry pub-sub bus, GameObjectPool spawning, effects + cinema + input integration.',
        icon: 'controller',
    },
]

const skillUrl = (key: string) => `https://toolcase.kalevski.dev/${key}/SKILL.md`

const projectInstall = (key: string) =>
    `mkdir -p .claude/skills/${key} && \\
    curl -fsSL ${skillUrl(key)} -o .claude/skills/${key}/SKILL.md`

const userInstall = (key: string) =>
    `mkdir -p ~/.claude/skills/${key} && \\
    curl -fsSL ${skillUrl(key)} -o ~/.claude/skills/${key}/SKILL.md`

export const Skills = () => {
    return (
        <div className="container py-5">
            <RichPageHeader
                icon={{ name: 'robot', color: 'violet' }}
                title="Skills"
                sub="Standalone Claude Code skills"
                description="Architecture blueprints published as Claude Code skills. Independent of any @toolcase package — install once and Claude follows the layout, layering, and conventions whenever you scaffold or modify a project of that shape."
                chips={<Badge variant="secondary">{skills.length} skills</Badge>}
            />
            {skills.map((skill) => {
                const url = skillUrl(skill.key)
                return (
                    <div key={skill.key} className="mb-4">
                        <SectionCard
                            title={skill.name}
                            icon={skill.icon}
                            action={
                                <Link href={url} external>
                                    <Icon name="download" /> SKILL.md
                                </Link>
                            }
                        >
                            <Text as="p" variant="muted" className="mb-3">
                                {skill.description}
                            </Text>
                            <div className="row g-3">
                                <div className="col-lg-6">
                                    <Heading as="h4" className="mb-2">Project-level</Heading>
                                    <Text as="p" variant="muted" size="small" className="mb-2">
                                        Run from the project root. Available only inside this repository.
                                    </Text>
                                    <CodeSnippet language="bash" code={projectInstall(skill.key)} />
                                </div>
                                <div className="col-lg-6">
                                    <Heading as="h4" className="mb-2">User-level</Heading>
                                    <Text as="p" variant="muted" size="small" className="mb-2">
                                        Available in every Claude Code session on this machine.
                                    </Text>
                                    <CodeSnippet language="bash" code={userInstall(skill.key)} />
                                </div>
                            </div>
                            <Text as="p" variant="muted" size="small" className="mt-3 mb-0">
                                Restart Claude Code (or run <code>/skills</code>) after installing. The skill auto-loads
                                whenever the trigger conditions in its frontmatter match.
                            </Text>
                        </SectionCard>
                    </div>
                )
            })}
        </div>
    )
}
