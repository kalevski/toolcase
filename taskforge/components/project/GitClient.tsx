'use client'

import React, { useCallback, useEffect, useState } from 'react'
import {
    Card,
    Heading,
    Badge,
    StatusDot,
    Button,
    Banner,
    Text,
    Divider,
    Select,
    Tag,
    Table,
    Textarea,
    RadioGroup,
    Drawer,
    DiffViewer,
    Spinner,
    HelperText,
    IconButton,
    toast,
    type TableColumn,
} from '@toolcase/react-components'
import type {
    GitBranchList,
    GitCommit,
    GitCommitDetail,
    GitStashEntry,
    GitStatusFile,
} from '@/server/domain/types'
import { useProject } from '../ProjectContext'
import { useConfirm } from '../ConfirmModal'
import { helpTexts } from '../helpTexts'

const STATUS_CODE_LABEL: Record<string, string> = {
    M: 'modified',
    A: 'added',
    D: 'deleted',
    R: 'renamed',
    C: 'copied',
    U: 'conflict',
    '?': 'untracked',
}

function codeTag(code: string): React.ReactNode {
    if (!code) return null
    const label = STATUS_CODE_LABEL[code] ?? code
    const variant = code === 'D' ? 'danger' : code === '?' ? 'secondary' : code === 'A' ? 'success' : 'warning'
    return <Tag variant={variant}>{label}</Tag>
}

export function GitClient() {
    const { project, git, busy, running, config, dirty, commits, loadCommits, refreshGit, onNewBranch, onPush, onGitOp, modelOptions } =
        useProject()
    const confirm = useConfirm()

    const [branches, setBranches] = useState<GitBranchList | null>(null)
    const [files, setFiles] = useState<GitStatusFile[]>([])
    const [stashes, setStashes] = useState<GitStashEntry[]>([])
    const [historyLimit, setHistoryLimit] = useState(15)

    // commit form
    const [commitMessage, setCommitMessage] = useState('')
    const [commitMode, setCommitMode] = useState<'manual' | 'ai'>('manual')
    const [commitModel, setCommitModel] = useState(config.commitModel)
    const [committing, setCommitting] = useState(false)

    // drawers
    const [diffFile, setDiffFile] = useState<string | null>(null)
    const [diff, setDiff] = useState<{ path: string; before: string; after: string } | null>(null)
    const [detailSha, setDetailSha] = useState<string | null>(null)
    const [detail, setDetail] = useState<GitCommitDetail | null>(null)

    // B7 — push the current branch and open a GitHub PR
    const onOpenPr = useCallback(async () => {
        const res = await fetch(`/api/projects/${project}/git/pr`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({}),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
            toast.error(data.error ?? 'Failed to open PR')
            return
        }
        toast.success('PR opened')
        window.open(data.url, '_blank', 'noreferrer')
        void refreshGit()
        void loadCommits()
    }, [project, refreshGit, loadCommits])

    const loadExtras = useCallback(async () => {
        try {
            const [b, f, s] = await Promise.all([
                fetch(`/api/projects/${project}/git/branches`).then((r) => (r.ok ? r.json() : null)),
                fetch(`/api/projects/${project}/git/files`).then((r) => (r.ok ? r.json() : null)),
                fetch(`/api/projects/${project}/git/stash`).then((r) => (r.ok ? r.json() : null)),
            ])
            if (b) setBranches(b)
            if (f) setFiles(f)
            if (s) setStashes(s)
        } catch {
            /* transient */
        }
    }, [project])

    // (Re)load lists on mount and whenever the git status object changes — the
    // SSE `git` event already refreshes `git`, so this keeps everything in step.
    useEffect(() => {
        void loadExtras()
    }, [loadExtras, git])

    useEffect(() => {
        void loadCommits()
    }, [loadCommits])

    // ── working-tree diff drawer ──────────────────────────────────────────────
    const openDiff = (path: string) => {
        setDiffFile(path)
        setDiff(null)
        fetch(`/api/projects/${project}/git/diff?path=${encodeURIComponent(path)}`)
            .then((r) => (r.ok ? r.json() : Promise.reject()))
            .then((d) => setDiff({ path, before: d.before, after: d.after }))
            .catch(() => setDiff({ path, before: '', after: 'Failed to load diff.' }))
    }

    // ── commit detail drawer ──────────────────────────────────────────────────
    const openDetail = (sha: string) => {
        setDetailSha(sha)
        setDetail(null)
        fetch(`/api/projects/${project}/git/commits/${sha}`)
            .then((r) => (r.ok ? r.json() : Promise.reject()))
            .then(setDetail)
            .catch(() => setDetailSha(null))
    }

    // ── actions ───────────────────────────────────────────────────────────────

    const onSwitchBranch = async (name: string) => {
        if (!branches || name === branches.current) return
        if (dirty) {
            toast.error(helpTexts.git.switchDirty)
            return
        }
        const res = await fetch(`/api/projects/${project}/git/branch`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ switchTo: name }),
        })
        if (res.ok) {
            toast.success(`Switched to ${name}`)
            await refreshGit()
            void loadCommits()
        } else {
            toast.error((await res.json().catch(() => ({}))).error ?? 'Switch failed')
        }
    }

    const onDeleteBranch = async (name: string) => {
        const ok = await confirm({
            title: `Delete branch ${name}?`,
            body: 'Deletes the local branch (safe -d: refuses when unmerged).',
            confirmLabel: 'Delete branch',
            confirmVariant: 'danger',
        })
        if (!ok) return
        let res = await fetch(`/api/projects/${project}/git/branch`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ delete: name }),
        })
        if (!res.ok) {
            const err = (await res.json().catch(() => ({}))).error ?? ''
            // -d refused (unmerged) → offer the force path behind a second confirm
            const force = await confirm({
                title: `Force-delete ${name}?`,
                body: `Safe delete failed (${err}). Force delete (-D) discards the branch's unmerged commits. This cannot be undone.`,
                confirmLabel: 'Force delete',
                confirmVariant: 'danger',
            })
            if (!force) return
            res = await fetch(`/api/projects/${project}/git/branch`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ delete: name, force: true }),
            })
            if (!res.ok) {
                toast.error((await res.json().catch(() => ({}))).error ?? 'Delete failed')
                return
            }
        }
        toast.success(`Deleted ${name}`)
        await refreshGit()
    }

    const onDiscardFile = async (path: string) => {
        const ok = await confirm({
            title: `Discard changes to ${path}?`,
            body: 'Restores the file to HEAD (or deletes it if untracked). This cannot be undone.',
            confirmLabel: 'Discard file',
            confirmVariant: 'danger',
        })
        if (!ok) return
        const res = await fetch(`/api/projects/${project}/git/discard-paths`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ paths: [path] }),
        })
        if (res.ok) {
            toast.success(`Discarded ${path}`)
            await refreshGit()
        } else {
            toast.error((await res.json().catch(() => ({}))).error ?? 'Discard failed')
        }
    }

    const onCommit = async () => {
        setCommitting(true)
        try {
            const res = await fetch(`/api/projects/${project}/git/commit`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(
                    commitMode === 'ai'
                        ? { mode: 'ai', model: commitModel }
                        : { mode: 'manual', message: commitMessage },
                ),
            })
            if (res.ok) {
                const data = await res.json()
                toast.success(`Committed ${data.sha.slice(0, 8)}`)
                setCommitMessage('')
                setHistory(null)
                await refreshGit()
                void loadCommits()
            } else {
                toast.error((await res.json().catch(() => ({}))).error ?? 'Commit failed')
            }
        } finally {
            setCommitting(false)
        }
    }

    const onStash = async () => {
        await onGitOp('stash-push')
        await refreshGit()
    }

    const onStashPopDrop = async (op: 'stash-pop' | 'stash-drop', index: number) => {
        if (op === 'stash-drop') {
            const ok = await confirm({
                title: `Drop stash@{${index}}?`,
                body: 'The stashed changes are discarded permanently.',
                confirmLabel: 'Drop stash',
                confirmVariant: 'danger',
            })
            if (!ok) return
        }
        const res = await fetch(`/api/projects/${project}/git/op`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ op, index }),
        })
        if (res.ok) {
            toast.success(op === 'stash-pop' ? 'Stash popped' : 'Stash dropped')
            await refreshGit()
        } else {
            toast.error((await res.json().catch(() => ({}))).error ?? `${op} failed`)
        }
    }

    const onRevert = async (c: GitCommit) => {
        const ok = await confirm({
            title: `Revert ${c.sha.slice(0, 8)}?`,
            body: `Creates a new commit undoing "${c.subject}". Conflicts abort the revert and surface here.`,
            confirmLabel: 'Revert commit',
            confirmVariant: 'warning',
        })
        if (!ok) return
        const res = await fetch(`/api/projects/${project}/git/revert`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sha: c.sha }),
        })
        if (res.ok) {
            toast.success(`Reverted ${c.sha.slice(0, 8)}`)
            setDetailSha(null)
            setHistory(null)
            await refreshGit()
            void loadCommits()
        } else {
            toast.error((await res.json().catch(() => ({}))).error ?? 'Revert failed')
        }
    }

    // local override so "Load more" can exceed the context's default 15
    const [history, setHistory] = useState<{ unpushed: GitCommit[]; recent: GitCommit[] } | null>(null)
    const shownCommits = history ?? commits

    const loadMoreHistory = async () => {
        const next = historyLimit + 15
        setHistoryLimit(next)
        try {
            const data = await fetch(`/api/projects/${project}/git/commits?limit=${next}`).then((r) =>
                r.ok ? r.json() : null,
            )
            if (data) setHistory(data)
        } catch {
            /* transient */
        }
    }

    // ── tables ────────────────────────────────────────────────────────────────

    const fileColumns: TableColumn<GitStatusFile>[] = [
        {
            key: 'state',
            header: 'State',
            width: '11rem',
            render: (f) => (
                <span style={{ display: 'inline-flex', gap: '0.3rem' }}>
                    {codeTag(f.staged === '?' ? '?' : f.staged)}
                    {f.unstaged && f.unstaged !== '?' && codeTag(f.unstaged)}
                </span>
            ),
        },
        { key: 'path', header: 'File', render: (f) => <code>{f.path}</code> },
        {
            key: 'actions',
            header: '',
            width: '7rem',
            render: (f) => (
                <Button
                    size="small"
                    variant="danger"
                    outline
                    disabled={busy}
                    onClick={(e) => {
                        e.stopPropagation()
                        void onDiscardFile(f.path)
                    }}
                >
                    Discard
                </Button>
            ),
        },
    ]

    const commitRow = (c: GitCommit) => (
        <div key={c.sha} className="tf-kv" style={{ alignItems: 'center', gap: '0.6rem' }}>
            <button
                type="button"
                onClick={() => openDetail(c.sha)}
                style={{
                    flex: 1,
                    textAlign: 'left',
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    cursor: 'pointer',
                    color: 'inherit',
                    font: 'inherit',
                }}
            >
                <code>{c.sha.slice(0, 8)}</code> {c.subject}
            </button>
            <Text variant="muted">{c.author}</Text>
            <IconButton
                icon="arrow-counterclockwise"
                label={`Revert ${c.sha.slice(0, 8)}`}
                variant="warning"
                outline
                disabled={busy || dirty}
                onClick={() => void onRevert(c)}
            />
        </div>
    )

    const localBranchOptions = (branches?.local ?? []).map((b) => ({ value: b, label: b }))

    return (
        <div className="tf-stack">
            <Card header={<Heading as="h3">Repository status</Heading>}>
                <div className="tf-card-body tf-stack-sm">
                    <div className="tf-kv">
                        <span>Branch</span>
                        {branches && localBranchOptions.length > 0 ? (
                            <span title={dirty ? helpTexts.git.switchDirty : 'Switch branch'} style={{ minWidth: 180 }}>
                                <Select
                                    options={localBranchOptions}
                                    value={branches.current}
                                    disabled={busy || dirty}
                                    onChange={(e) => void onSwitchBranch(e.target.value)}
                                />
                            </span>
                        ) : (
                            <Badge variant="secondary">⎇ {git?.branch ?? '—'}</Badge>
                        )}
                    </div>
                    {branches && branches.local.length > 1 && (
                        <div className="tf-kv" style={{ alignItems: 'flex-start' }}>
                            <span>Other local branches</span>
                            <span className="tf-stack-sm" style={{ alignItems: 'flex-end' }}>
                                {branches.local
                                    .filter((b) => b !== branches.current)
                                    .map((b) => (
                                        <span key={b} className="tf-inline">
                                            <code>{b}</code>
                                            <IconButton
                                                icon="trash"
                                                label={`Delete ${b}`}
                                                variant="danger"
                                                outline
                                                disabled={busy}
                                                onClick={() => void onDeleteBranch(b)}
                                            />
                                        </span>
                                    ))}
                            </span>
                        </div>
                    )}
                    {branches && branches.remote.length > 0 && (
                        <div className="tf-kv">
                            <span>Remote branches</span>
                            <Text variant="muted">{branches.remote.join(', ')}</Text>
                        </div>
                    )}
                    <div className="tf-kv">
                        <span>Working tree</span>
                        <span className="tf-inline">
                            <StatusDot status={dirty ? 'busy' : 'online'} />
                            {dirty ? `dirty · ${files.length || git?.dirtyFiles.length || 0} file(s)` : 'clean'}
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
                            disabled={busy}
                            onClick={onNewBranch}
                            startIcon={<span>＋</span>}
                        >
                            New branch
                        </Button>
                        <Button variant="secondary" outline disabled={busy} onClick={() => onGitOp('fetch')}>
                            Fetch
                        </Button>
                        <Button
                            variant="secondary"
                            outline
                            disabled={busy || (git ? git.behind === 0 : false)}
                            title={git && git.behind === 0 ? 'Nothing to pull.' : helpTexts.git.pull}
                            onClick={() => onGitOp('pull')}
                        >
                            Pull
                        </Button>
                        <Button
                            variant="danger"
                            outline
                            disabled={busy || !dirty}
                            title={dirty ? helpTexts.git.discard : 'Working tree is already clean.'}
                            onClick={() => onGitOp('discard')}
                        >
                            Discard all
                        </Button>
                        <Button
                            variant="primary"
                            outline
                            disabled={busy || !config.canPush}
                            title={config.canPush ? '' : 'Configure GIT_REMOTE_TOKEN or an SSH key to enable push.'}
                            onClick={onPush}
                        >
                            Push
                        </Button>
                        <Button
                            variant="primary"
                            disabled={busy || !config.canPush || dirty}
                            title={
                                !config.canPush
                                    ? 'Configure GIT_REMOTE_TOKEN to enable PRs.'
                                    : dirty
                                      ? 'Commit or discard local changes first.'
                                      : 'Push the current branch and open a GitHub PR.'
                            }
                            onClick={() => void onOpenPr()}
                        >
                            ⇡ Open PR
                        </Button>
                    </div>
                    <HelperText text={helpTexts.git.pull} />
                </div>
            </Card>

            {dirty && (
                <Card header={<Heading as="h3">Working tree</Heading>}>
                    <Table
                        columns={fileColumns}
                        data={files}
                        rowKey={(f) => f.path}
                        hoverable
                        emptyMessage="Working tree is clean."
                        onRowClick={(f) => openDiff(f.path)}
                    />
                    <div className="tf-card-body">
                        <HelperText variant="warning" text={helpTexts.git.discard} />
                    </div>
                </Card>
            )}

            <Card header={<Heading as="h3">Commit</Heading>}>
                <div className="tf-card-body tf-stack-sm">
                    <RadioGroup
                        label="Message"
                        inline
                        value={commitMode}
                        options={[
                            { value: 'manual', label: 'Manual' },
                            { value: 'ai', label: 'AI-generated' },
                        ]}
                        onChange={(v) => setCommitMode(v as 'manual' | 'ai')}
                    />
                    {commitMode === 'manual' ? (
                        <Textarea
                            label="Commit message"
                            rows={3}
                            placeholder="feat: describe the change"
                            value={commitMessage}
                            disabled={busy || !dirty}
                            onChange={(e) => setCommitMessage(e.target.value)}
                        />
                    ) : (
                        <div style={{ maxWidth: 280 }}>
                            <Select
                                label="Commit-message model"
                                options={modelOptions}
                                value={commitModel}
                                disabled={busy || !dirty}
                                onChange={(e) => setCommitModel(e.target.value)}
                            />
                        </div>
                    )}
                    <div className="tf-actions">
                        <Button
                            variant="primary"
                            loading={committing}
                            disabled={busy || !dirty || (commitMode === 'manual' && !commitMessage.trim())}
                            title={dirty ? '' : 'Working tree is clean.'}
                            onClick={onCommit}
                        >
                            Commit all
                        </Button>
                    </div>
                    <HelperText text={helpTexts.git.commit} />
                </div>
            </Card>

            <Card
                header={
                    <Heading as="h3">
                        Stash {stashes.length > 0 && <Badge variant="secondary">{stashes.length}</Badge>}
                    </Heading>
                }
            >
                <div className="tf-card-body tf-stack-sm">
                    <div className="tf-actions">
                        <Button variant="secondary" outline disabled={busy || !dirty} onClick={onStash}>
                            Stash working tree
                        </Button>
                    </div>
                    {stashes.length === 0 ? (
                        <Text variant="muted">No stashes.</Text>
                    ) : (
                        stashes.map((s) => (
                            <div key={s.index} className="tf-kv">
                                <span style={{ flex: 1 }}>
                                    <code>stash@{`{${s.index}}`}</code> {s.message}
                                </span>
                                <Button size="small" variant="secondary" outline disabled={busy} onClick={() => void onStashPopDrop('stash-pop', s.index)}>
                                    Pop
                                </Button>
                                <Button size="small" variant="danger" outline disabled={busy} onClick={() => void onStashPopDrop('stash-drop', s.index)}>
                                    Drop
                                </Button>
                            </div>
                        ))
                    )}
                    <HelperText text={helpTexts.git.stash} />
                </div>
            </Card>

            <Card
                header={
                    <Heading as="h3">
                        Unpushed commits{' '}
                        {shownCommits.unpushed.length > 0 && <Badge variant="info">{shownCommits.unpushed.length}</Badge>}
                    </Heading>
                }
            >
                <div className="tf-card-body tf-stack-sm">
                    {shownCommits.unpushed.length === 0 ? (
                        <Text variant="muted">Nothing waiting to push — local branch is in sync with its upstream.</Text>
                    ) : (
                        shownCommits.unpushed.map(commitRow)
                    )}
                </div>
            </Card>

            <Card header={<Heading as="h3">Recent history</Heading>}>
                <div className="tf-card-body tf-stack-sm">
                    {shownCommits.recent.length === 0 ? (
                        <Text variant="muted">No commits yet.</Text>
                    ) : (
                        <>
                            {shownCommits.recent.map(commitRow)}
                            <div className="tf-actions">
                                <Button size="small" variant="secondary" outline onClick={() => void loadMoreHistory()}>
                                    Load more
                                </Button>
                            </div>
                        </>
                    )}
                    <HelperText text={helpTexts.git.revert} />
                </div>
            </Card>

            {dirty && git && running && (
                <Banner variant="warning" icon="exclamation-triangle">
                    <strong>Working tree is dirty.</strong> Start is blocked until it is clean.
                </Banner>
            )}

            {/* per-file diff drawer */}
            <Drawer open={diffFile !== null} onClose={() => setDiffFile(null)} side="right" size="large" title={diffFile ?? ''}>
                <div style={{ padding: '1.25rem' }}>
                    {!diff || diff.path !== diffFile ? (
                        <div style={{ padding: '2rem', textAlign: 'center' }}>
                            <Spinner />
                        </div>
                    ) : (
                        <DiffViewer before={diff.before} after={diff.after} filename={diff.path} />
                    )}
                </div>
            </Drawer>

            {/* commit detail drawer */}
            <Drawer
                open={detailSha !== null}
                onClose={() => setDetailSha(null)}
                side="right"
                size="large"
                title={detailSha ? detailSha.slice(0, 12) : ''}
            >
                <div style={{ padding: '1.25rem' }} className="tf-stack-sm">
                    {!detail ? (
                        <div style={{ padding: '2rem', textAlign: 'center' }}>
                            <Spinner />
                        </div>
                    ) : (
                        <>
                            <Heading as="h3">{detail.commit.subject}</Heading>
                            <Text variant="muted">
                                {detail.commit.author} · {new Date(detail.commit.date).toLocaleString()} ·{' '}
                                <code>{detail.commit.sha}</code>
                            </Text>
                            <div className="tf-actions">
                                <Button
                                    size="small"
                                    variant="warning"
                                    outline
                                    disabled={busy || dirty}
                                    title={dirty ? 'Clean the working tree first.' : helpTexts.git.revert}
                                    onClick={() => void onRevert(detail.commit)}
                                >
                                    Revert this commit
                                </Button>
                            </div>
                            <Divider />
                            <pre className="tf-git-pre">{detail.stat}</pre>
                            <Divider />
                            <pre className="tf-git-pre">
                                {detail.patch}
                                {detail.patchTruncated ? '\n…(patch truncated)…' : ''}
                            </pre>
                        </>
                    )}
                </div>
            </Drawer>
        </div>
    )
}
