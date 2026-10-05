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
 * The phone chrome: one tc-mobile-shell with an app bar, an optional band under
 * it, exactly one scrolling pane, a bottom tab dock, and an overlay layer for the
 * compose button and sheets. Same frame as the app-template.
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
            <tc-app-bar
                slot="header"
                className="wm-shell__bar"
                variant={variant}
                heading={title}
                subheading={subtitle}
                back-label={t('common.back')}
                truncate
                ontc-app-bar-back={onBack}
            ></tc-app-bar>

            {offline ? (
                <div slot="header" className="wm-offline" role="status">
                    {offline}
                </div>
            ) : null}

            {band ? (
                <div slot="header" className="wm-shell__band">
                    {band}
                </div>
            ) : null}

            <div className="wm-shell__pane">{children}</div>

            <div slot="overlay">
                {fab ? (
                    <tc-fab
                        icon="square-pen"
                        label={fab.label}
                        variant="icon"
                        onClick={fab.onPress}
                    ></tc-fab>
                ) : null}
                {overlay}
            </div>

            <tc-tab-dock ref={dock} slot="dock" active-id={activeId}></tc-tab-dock>
        </tc-mobile-shell>
    )
}
