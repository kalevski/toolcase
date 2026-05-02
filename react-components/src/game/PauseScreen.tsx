import React from 'react'
import type { MainMenuItem } from './MainMenu'
import { MainMenu } from './MainMenu'

export interface PauseScreenProps {
    open: boolean
    title?: React.ReactNode
    items?: MainMenuItem[]
    onResume?: () => void
    onRestart?: () => void
    onQuit?: () => void
    onSelect?: (item: MainMenuItem) => void
    backdropBlur?: boolean
    style?: React.CSSProperties
    className?: string
}

export const PauseScreen: React.FC<PauseScreenProps> = ({ open, title = 'Paused', items, onResume, onRestart, onQuit, onSelect, backdropBlur = true, style, className }) => {
    const defaultItems: MainMenuItem[] = items ?? [
        { id: 'resume', label: 'Resume' },
        { id: 'restart', label: 'Restart' },
        { id: 'quit', label: 'Quit' },
    ]
    const handle = (item: MainMenuItem) => {
        if (onSelect) onSelect(item)
        if (item.id === 'resume') onResume?.()
        else if (item.id === 'restart') onRestart?.()
        else if (item.id === 'quit') onQuit?.()
    }
    React.useEffect(() => {
        if (!open) return
        const onKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape') { event.preventDefault(); onResume?.() }
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [open, onResume])
    if (!open) return null
    return (
        <div className={className} style={{ position: 'fixed', inset: 0, zIndex: 9000, background: 'rgba(8,10,14,0.7)', backdropFilter: backdropBlur ? 'blur(8px)' : undefined, display: 'flex', alignItems: 'center', justifyContent: 'center', ...style }}>
            <MainMenu title={title} items={defaultItems} onSelect={handle} />
        </div>
    )
}
