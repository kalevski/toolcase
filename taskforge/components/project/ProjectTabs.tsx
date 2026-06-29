'use client'

import React, { useCallback, useMemo } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import type { TabBarItem } from '@toolcase/web-components'
import { useTc } from '@/lib/tc'
import { useProject } from '../ProjectContext'

// T1 — the project sub-pages render as a `tc-tab-bar` above the page body
// (matching Wharf's project tab pattern), not as an extra `tc-side-nav` section.
// The sidebar keeps only General + the Projects list, so the two apps' sidebars
// match. The active tab is derived from the URL; clicking a tab routes to it.
//
// No tab icons: tc-tab-bar renders icon SVGs without a sizing class, so a glyph
// would render unsized (cf. Wharf). Labels only.
type Sub = 'overview' | 'tasks' | 'knowledge' | 'agents' | 'notes' | 'run' | 'runs' | 'git' | 'settings'

const TABS: Array<{ id: Sub; label: string; segment: string }> = [
    { id: 'overview', label: 'Overview', segment: '' },
    { id: 'tasks', label: 'Tasks', segment: 'tasks' },
    { id: 'knowledge', label: 'Knowledge', segment: 'knowledge' },
    { id: 'agents', label: 'Agents', segment: 'agents' },
    { id: 'notes', label: 'Notes', segment: 'notes' },
    { id: 'run', label: 'Run', segment: 'run' },
    { id: 'runs', label: 'Run history', segment: 'runs' },
    { id: 'git', label: 'Git', segment: 'git' },
    { id: 'settings', label: 'Settings', segment: 'settings' },
]

export function ProjectTabs() {
    const router = useRouter()
    const pathname = usePathname()
    const { project } = useProject()

    const base = `/projects/${project}`

    // Longest-match: `overview` is the bare base, so it only wins on an exact
    // match; every other section wins on its trailing segment.
    const activeId = useMemo<Sub>(() => {
        const m = pathname.match(/^\/projects\/[^/]+(?:\/(tasks|knowledge|notes|runs|run|git|agents|settings))?\/?$/)
        return (m?.[1] as Sub) ?? 'overview'
    }, [pathname])

    const tabItems = useMemo<TabBarItem[]>(() => TABS.map(({ id, label }) => ({ id, label })), [])

    const onTabChange = useCallback(
        (e: Event) => {
            const id = (e as CustomEvent).detail?.id as Sub | undefined
            const tab = TABS.find((t) => t.id === id)
            if (!tab) return
            const href = tab.segment ? `${base}/${tab.segment}` : base
            if (href !== pathname) router.push(href)
        },
        [base, pathname, router],
    )

    const tabBarRef = useTc<HTMLElement>(
        useMemo(() => ({ tabs: tabItems, activeId }), [tabItems, activeId]),
        { 'tc-change': onTabChange },
    )

    return (
        <div className="tf-project-tabs">
            <tc-tab-bar ref={tabBarRef} />
        </div>
    )
}
