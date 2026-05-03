import { useNavigate } from 'react-router'
import { Badge, Button, CodeSnippet, Heading, Icon, InstallTabs, Link, RichPageHeader, SectionCard, Text } from '@toolcase/react-components'
import { loggingExamples } from '../logging/index'

const SKILL_URL = 'https://toolcase.kalevski.dev/logging/SKILL.md'

const projectInstallCmd = `mkdir -p .claude/skills/logging && \\
    curl -fsSL ${SKILL_URL} -o .claude/skills/logging/SKILL.md`

const userInstallCmd = `mkdir -p ~/.claude/skills/logging && \\
    curl -fsSL ${SKILL_URL} -o ~/.claude/skills/logging/SKILL.md`

export const LoggingPage = () => {
    const navigate = useNavigate()

    return (
        <div className="container py-5">
            <RichPageHeader
                icon={{ name: 'journal-text', color: 'emerald' }}
                title="@toolcase/logging"
                sub="Lightweight logger for Node.js and Browser"
                description="Scoped loggers, custom reporters, log levels — zero dependencies."
                chips={
                    <>
                        <Badge variant="secondary">Node.js</Badge>
                        <Badge variant="secondary">Browser</Badge>
                        <Badge variant="secondary">Zero deps</Badge>
                    </>
                }
            />
            <div className="mb-4">
                <SectionCard title="Install" icon="download">
                    <InstallTabs package="@toolcase/logging" />
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
                        <code>SKILL.md</code> is a focused reference for <code>@toolcase/logging</code> that
                        Claude Code loads as a skill. Install it once and Claude can pick logger patterns,
                        configure reporters, and wire levels without you re-explaining the package.
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
                        whenever you work with <code>@toolcase/logging</code>.
                    </Text>
                </SectionCard>
            </div>
            <SectionCard
                title="Examples"
                icon="journal-text"
                action={<Badge variant="secondary">{loggingExamples.length}</Badge>}
            >
                <div className="row g-2">
                    {loggingExamples.map((example) => (
                        <div key={example.key} className="col-sm-6 col-lg-4">
                            <Button
                                variant="secondary"
                                outline
                                className="w-100 d-flex align-items-center justify-content-between"
                                onClick={() => navigate(`/logging/${example.key}`)}
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
}
