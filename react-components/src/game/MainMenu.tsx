import React from 'react'

export interface MainMenuItem {
    id: string
    label: string
    disabled?: boolean
    badge?: React.ReactNode
}

export interface MainMenuProps {
    title?: React.ReactNode
    subtitle?: React.ReactNode
    items: MainMenuItem[]
    selectedId?: string
    onSelect?: (item: MainMenuItem) => void
    backdrop?: React.ReactNode
    footer?: React.ReactNode
    style?: React.CSSProperties
    className?: string
}

export const MainMenu: React.FC<MainMenuProps> = ({ title, subtitle, items, selectedId, onSelect, backdrop, footer, style, className }) => {
    const [internal, setInternal] = React.useState<string | null>(null)
    const active = selectedId ?? internal ?? items[0]?.id

    React.useEffect(() => {
        const onKey = (event: KeyboardEvent) => {
            if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown' && event.key !== 'Enter') return
            event.preventDefault()
            const i = items.findIndex((item) => item.id === active)
            if (event.key === 'ArrowDown') {
                const next = items.slice(i + 1).find((item) => !item.disabled) ?? items.find((item) => !item.disabled)
                if (next) setInternal(next.id)
            } else if (event.key === 'ArrowUp') {
                const before = [...items.slice(0, i)].reverse().find((item) => !item.disabled) ?? [...items].reverse().find((item) => !item.disabled)
                if (before) setInternal(before.id)
            } else if (event.key === 'Enter') {
                const it = items.find((item) => item.id === active)
                if (it && !it.disabled) onSelect?.(it)
            }
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [items, active, onSelect])

    return (
        <div className={className} style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e6e8ec', ...style }}>
            {backdrop && <div style={{ position: 'absolute', inset: 0, zIndex: 0 }}>{backdrop}</div>}
            <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', gap: 24, minWidth: 320 }}>
                {title && <h1 style={{ fontSize: 56, margin: 0, letterSpacing: 4, textShadow: '0 4px 20px rgba(0,0,0,0.6)' }}>{title}</h1>}
                {subtitle && <div style={{ opacity: 0.7, marginTop: -16 }}>{subtitle}</div>}
                <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {items.map((item) => {
                        const selected = item.id === active
                        return (
                            <li key={item.id}>
                                <button
                                    type="button"
                                    disabled={item.disabled}
                                    onMouseEnter={() => setInternal(item.id)}
                                    onClick={() => onSelect?.(item)}
                                    style={{
                                        width: '100%',
                                        padding: '12px 18px',
                                        textAlign: 'left',
                                        fontSize: 20,
                                        background: selected ? 'rgba(106,169,255,0.15)' : 'transparent',
                                        color: selected ? '#fff' : item.disabled ? 'rgba(230,232,236,0.4)' : '#e6e8ec',
                                        border: 'none',
                                        borderLeft: `3px solid ${selected ? '#6aa9ff' : 'transparent'}`,
                                        cursor: item.disabled ? 'not-allowed' : 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 12,
                                    }}
                                >
                                    <span style={{ flex: 1 }}>{item.label}</span>
                                    {item.badge}
                                </button>
                            </li>
                        )
                    })}
                </ul>
                {footer && <div style={{ marginTop: 24, opacity: 0.6, fontSize: 12 }}>{footer}</div>}
            </div>
        </div>
    )
}
