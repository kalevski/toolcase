'use client'

import React, { useEffect } from 'react'
import { Card, Heading, Badge, StatusDot, Button, Banner, Text, Divider } from '@toolcase/react-components'
import type { GitCommit } from '@/server/domain/types'
import { useProject } from '../ProjectContext'

function CommitRow({ c }: { c: GitCommit }) {
    return (
        <div className="tf-kv" style={{ alignItems: 'flex-start' }}>
            <span style={{ flex: 1 }}>
                <code>{c.sha.slice(0, 8)}</code> {c.subject}
            </span>
            <Text variant="muted">{c.author}</Text>
        </div>
    )
}

export function GitClient() {
    const { git, running, config, dirty, commits, loadCommits, onNewBranch, onPush, onGitOp } = useProject()

    useEffect(() => {
        void loadCommits()
    }, [loadCommits])

    return (
        <div className="tf-stack">
            <Card header={<Heading as="h3">Repository status</Heading>}>
                <div className="tf-card-body tf-stack-sm">
                    <div className="tf-kv">
                        <span>Branch</span>
                        <Badge variant="secondary">⎇ {git?.branch ?? '—'}</Badge>
                    </div>
                    <div className="tf-kv">
                        <span>Working tree</span>
                        <span className="tf-inline">
                            <StatusDot status={dirty ? 'busy' : 'online'} />
                            {dirty ? 'dirty' : 'clean'}
                        </span>
                    </div>
                    {git && (git.ahead > 0 || git.behind > 0) && (
                        <div className="tf-kv">
                            <span>Sync</span>
                            <Badge variant="info">
                                ↑{git.ahead} ↓{git.behind}
                            </Badge>
                        </div>
                    )}
                    {git?.remotes?.length ? (
                        <div className="tf-kv">
                            <span>Remotes</span>
                            <Text variant="muted">{git.remotes.join(', ')}</Text>
                        </div>
                    ) : null}

                    <Divider />

                    <div className="tf-actions">
                        <Button
                            variant="secondary"
                            outline
                            disabled={running}
                            onClick={onNewBranch}
                            startIcon={<span>＋</span>}
                        >
                            New branch
                        </Button>
                        <Button variant="secondary" outline disabled={running} onClick={() => onGitOp('fetch')}>
                            Fetch
                        </Button>
                        <Button
                            variant="secondary"
                            outline
                            disabled={running || (git ? git.behind === 0 : false)}
                            title={git && git.behind === 0 ? 'Nothing to pull.' : 'Fast-forward only'}
                            onClick={() => onGitOp('pull')}
                        >
                            Pull
                        </Button>
                        <Button
                            variant="danger"
                            outline
                            disabled={running || !dirty}
                            title={dirty ? 'Hard-reset the working tree' : 'Working tree is already clean.'}
                            onClick={() => onGitOp('discard')}
                        >
                            Discard changes
                        </Button>
                        <Button
                            variant="primary"
                            outline
                            disabled={running || !config.canPush}
                            title={config.canPush ? '' : 'Configure GIT_REMOTE_TOKEN or an SSH key to enable push.'}
                            onClick={onPush}
                        >
                            Push
                        </Button>
                    </div>
                </div>
            </Card>

            <Card
                header={
                    <Heading as="h3">
                        Unpushed commits {commits.unpushed.length > 0 && <Badge variant="info">{commits.unpushed.length}</Badge>}
                    </Heading>
                }
            >
                <div className="tf-card-body tf-stack-sm">
                    {commits.unpushed.length === 0 ? (
                        <Text variant="muted">Nothing waiting to push — local branch is in sync with its upstream.</Text>
                    ) : (
                        commits.unpushed.map((c) => <CommitRow key={c.sha} c={c} />)
                    )}
                </div>
            </Card>

            <Card header={<Heading as="h3">Recent history</Heading>}>
                <div className="tf-card-body tf-stack-sm">
                    {commits.recent.length === 0 ? (
                        <Text variant="muted">No commits yet.</Text>
                    ) : (
                        commits.recent.map((c) => <CommitRow key={c.sha} c={c} />)
                    )}
                </div>
            </Card>

            {dirty && git && (
                <Banner variant="warning" icon="exclamation-triangle">
                    <strong>Working tree is dirty.</strong> Start is blocked until it is clean. Uncommitted:
                    <ul style={{ margin: '0.5rem 0 0', paddingLeft: '1.25rem' }}>
                        {git.dirtyFiles.slice(0, 20).map((f) => (
                            <li key={f}>
                                <code>{f}</code>
                            </li>
                        ))}
                    </ul>
                    {git.dirtyFiles.length > 20 && <Text variant="muted">…and {git.dirtyFiles.length - 20} more.</Text>}
                </Banner>
            )}
        </div>
    )
}
