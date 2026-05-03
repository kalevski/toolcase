import { useNavigate } from 'react-router'
import { Badge, Button, CodeSnippet, Heading, Icon, InstallTabs, Link, RichPageHeader, SectionCard, Text } from '@toolcase/react-components'
import { phaserExamples, phaserCategories, PhaserCategory } from '../phaser-plus/index'

const SKILL_URL = 'https://toolcase.kalevski.dev/phaser-plus/SKILL.md'

const projectInstallCmd = `mkdir -p .claude/skills/phaser-plus && \\
    curl -fsSL ${SKILL_URL} -o .claude/skills/phaser-plus/SKILL.md`

const userInstallCmd = `mkdir -p ~/.claude/skills/phaser-plus && \\
    curl -fsSL ${SKILL_URL} -o ~/.claude/skills/phaser-plus/SKILL.md`

const categoryIcons: Record<PhaserCategory, string> = {
    'Core': 'box-seam',
    'Layers': 'layers',
    'Features': 'puzzle',
    'Debugging': 'bug',
    'Flow': 'arrow-repeat',
    'Perspective2D': 'grid-3x3',
    'Effects': 'magic',
    'AI': 'compass',
    'Cinema': 'camera-reels',
    'Input': 'controller'
}

export const PhaserPlusPage = () => {
    const navigate = useNavigate()

    return (
        <div className="container py-5">
            <RichPageHeader
                icon={{ name: 'controller', color: 'rose' }}
                title="@toolcase/phaser-plus"
                sub="Unified runtime for Phaser"
                description={`${phaserExamples.length} runnable scenes — Scenes, Features, Debugger, Perspective2D, and Effects.`}
                chips={
                    <>
                        <Badge variant="secondary">Phaser 4</Badge>
                        <Badge variant="secondary">TypeScript</Badge>
                        <Badge variant="secondary">2D Engine</Badge>
                    </>
                }
            />
            <div className="mb-4">
                <SectionCard title="Install" icon="download">
                    <InstallTabs package="@toolcase/phaser-plus" />
                </SectionCard>
            </div>
            <div className="mb-4">
                <SectionCard
                    title="Install as a Claude Code skill"
                    icon="robot"
                    action={
                        <Link href={SKILL_URL} external>
                            <Icon name="download" /> SKILL.md
                        </Link>
                    }
                >
                    <Text as="p" variant="muted" className="mb-3">
                        <code>SKILL.md</code> is a focused reference for <code>@toolcase/phaser-plus</code> that
                        Claude Code loads as a skill. Install it once and Claude can pick scene helpers,
                        compose runtime flows, and wire effects with less manual guidance.
                    </Text>
                    <div className="row g-3">
                        <div className="col-lg-6">
                            <Heading as="h4" className="mb-2">Project-level</Heading>
                            <Text as="p" variant="muted" size="small" className="mb-2">
                                Run from the project root. Available only inside this repository.
                            </Text>
                            <CodeSnippet language="bash" code={projectInstallCmd} />
                        </div>
                        <div className="col-lg-6">
                            <Heading as="h4" className="mb-2">User-level</Heading>
                            <Text as="p" variant="muted" size="small" className="mb-2">
                                Available in every Claude Code session on this machine.
                            </Text>
                            <CodeSnippet language="bash" code={userInstallCmd} />
                        </div>
                    </div>
                    <Text as="p" variant="muted" size="small" className="mt-3 mb-0">
                        Restart Claude Code (or run <code>/skills</code>) after installing. The skill auto-loads
                        whenever you work with <code>@toolcase/phaser-plus</code>.
                    </Text>
                </SectionCard>
            </div>
            {phaserCategories.map((category) => {
                const items = phaserExamples.filter((e) => e.category === category)
                if (items.length === 0) return null
                return (
                    <div key={category} className="mb-4">
                        <SectionCard
                            title={category}
                            icon={categoryIcons[category]}
                            action={<Badge variant="secondary">{items.length}</Badge>}
                        >
                            <div className="row g-2">
                                {items.map((example) => (
                                    <div key={example.key} className="col-sm-6 col-lg-4">
                                        <Button
                                            variant="secondary"
                                            outline
                                            className="w-100 d-flex align-items-center justify-content-between"
                                            onClick={() => navigate(`/phaser-plus/${example.key}`)}
                                        >
                                            <span>{example.title}</span>
                                            <Icon name="arrow-right" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        </SectionCard>
                    </div>
                )
            })}
        </div>
    )
}
