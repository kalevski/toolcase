import { useNavigate } from 'react-router'
import { Badge, Button, CodeSnippet, Heading, Icon, InstallTabs, Link, RichPageHeader, SectionCard, Text } from '@toolcase/react-components'
import { baseExamples, baseCategories, type BaseCategory } from '../base/index'

const SKILL_URL = 'https://toolcase.kalevski.dev/base/SKILL.md'

const projectInstallCmd = `mkdir -p .claude/skills/base && \\
    curl -fsSL ${SKILL_URL} -o .claude/skills/base/SKILL.md`

const userInstallCmd = `mkdir -p ~/.claude/skills/base && \\
    curl -fsSL ${SKILL_URL} -o ~/.claude/skills/base/SKILL.md`

const categoryIcons: Record<BaseCategory, string> = {
    'Events & State': 'broadcast',
    'Data Structures': 'diagram-3',
    'Generation & Validation': 'gear',
    'Utilities & Colors': 'palette',
}

export const BasePage = () => {
    const navigate = useNavigate()

    return (
        <div className="container py-5">
            <RichPageHeader
                icon={{ name: 'tools', color: 'blue' }}
                title="@toolcase/base"
                sub="Helpers and data structures — zero dependencies"
                description={`${baseExamples.length} examples covering events, state, data structures, generation, validation, and color utilities.`}
                chips={
                    <>
                        <Badge variant="secondary">TypeScript</Badge>
                        <Badge variant="secondary">Zero deps</Badge>
                        <Badge variant="secondary">Tree-shakeable</Badge>
                    </>
                }
            />
            <div className="mb-4">
                <SectionCard title="Install" icon="download">
                    <InstallTabs package="@toolcase/base" />
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
                        <code>SKILL.md</code> is a focused reference for <code>@toolcase/base</code> that
                        Claude Code loads as a skill. Install it once and Claude can pick the right utility,
                        explain API details, and compose examples without you re-explaining the package.
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
                        whenever you work with <code>@toolcase/base</code>.
                    </Text>
                </SectionCard>
            </div>
            {baseCategories.map((category) => {
                const items = baseExamples.filter((e) => e.category === category)
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
                                            onClick={() => navigate(`/base/${example.key}`)}
                                        >
                                            <span>{example.label}</span>
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
