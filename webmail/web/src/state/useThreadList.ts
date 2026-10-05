import { useCallback, useEffect, useRef, useState } from 'react'
import type { JmapClient } from '../api/jmap'
import { queryThreads, type ThreadSummary } from '../api/mail'
import { quirks } from '../jmap/quirks'
import type { EmailFilter } from '../jmap/types'

export type ThreadList = {
    threads: ThreadSummary[]
    total: number | null
    loading: boolean
    error: boolean
    hasMore: boolean
    loadMore: () => void
    refresh: () => Promise<void>
    /** Optimistically drop rows (after a move) until the next refresh. */
    removeLocal: (threadIds: string[]) => void
    patchLocal: (threadId: string, patch: Partial<ThreadSummary>) => void
}

/** Conversation list for one filter, paged with position + limit. */
export function useThreadList(jmap: JmapClient, filter: EmailFilter | null, tick: number): ThreadList {
    const [threads, setThreads] = useState<ThreadSummary[]>([])
    const [total, setTotal] = useState<number | null>(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(false)
    const key = JSON.stringify(filter)
    const gen = useRef(0)
    const busy = useRef(false)
    const countRef = useRef(0)
    countRef.current = threads.length

    const load = useCallback(
        async (position: number, limit: number, replace: boolean) => {
            if (!filter) return
            const my = gen.current
            busy.current = true
            setLoading(true)
            setError(false)
            try {
                const page = await queryThreads(jmap, filter, position, limit)
                if (my !== gen.current) return
                setTotal(page.total)
                setThreads((prev) => {
                    if (replace) return page.threads
                    const seen = new Set(prev.map((p) => p.threadId))
                    return [...prev, ...page.threads.filter((p) => !seen.has(p.threadId))]
                })
            } catch {
                if (my === gen.current) setError(true)
            } finally {
                if (my === gen.current) {
                    busy.current = false
                    setLoading(false)
                }
            }
        },
        [jmap, key],
    )

    // New filter: start over.
    useEffect(() => {
        gen.current += 1
        busy.current = false
        setThreads([])
        setTotal(null)
        void load(0, quirks.pageSize, true)
    }, [load])

    const refresh = useCallback(async () => {
        gen.current += 1
        busy.current = false
        await load(0, Math.max(quirks.pageSize, Math.min(countRef.current, 200)), true)
    }, [load])

    // Server-side change: refetch what is on screen.
    const firstTick = useRef(tick)
    useEffect(() => {
        if (tick === firstTick.current) return
        void refresh()
    }, [tick, refresh])

    const hasMore = total === null ? threads.length > 0 && threads.length % quirks.pageSize === 0 : threads.length < total

    const loadMore = useCallback(() => {
        if (busy.current || !hasMore) return
        void load(countRef.current, quirks.pageSize, false)
    }, [hasMore, load])

    const removeLocal = useCallback((ids: string[]) => {
        const drop = new Set(ids)
        setThreads((prev) => prev.filter((p) => !drop.has(p.threadId)))
        setTotal((n) => (n === null ? n : Math.max(0, n - ids.length)))
    }, [])

    const patchLocal = useCallback((threadId: string, patch: Partial<ThreadSummary>) => {
        setThreads((prev) => prev.map((p) => (p.threadId === threadId ? { ...p, ...patch } : p)))
    }, [])

    return { threads, total, loading, error, hasMore, loadMore, refresh, removeLocal, patchLocal }
}
