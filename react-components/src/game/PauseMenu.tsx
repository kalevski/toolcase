import React from 'react'
import { MainMenu, type MainMenuItem } from './MainMenu'

export interface PauseMenuProps {
    open: boolean
    title?: React.ReactNode
    items: MainMenuItem[]
    selectedId?: string
    onSelect?: (item: MainMenuItem) => void
    onResume?: () => void
    onClose?: () => void
}

export const PauseMenu: React.FC<PauseMenuProps> = ({ open, title = 'Paused', items, selectedId, onSelect, onResume, onClose }) => {
    React.useEffect(() => {
        if (!open) return
        const onKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.preventDefault()
                onResume?.()
                onClose?.()
            }
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [open, onResume, onClose])

    if (!open) return null
    return (
        <div style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(8,10,14,0.75)',
            backdropFilter: 'blur(6px)',
            zIndex: 9000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
        }}>
            <MainMenu title={title} items={items} selectedId={selectedId} onSelect={onSelect} />
        </div>
    )
}
