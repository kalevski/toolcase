'use client'

// Dashboard (spec §4.3): stat cards, live "processing now" card (SSE), 10 most
// recent transcriptions + 5 recent notes.

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { apiFetch, describeApiError } from '@/lib/fetcher'
import { useJobEvents } from '@/lib/sse'
import { humanBytes, humanDuration } from '@/server/domain/format'
import type { StatsResponse } from '@/server/domain/types'
import { LoadingState, ErrorState, EmptyState } from './states'
import { StatusChip } from './transcription/StatusChip'

export function DashboardClient() {
    const [stats, setStats] = useState<StatsResponse | null>(null)
    const [error, setError] = useState<string | null>(null)

    const load = useCallback(async () => {
        setError(null)
        try {
            setStats(await apiFetch<StatsResponse>('/api/stats'))
        } catch (err) {
            setError(describeApiError(err))
        }
    }, [])

    useEffect(() => {
        void load()
    }, [load])

    // Live progress: any job event refreshes the aggregates; progress-only
    // updates patch the processing card in place (no refetch storm).
    useJobEvents((event) => {
        if (event.replay) return
        setStats((prev) => {
            if (!prev) return prev
            if (prev.processing && event.id === prev.processing.id && event.status === 'processing') {
                return { ...prev, processing: { ...prev.processing, progress: event.progress } }
            }
            return prev
        })
        if (event.status !== 'processing') void load()
    })

    const cards = useMemo(() => {
        if (!stats) return []
        return [
            { label: 'Transcriptions', value: String(stats.totalTranscriptions) },
            { label: 'Minutes transcribed', value: String(stats.minutesTranscribed) },
            { label: 'In queue', value: String(stats.queued) },
            { label: 'Failed', value: String(stats.failed) },
            {
                label: 'Disk used',
                value: stats.quotaBytes
                    ? `${humanBytes(stats.diskUsedBytes)} / ${humanBytes(stats.quotaBytes)}`
                    : humanBytes(stats.diskUsedBytes),
            },
            { label: 'Notes', value: String(stats.noteCount) },
        ]
    }, [stats])

    if (error) return <ErrorState message={error} onRetry={load} />
    if (!stats) return <LoadingState shape="cards" count={6} />

    return (
        <div className="voxscribe-page">
            <h1>Dashboard</h1>

            <div className="voxscribe-card-grid">
                {cards.map((card) => (
                    <div className="voxscribe-card" key={card.label}>
                        <div className="voxscribe-stat-value">{card.value}</div>
                        <div className="voxscribe-stat-label">{card.label}</div>
                    </div>
                ))}
            </div>

            {stats.processing && (
                <div className="voxscribe-card voxscribe-processing-card">
                    <div className="voxscribe-card-title">Processing now</div>
                    <Link href={`/transcriptions/${stats.processing.id}`}>{stats.processing.title}</Link>
                    <tc-progress value={stats.processing.progress} max={100} striped animated />
                    <span>{stats.processing.progress}%</span>
                </div>
            )}

            <h2>Recent transcriptions</h2>
            {stats.recent.length === 0 ? (
                <EmptyState icon="mic" title="No transcriptions yet" description="Upload your first audio to get started.">
                    <Link href="/new" className="btn btn-primary">
                        Upload your first audio
                    </Link>
                </EmptyState>
            ) : (
                <ul className="voxscribe-recent-list">
                    {stats.recent.map((t) => (
                        <li key={t.id}>
                            <Link href={`/transcriptions/${t.id}`}>{t.title}</Link>
                            <span className="voxscribe-muted">{humanDuration(t.durationSeconds)}</span>
                            <StatusChip status={t.status} progress={t.progress} queuePosition={t.queuePosition} />
                        </li>
                    ))}
                </ul>
            )}

            <h2>Recent notes</h2>
            {stats.recentNotes.length === 0 ? (
                <EmptyState icon="notebook-pen" title="No notes yet" description="Write your first note.">
                    <Link href="/notes/new" className="btn btn-primary">
                        Write your first note
                    </Link>
                </EmptyState>
            ) : (
                <ul className="voxscribe-recent-list">
                    {stats.recentNotes.map((n) => (
                        <li key={n.id}>
                            <Link href={`/notes/${n.id}`}>{n.title}</Link>
                            <span className="voxscribe-muted">{n.noteDate}</span>
                            <span className="voxscribe-tag-row">
                                {n.tags.map((tag) => (
                                    <tc-badge key={tag} variant="secondary" text={tag} />
                                ))}
                            </span>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    )
}
