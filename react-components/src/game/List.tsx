import React from 'react'

export interface ListItem<T = unknown> {
    id: string | number
    label?: React.ReactNode
    icon?: React.ReactNode
    meta?: React.ReactNode
    disabled?: boolean
    data?: T
}

export interface ListProps<T = unknown> extends Omit<React.HTMLAttributes<HTMLUListElement>, 'onSelect'> {
    items: Array<ListItem<T>>
    selectedId?: string | number | null
    onSelect?: (item: ListItem<T>) => void
    renderItem?: (item: ListItem<T>, selected: boolean) => React.ReactNode
}

export function List<T = unknown>({ items, selectedId, onSelect, renderItem, style, ...props }: ListProps<T>) {
    const merged: React.CSSProperties = { listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 2, ...style }
    return (
        <ul {...props} style={merged}>
            {items.map((item) => {
                const selected = selectedId === item.id
                return (
                    <li key={item.id}>
                        {renderItem ? renderItem(item, selected) : (
                            <button
                                type="button"
                                disabled={item.disabled}
                                onClick={() => onSelect?.(item)}
                                style={{
                                    display: 'flex',
                                    width: '100%',
                                    alignItems: 'center',
                                    gap: 8,
                                    padding: '8px 12px',
                                    background: selected ? 'rgba(255,255,255,0.10)' : 'transparent',
                                    color: '#e6e8ec',
                                    border: 'none',
                                    borderLeft: selected ? '2px solid #6aa9ff' : '2px solid transparent',
                                    cursor: item.disabled ? 'not-allowed' : 'pointer',
                                    opacity: item.disabled ? 0.5 : 1,
                                    textAlign: 'left',
                                }}
                            >
                                {item.icon}
                                <span style={{ flex: 1 }}>{item.label}</span>
                                {item.meta}
                            </button>
                        )}
                    </li>
                )
            })}
        </ul>
    )
}
