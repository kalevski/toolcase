import { useNavigate } from 'react-router'
import { Badge, Button, CodeSnippet, Heading, Icon, InstallTabs, Link, RichPageHeader, SectionCard, Text } from '@toolcase/react-components'
import { serializerExamples } from '../serializer/index'

const SKILL_URL = 'https://toolcase.kalevski.dev/serializer/SKILL.md'

const projectInstallCmd = `mkdir -p .claude/skills/serializer && \\
    curl -fsSL ${SKILL_URL} -o .claude/skills/serializer/SKILL.md`

const userInstallCmd = `mkdir -p ~/.claude/skills/serializer && \\
    curl -fsSL ${SKILL_URL} -o ~/.claude/skills/serializer/SKILL.md`

export const SerializerPage = () => {
    const navigate = useNavigate()

    return (
        <div className="container py-5">
            <RichPageHeader
                icon={{ name: 'box-seam', color: 'amber' }}
                title="@toolcase/serializer"
                sub="Protobuf-based binary serializer"
                description="Compact binary encoding with schema-driven (de)serialization. Fast under load."
                chips={
                    <>
                        <Badge variant="secondary">Binary</Badge>
                        <Badge variant="secondary">Protobuf</Badge>
                        <Badge variant="secondary">Compact</Badge>
                    </>
                }
            />
            <div className="mb-4">
                <SectionCard title="Install" icon="download">
                    <InstallTabs package="@toolcase/serializer" />
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
                        <code>SKILL.md</code> is a focused reference for <code>@toolcase/serializer</code> that
                        Claude Code loads as a skill. Install it once and Claude can choose the right serializer
                        APIs, explain schema flow, and produce examples with less prompt overhead.
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
                        whenever you work with <code>@toolcase/serializer</code>.
                    </Text>
                </SectionCard>
            </div>
            <SectionCard
                title="Examples"
                icon="box-seam"
                action={<Badge variant="secondary">{serializerExamples.length}</Badge>}
            >
                <div className="row g-2">
                    {serializerExamples.map((example) => (
                        <div key={example.key} className="col-sm-6 col-lg-4">
                            <Button
                                variant="secondary"
                                outline
                                className="w-100 d-flex align-items-center justify-content-between"
                                onClick={() => navigate(`/serializer/${example.key}`)}
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
