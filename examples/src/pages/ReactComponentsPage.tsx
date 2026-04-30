import { useNavigate } from 'react-router'
import { Badge, Button, CodeSnippet, Heading, Icon, Link, SectionCard, Text } from '@toolcase/react-components'
import { examples, categories, ExampleCategory } from '../react-components/index'

const SKILL_URL = 'https://toolcase.kalevski.dev/SKILL.md'

const projectInstallCmd = `mkdir -p .claude/skills/react-components && \\
  curl -fsSL ${SKILL_URL} -o .claude/skills/react-components/SKILL.md`

const userInstallCmd = `mkdir -p ~/.claude/skills/react-components && \\
  curl -fsSL ${SKILL_URL} -o ~/.claude/skills/react-components/SKILL.md`

const categoryIcons: Record<ExampleCategory, string> = {
    'Typography & Decoration': 'type',
    'Inputs & Forms': 'input-cursor-text',
    'Buttons & Actions': 'cursor-fill',
    'Layout & Structure': 'columns-gap',
    'Navigation': 'compass',
    'Overlays & Feedback': 'window-stack',
    'Data Display': 'table',
    'Charts & Metrics': 'bar-chart-line',
    'Media & Files': 'images',
    'Identity & People': 'people',
    'Marketing & Landing': 'megaphone',
    'Code & Docs': 'code-slash',
}

const formatLabel = (key: string) => {
    return key.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

export const ReactComponentsPage = () => {
    const navigate = useNavigate()

    return (
        <div className="container py-5">
            <div className="mb-4">
                <Heading as="h1">React Components</Heading>
                <Text as="p" variant="muted">{examples.length} components</Text>
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
                        <code>SKILL.md</code> is a complete component reference (props, types, examples) that
                        Claude Code loads as a skill. Install it once and Claude can pick the right component,
                        look up props, and compose UI without you re-explaining the library.
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
                        whenever you build UI with <code>@toolcase/react-components</code>.
                    </Text>
                </SectionCard>
            </div>
            {categories.map((category) => {
                const items = examples.filter((e) => e.category === category)
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
                                            onClick={() => navigate(`/react-components/${example.key}`)}
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
