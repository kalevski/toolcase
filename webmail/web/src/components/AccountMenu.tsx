import { useEffect, useRef, useState } from 'react'
import type { Branding } from '../api/session'
import { t } from '../i18n'

type Props = {
    address: string
    branding: Branding
    onSettings: () => void
    onShortcuts: () => void
    onSignOut: () => void
}

/**
 * Who is signed in, top right of the desktop bar: an avatar button opening a small menu with the address and the
 * account actions. Sign out sits behind the menu, so a slip next to Settings no longer ends the session.
 */
export function AccountMenu({ address, branding, onSettings, onShortcuts, onSignOut }: Props) {
    const [open, setOpen] = useState(false)
    const root = useRef<HTMLDivElement>(null)
    const button = useRef<HTMLButtonElement>(null)

    useEffect(() => {
        if (!open) return
        const onDown = (e: PointerEvent) => {
            if (!root.current?.contains(e.target as Node)) setOpen(false)
        }
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.stopPropagation()
                setOpen(false)
                button.current?.focus()
            }
        }
        document.addEventListener('pointerdown', onDown)
        document.addEventListener('keydown', onKey, true)
        return () => {
            document.removeEventListener('pointerdown', onDown)
            document.removeEventListener('keydown', onKey, true)
        }
    }, [open])

    const pick = (fn: () => void) => () => {
        setOpen(false)
        fn()
    }
    const standing = branding.known && branding.domain ? `${branding.name} · ${branding.domain}` : branding.name

    return (
        <div className="wm-account" ref={root}>
            <button
                ref={button}
                type="button"
                className="wm-account__button"
                aria-haspopup="menu"
                aria-expanded={open}
                aria-label={`${t('shell.accountMenu')}: ${address}`}
                onClick={() => setOpen((o) => !o)}
            >
                <span className="wm-account__avatar" aria-hidden="true">
                    {address.slice(0, 1)}
                </span>
                <span className="wm-account__address">{address}</span>
                <tc-icon name="ChevronDown" size="14" decorative></tc-icon>
            </button>
            {open ? (
                <div className="wm-account__menu" role="menu">
                    <div className="wm-account__who">
                        <span className="wm-account__name">{address}</span>
                        <span className="wm-account__standing">{standing}</span>
                    </div>
                    <button type="button" role="menuitem" className="wm-account__item" onClick={pick(onSettings)}>
                        <tc-icon name="Settings" size="16" decorative></tc-icon>
                        {t('shell.settings')}
                    </button>
                    <button type="button" role="menuitem" className="wm-account__item wm-hide-coarse" onClick={pick(onShortcuts)}>
                        <tc-icon name="Keyboard" size="16" decorative></tc-icon>
                        {t('shell.shortcuts')}
                        <tc-kbd>?</tc-kbd>
                    </button>
                    <button type="button" role="menuitem" className="wm-account__item wm-account__item--danger" onClick={pick(onSignOut)}>
                        <tc-icon name="LogOut" size="16" decorative></tc-icon>
                        {t('shell.signOut')}
                    </button>
                </div>
            ) : null}
        </div>
    )
}
