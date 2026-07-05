'use client'

// Wharf-style sub-navigation (P5). A single entity surface (Routing, Admin) with
// several sibling sub-pages renders a `tc-tab-bar` ABOVE the page body instead of
// flat sidebar items. tc-tab-bar is attribute + property driven (its `tabs` are a
// JS property, not slotted children), so it sits safely inside the relocation
// boundary. Clicking a tab is a client-side router push to that tab's route.

import { useMemo } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import type { TabBarItem } from '@toolcase/web-components'
import { useTc } from '@/lib/tc'

export interface SubTab extends TabBarItem {
    /** The route this tab navigates to (client-side push). */
    href: string
}

export function SubTabBar({ tabs }: { tabs: SubTab[] }) {
    const router = useRouter()
    const pathname = usePathname()

    // The active tab is the one whose href is the longest prefix of the current
    // path (so `/admin/users` matches the Users tab, not the `/admin` hub tab).
    const activeId = useMemo(() => {
        const match = tabs
            .filter((t) => pathname === t.href || pathname.startsWith(`${t.href}/`))
            .sort((a, b) => b.href.length - a.href.length)[0]
        return match?.id ?? ''
    }, [tabs, pathname])

    const onChange = useMemo(
        () => (id: string) => {
            const tab = tabs.find((t) => t.id === id)
            if (tab && tab.href !== pathname) router.push(tab.href)
        },
        [tabs, pathname, router],
    )

    // `tabs` (array) + `onChange` (fn) are element properties; only `active-id`
    // is an attribute (driven on the JSX element below).
    const ref = useTc<HTMLElement>(useMemo(() => ({ tabs, onChange }), [tabs, onChange]))

    return <tc-tab-bar ref={ref} active-id={activeId} className="quaykeeper-sub-tabs" />
}
