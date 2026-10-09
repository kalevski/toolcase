import { useMemo, useRef, type ReactNode } from 'react'
import { useTc } from '@toolcase/web-components/react'
import { t } from '../i18n'

export type DockTab = { id: string; label: string; icon: string; badge?: number }

type Props = {
    variant: 'title' | 'back'
    title: string
    subtitle?: string
    dataKey: string
    onBack: () => void
    offline?: string
    band?: ReactNode
    tabs: DockTab[]
    activeId: string
    onTab: (id: string) => void
    fab?: { label: string; onPress: () => void } | null
    overlay?: ReactNode
    children: ReactNode
}

/**
 * The phone chrome, the dashboard's frame: one tc-mobile-shell with a bar (title, or a back chevron
 * and a title), an optional band under it, exactly one scrolling pane, a bottom tab dock, and an
 * overlay layer for the compose button and the sheets.
 */
export function PhoneFrame({
    variant,
    title,
    subtitle,
    dataKey,
    onBack,
    offline,
    band,
    tabs,
    activeId,
    onTab,
    fab,
    overlay,
    children,
}: Props) {
    const onTabRef = useRef(onTab)
    onTabRef.current = onTab
    const activeRef = useRef(activeId)
    activeRef.current = activeId

    const dockTabs = useMemo(
        () => tabs.map((x) => ({ id: x.id, label: x.label, icon: x.icon, badge: x.badge })),
        [tabs],
    )

    const dock = useTc<HTMLElement>(
        { tabs: dockTabs },
        {
            'tc-tab-dock-change': (e: Event) => {
                e.preventDefault()
                onTabRef.current((e as CustomEvent<{ id: string }>).detail.id)
                dock.current?.setAttribute('active-id', activeRef.current)
            },
            'tc-tab-dock-reselect': (e: Event) => {
                e.preventDefault()
                const pane = document.querySelector('.wm-shell__pane')
                if (pane && pane.scrollTop > 0) pane.scrollTo({ top: 0, behavior: 'smooth' })
                else onTabRef.current((e as CustomEvent<{ id: string }>).detail.id)
            },
        },
    )

    return (
        <tc-mobile-shell className="wm-shell" data-key={dataKey}>
            <header slot="header" className="wm-bar">
                {variant === 'back' ? (
                    <button type="button" className="wm-bar__back" aria-label={t('common.back')} onClick={onBack}>
                        <tc-icon name="ChevronLeft" size="20" decorative></tc-icon>
                    </button>
                ) : null}
                <span className="wm-bar__titles">
                    <h1 className="wm-bar__title">{title}</h1>
                    {subtitle ? <span className="wm-bar__subtitle">{subtitle}</span> : null}
                </span>
            </header>

            {offline ? (
                <div slot="header" className="wm-offline" role="status">
                    {offline}
                </div>
            ) : null}

            {band ? (
                <div slot="header" className="wm-band">
                    {band}
                </div>
            ) : null}

            <div className="wm-shell__pane">{children}</div>

            <div slot="overlay">
                {fab ? (
                    <tc-fab icon="square-pen" label={fab.label} variant="icon" onClick={fab.onPress}></tc-fab>
                ) : null}
                {overlay}
            </div>

            <tc-tab-dock ref={dock} slot="dock" active-id={activeId}></tc-tab-dock>
        </tc-mobile-shell>
    )
}
