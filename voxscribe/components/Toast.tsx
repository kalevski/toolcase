'use client'

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'
import { useTc } from '@/lib/tc'

// App-wide toast notifications (plan Phase 1). Async actions (redeploy, role
// change, saving limits) used to report success as easily-missed inline text or
// not at all. `useToast().show(...)` drops a transient `tc-toast` into a fixed
// bottom-right stack; each auto-hides and removes itself on `tc-hidden`.

export type ToastVariant = 'success' | 'error' | 'info' | 'warning'

interface ToastItem {
    id: number
    message: string
    variant: ToastVariant
    title?: string
}

interface ToastApi {
    show: (message: string, opts?: { variant?: ToastVariant; title?: string }) => void
}

const ToastContext = createContext<ToastApi | null>(null)

/** Show transient toasts. A no-op outside the provider so callers stay safe. */
export function useToast(): ToastApi {
    return useContext(ToastContext) ?? { show: () => {} }
}

// One live toast. `open` shows it on connect; `autohide`+`delay` dismiss it; the
// `tc-hidden` CustomEvent (via the lib/tc.ts bridge) tells us to drop it from state.
function ToastItemView({ item, onDone }: { item: ToastItem; onDone: (id: number) => void }) {
    const ref = useTc<HTMLElement>(undefined, { 'tc-hidden': () => onDone(item.id) })
    // autohide defaults to true; delay is 5s.
    return (
        <tc-toast ref={ref} open variant={item.variant} title={item.title} delay={5000}>
            {item.message}
        </tc-toast>
    )
}

export function ToastProvider({ children }: { children: ReactNode }) {
    const [items, setItems] = useState<ToastItem[]>([])
    const nextId = useRef(1)

    const show = useCallback<ToastApi['show']>((message, opts) => {
        const id = nextId.current++
        setItems((prev) => [...prev, { id, message, variant: opts?.variant ?? 'info', title: opts?.title }])
    }, [])

    const onDone = useCallback((id: number) => setItems((prev) => prev.filter((t) => t.id !== id)), [])

    return (
        <ToastContext.Provider value={{ show }}>
            {children}
            <div className="voxscribe-toasts" aria-live="polite" aria-atomic="false">
                {items.map((t) => (
                    <ToastItemView key={t.id} item={t} onDone={onDone} />
                ))}
            </div>
        </ToastContext.Provider>
    )
}
