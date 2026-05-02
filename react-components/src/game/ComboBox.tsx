import React from 'react'

export interface ComboBoxOption<T = string> {
    value: T
    label: string
    keywords?: string[]
}

export interface ComboBoxProps<T = string> {
    options: Array<ComboBoxOption<T>>
    value?: T | null
    placeholder?: string
    onChange?: (value: T) => void
    disabled?: boolean
    className?: string
    style?: React.CSSProperties
}

export function ComboBox<T = string>({ options, value, placeholder = 'Select...', onChange, disabled, className, style }: ComboBoxProps<T>) {
    const [query, setQuery] = React.useState('')
    const [open, setOpen] = React.useState(false)
    const ref = React.useRef<HTMLDivElement>(null)

    React.useEffect(() => {
        const onDoc = (event: MouseEvent) => {
            if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false)
        }
        document.addEventListener('mousedown', onDoc)
        return () => document.removeEventListener('mousedown', onDoc)
    }, [])

    const selected = options.find((option) => option.value === value)
    const filtered = options.filter((option) => {
        if (!query) return true
        const query_lower = query.toLowerCase()
        if (option.label.toLowerCase().includes(query_lower)) return true
        return option.keywords?.some((keyword) => keyword.toLowerCase().includes(query_lower)) ?? false
    })

    return (
        <div ref={ref} className={className} style={{ position: 'relative', minWidth: 200, ...style }}>
            <input
                type="text"
                value={open ? query : (selected?.label ?? '')}
                placeholder={placeholder}
                disabled={disabled}
                onFocus={() => setOpen(true)}
                onChange={(event) => { setQuery(event.target.value); setOpen(true) }}
                style={{
                    width: '100%',
                    padding: '8px 12px',
                    background: 'rgba(15,18,24,0.85)',
                    color: '#e6e8ec',
                    border: '1px solid rgba(255,255,255,0.15)',
                    borderRadius: 6,
                    outline: 'none',
                    boxSizing: 'border-box',
                }}
            />
            {open && filtered.length > 0 && (
                <ul style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    margin: 0,
                    marginTop: 4,
                    padding: 4,
                    listStyle: 'none',
                    background: 'rgba(15,18,24,0.95)',
                    border: '1px solid rgba(255,255,255,0.15)',
                    borderRadius: 6,
                    maxHeight: 240,
                    overflowY: 'auto',
                    zIndex: 1000,
                }}>
                    {filtered.map((option, index) => (
                        <li
                            key={index}
                            onMouseDown={() => { onChange?.(option.value); setOpen(false); setQuery('') }}
                            style={{ padding: '6px 8px', borderRadius: 4, cursor: 'pointer', color: '#e6e8ec' }}
                            onMouseEnter={(event) => { event.currentTarget.style.background = 'rgba(255,255,255,0.08)' }}
                            onMouseLeave={(event) => { event.currentTarget.style.background = 'transparent' }}
                        >
                            {option.label}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    )
}
