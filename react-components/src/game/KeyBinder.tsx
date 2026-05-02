import React from 'react'

export interface KeyBinding {
    code: string
    key: string
    ctrl?: boolean
    shift?: boolean
    alt?: boolean
    meta?: boolean
}

export interface KeyBinderProps {
    value?: KeyBinding | null
    placeholder?: string
    onChange?: (binding: KeyBinding) => void
    onCancel?: () => void
    disabled?: boolean
    style?: React.CSSProperties
    className?: string
}

function formatBinding(binding: KeyBinding): string {
    const parts: string[] = []
    if (binding.ctrl) parts.push('Ctrl')
    if (binding.shift) parts.push('Shift')
    if (binding.alt) parts.push('Alt')
    if (binding.meta) parts.push('Meta')
    parts.push(binding.key.length === 1 ? binding.key.toUpperCase() : binding.key)
    return parts.join(' + ')
}

export const KeyBinder: React.FC<KeyBinderProps> = ({ value, placeholder = 'Click to bind', onChange, onCancel, disabled, style, className }) => {
    const [capturing, setCapturing] = React.useState(false)
    const ref = React.useRef<HTMLButtonElement>(null)

    React.useEffect(() => {
        if (!capturing) return
        const onKey = (event: KeyboardEvent) => {
            event.preventDefault()
            event.stopPropagation()
            if (event.key === 'Escape') {
                setCapturing(false)
                onCancel?.()
                return
            }
            const isModifierOnly = ['Control', 'Shift', 'Alt', 'Meta'].includes(event.key)
            if (isModifierOnly) return
            onChange?.({
                code: event.code,
                key: event.key,
                ctrl: event.ctrlKey,
                shift: event.shiftKey,
                alt: event.altKey,
                meta: event.metaKey,
            })
            setCapturing(false)
        }
        window.addEventListener('keydown', onKey, true)
        return () => window.removeEventListener('keydown', onKey, true)
    }, [capturing, onChange, onCancel])

    return (
        <button
            ref={ref}
            type="button"
            disabled={disabled}
            onClick={() => setCapturing(true)}
            onBlur={() => setCapturing(false)}
            className={className}
            style={{
                minWidth: 120,
                padding: '8px 12px',
                background: capturing ? 'rgba(106,169,255,0.2)' : 'rgba(15,18,24,0.85)',
                color: capturing ? '#6aa9ff' : '#e6e8ec',
                border: `1px solid ${capturing ? '#6aa9ff' : 'rgba(255,255,255,0.15)'}`,
                borderRadius: 6,
                fontFamily: 'monospace',
                cursor: disabled ? 'not-allowed' : 'pointer',
                ...style,
            }}
        >
            {capturing ? 'Press any key...' : (value ? formatBinding(value) : placeholder)}
        </button>
    )
}
