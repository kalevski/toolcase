import React from 'react'

export interface NavScreen {
    id: string
    render: () => React.ReactNode
    title?: React.ReactNode
}

export interface NavigationStackHandle {
    push: (screen: NavScreen) => void
    pop: () => void
    reset: (screen: NavScreen) => void
    current: NavScreen | undefined
}

export interface NavigationStackProps {
    initial: NavScreen
    onChange?: (current: NavScreen | undefined, depth: number) => void
    style?: React.CSSProperties
    className?: string
    showHeader?: boolean
    onBack?: () => void
}

export const NavigationStack = React.forwardRef<NavigationStackHandle, NavigationStackProps>(({ initial, onChange, style, className, showHeader = true, onBack }, ref) => {
    const [stack, setStack] = React.useState<NavScreen[]>([initial])
    const top = stack[stack.length - 1]

    React.useImperativeHandle(ref, () => ({
        push: (screen) => setStack((stk) => [...stk, screen]),
        pop: () => setStack((stk) => stk.length > 1 ? stk.slice(0, -1) : stk),
        reset: (screen) => setStack([screen]),
        current: top,
    }), [top])

    React.useEffect(() => {
        onChange?.(top, stack.length)
    }, [top, stack.length, onChange])

    const handleBack = () => {
        if (stack.length > 1) setStack((stk) => stk.slice(0, -1))
        onBack?.()
    }

    return (
        <div className={className} style={{ display: 'flex', flexDirection: 'column', height: '100%', ...style }}>
            {showHeader && stack.length > 1 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                    <button type="button" onClick={handleBack} style={{ background: 'none', border: 'none', color: '#e6e8ec', cursor: 'pointer', fontSize: 16 }}>
                        ← Back
                    </button>
                    {top?.title && <span style={{ fontWeight: 600, color: '#e6e8ec' }}>{top.title}</span>}
                </div>
            )}
            <div style={{ flex: 1, overflow: 'auto' }}>
                {top?.render()}
            </div>
        </div>
    )
})
NavigationStack.displayName = 'NavigationStack'
