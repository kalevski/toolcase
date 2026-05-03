import { useNavigate } from 'react-router'
import { Badge, Button, CodeSnippet, Heading, Icon, InstallTabs, Link, RichPageHeader, SectionCard, Text } from '@toolcase/react-components'
import { gameComponentExamples, categories, GameComponentCategory } from '../game-components/index'

const SKILL_URL = 'https://toolcase.kalevski.dev/game-components/SKILL.md'

const projectInstallCmd = `mkdir -p .claude/skills/game-components && \\
    curl -fsSL ${SKILL_URL} -o .claude/skills/game-components/SKILL.md`

const userInstallCmd = `mkdir -p ~/.claude/skills/game-components && \\
    curl -fsSL ${SKILL_URL} -o ~/.claude/skills/game-components/SKILL.md`

const categoryIcons: Record<GameComponentCategory, string> = {
    'Basic Components': 'cube',
    'Layout Primitives': 'grid-3x3',
    'Surfaces': 'square',
    'Typography': 'type',
    'Visual Indicators & Badges': 'gem',
    'Buttons & Navigation': 'mouse',
    'Lists & Selection': 'list-ul',
    'Dialogs & Modals': 'chat-square-text',
    'Progress & Status': 'reception-4',
    'Overlays & Effects': 'stars',
    'Resource Bars': 'heart-pulse',
    'Settings': 'sliders',
    'Visualization': 'bar-chart',
    'Character Management': 'person-circle',
    'Game Screens': 'window-stack',
    'Inventory & Items': 'box-seam',
    'Ability & Skills': 'lightning',
    'Input & Binding': 'keyboard',
    'Map & Navigation': 'map',
    'Social & Communication': 'chat-dots',
    'Progression & Content': 'trophy',
    'Gameplay Panels': 'hammer',
    'Social Panels': 'people',
    'UI Utilities & Specialized': 'tools',
}

const formatLabel = (key: string) => {
    return key.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

export const GameComponentsPage = () => {
    const navigate = useNavigate()

    return (
        <div className="container py-5">
            <RichPageHeader
                icon={{ name: 'puzzle', color: 'pink' }}
                title="@toolcase/game-components"
                sub="Web Components for game UIs"
                description={`${gameComponentExamples.length} HTML5 Web Components — fantasy game UI elements, panels, bars, and overlays.`}
                chips={
                    <>
                        <Badge variant="secondary">Web Components</Badge>
                        <Badge variant="secondary">Framework-agnostic</Badge>
                    </>
                }
            />
            <div className="mb-4">
                <SectionCard title="Install" icon="download">
                    <InstallTabs package="@toolcase/game-components" />
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
                        <code>SKILL.md</code> is a focused reference for <code>@toolcase/game-components</code> that
                        Claude Code loads as a skill. Install it once and Claude can pick the right Web Component,
                        apply props correctly, and compose fantasy UI screens faster.
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
                        whenever you work with <code>@toolcase/game-components</code>.
                    </Text>
                </SectionCard>
            </div>
            {categories.map((category) => {
                const items = gameComponentExamples.filter((e) => e.category === category)
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
                                            onClick={() => navigate(`/game-components/${example.key}`)}
                                        >
                                            <span>{formatLabel(example.key)}</span>
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
