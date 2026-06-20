'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTcProps } from '@/lib/tc'
import { toTcLines, type TerminalLine } from '@/lib/terminal'
import type { GitBranchList } from '@/server/domain/types'
import { useProject } from '../ProjectContext'
import { helpTexts } from '../helpTexts'

export function GitClient() {
    const { project, git, busy, running, dirty, refreshGit } = useProject()

    const [branches, setBranches] = useState<GitBranchList | null>(null)

    const loadBranches = useCallback(async () => {
        try {
            const b = await fetch(`/api/projects/${project}/git/branches`).then((r) => (r.ok ? r.json() : null))
            if (b) setBranches(b)
        } catch {
            /* transient */
        }
    }, [project])

    // (Re)load on mount and whenever the git status object changes — the SSE
    // `git` event already refreshes `git`, so this keeps the list in step.
    useEffect(() => {
        void loadBranches()
    }, [loadBranches, git])

    // ── terminal ──────────────────────────────────────────────────────────────

    const [lines, setLines] = useState<TerminalLine[]>([
        { kind: 'comment', text: `# git terminal — ${project}/repo` },
        { kind: 'comment', text: '# type a git command (the leading "git" is optional) and press Enter' },
    ])
    const [input, setInput] = useState('')
    const [history, setHistory] = useState<string[]>([])
    const [histIdx, setHistIdx] = useState(-1) // -1 = live input
    const [pending, setPending] = useState(false)
    const wrapRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLInputElement>(null)

    // Memoize: the command input re-renders this component on every keystroke;
    // a fresh toTcLines() array each time would rebuild the whole terminal.
    const tcLines = useMemo(() => toTcLines(lines), [lines])
    const termRef = useTcProps<HTMLElement>({ lines: tcLines })

    // keep the output pinned to the bottom as new lines arrive
    useEffect(() => {
        const body = wrapRef.current?.querySelector('.tc-terminal-window-body')
        if (body) body.scrollTop = body.scrollHeight
    }, [tcLines])

    const runCommand = useCallback(async () => {
        const command = input.trim()
        if (!command || pending || busy) return
        setInput('')
        setHistIdx(-1)
        setHistory((h) => (h[h.length - 1] === command ? h : [...h, command]))
        setLines((ls) => [...ls, { kind: 'input', text: command }])
        setPending(true)
        try {
            const res = await fetch(`/api/projects/${project}/git/exec`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ command }),
            })
            const data = await res.json().catch(() => ({}))
            const out: TerminalLine[] = []
            if (!res.ok) {
                out.push({ kind: 'error', text: data.error ?? `request failed (${res.status})` })
            } else {
                const failed = data.code !== 0
                for (const l of String(data.stdout ?? '').split('\n')) {
                    if (l.length) out.push({ kind: 'output', text: l })
                }
                for (const l of String(data.stderr ?? '').split('\n')) {
                    if (l.length) out.push({ kind: failed ? 'error' : 'comment', text: l })
                }
                if (failed) {
                    out.push({ kind: 'error', text: data.code === null ? 'killed (timeout)' : `exit ${data.code}` })
                }
            }
            setLines((ls) => [...ls, ...out])
        } catch {
            setLines((ls) => [...ls, { kind: 'error', text: 'network error' }])
        } finally {
            setPending(false)
            void refreshGit()
            inputRef.current?.focus()
        }
    }, [input, pending, busy, project, refreshGit])

    const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault()
            void runCommand()
        } else if (e.key === 'ArrowUp') {
            if (history.length === 0) return
            e.preventDefault()
            const next = histIdx === -1 ? history.length - 1 : Math.max(0, histIdx - 1)
            setHistIdx(next)
            setInput(history[next])
        } else if (e.key === 'ArrowDown') {
            if (histIdx === -1) return
            e.preventDefault()
            const next = histIdx + 1
            if (next >= history.length) {
                setHistIdx(-1)
                setInput('')
            } else {
                setHistIdx(next)
                setInput(history[next])
            }
        }
    }

    // ── render ────────────────────────────────────────────────────────────────

    return (
        <div className="tf-stack">
            <tc-card>
                <tc-heading slot="header" as="h3">
                    Repository status
                </tc-heading>
                <div className="tf-card-body tf-stack-sm">
                    <div className="tf-kv">
                        <span>Branch</span>
                        <tc-badge variant="secondary">⎇ {git?.branch ?? '—'}</tc-badge>
                    </div>
                    {branches && branches.local.length > 1 && (
                        <div className="tf-kv">
                            <span>Other local branches</span>
                            <tc-text variant="muted">
                                {branches.local.filter((b) => b !== branches.current).join(', ')}
                            </tc-text>
                        </div>
                    )}
                    {branches && branches.remote.length > 0 && (
                        <div className="tf-kv">
                            <span>Remote branches</span>
                            <tc-text variant="muted">{branches.remote.join(', ')}</tc-text>
                        </div>
                    )}
                    <div className="tf-kv">
                        <span>Working tree</span>
                        <span className="tf-inline">
                            <tc-status-dot status={dirty ? 'busy' : 'online'} />
                            {dirty ? `dirty · ${git?.dirtyFiles.length ?? 0} file(s)` : 'clean'}
                        </span>
                    </div>
                    {git && (git.ahead > 0 || git.behind > 0) && (
                        <div className="tf-kv">
                            <span>Sync</span>
                            <tc-badge variant="info">
                                ↑{git.ahead} ↓{git.behind}
                            </tc-badge>
                        </div>
                    )}
                    {git?.remotes?.length ? (
                        <div className="tf-kv">
                            <span>Remotes</span>
                            <tc-text variant="muted">{git.remotes.join(', ')}</tc-text>
                        </div>
                    ) : null}
                </div>
            </tc-card>

            <tc-card>
                <tc-heading slot="header" as="h3">
                    Terminal
                </tc-heading>
                <div className="tf-card-body tf-stack-sm">
                    <div
                        ref={wrapRef}
                        className="tf-git-terminal"
                        onClick={(e) => {
                            // Don't steal focus when the user is selecting terminal output.
                            if (window.getSelection()?.toString()) return
                            if ((e.target as Element).closest('.tf-git-terminal__input')) return
                            inputRef.current?.focus()
                        }}
                    >
                        <tc-terminal-window ref={termRef} title={`git — ${project}`} />
                        <div className="tf-git-terminal__input-row">
                            <span className="tf-git-terminal__prompt">$</span>
                            <input
                                ref={inputRef}
                                className="tf-git-terminal__input"
                                type="text"
                                spellCheck={false}
                                autoComplete="off"
                                placeholder={
                                    busy
                                        ? 'blocked while a run or agent is active'
                                        : pending
                                          ? 'running…'
                                          : 'git status'
                                }
                                disabled={busy || pending}
                                value={input}
                                onChange={(e) => {
                                    setInput(e.target.value)
                                    setHistIdx(-1)
                                }}
                                onKeyDown={onKeyDown}
                                aria-label="Git command"
                            />
                        </div>
                    </div>
                    <tc-helper-text text={helpTexts.git.terminal} />
                </div>
            </tc-card>

            {dirty && git && running && (
                <tc-banner variant="warning">
                    <strong>Working tree is dirty.</strong> Start is blocked until it is clean.
                </tc-banner>
            )}
        </div>
    )
}
