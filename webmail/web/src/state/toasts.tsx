import { t } from '../i18n'
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'

export type ToastAction = { label: string; onClick: () => void }

export type ToastInput = {
    message: string
    variant?: 'success' | 'danger' | 'warning' | 'info'
    action?: ToastAction
    /** ms; 0 keeps it until dismissed. Default 5000. */
    duration?: number
    /** A toast with the same key replaces the previous one. */
    key?: string
}

type ToastItem = ToastInput & { id: number }

type ToastApi = {
    show: (t: ToastInput) => number
    dismiss: (id: number) => void
    update: (id: number, patch: Partial<ToastInput>) => void
}

const ToastContext = createContext<ToastApi>({
    show: () => 0,
    dismiss: () => {},
    update: () => {},
})

export function useToasts(): ToastApi {
    return useContext(ToastContext)
}

export function ToastProvider({ children }: { children: ReactNode }) {
    const [items, setItems] = useState<ToastItem[]>([])
    const timers = useRef(new Map<number, number>())
    const nextId = useRef(1)

    const dismiss = useCallback((id: number) => {
        const timer = timers.current.get(id)
        if (timer) window.clearTimeout(timer)
        timers.current.delete(id)
        setItems((list) => list.filter((x) => x.id !== id))
    }, [])

    const arm = useCallback(
        (id: number, duration: number) => {
            const old = timers.current.get(id)
            if (old) window.clearTimeout(old)
            if (duration > 0) timers.current.set(id, window.setTimeout(() => dismiss(id), duration))
        },
        [dismiss],
    )

    const show = useCallback(
        (input: ToastInput) => {
            const id = nextId.current++
            setItems((list) => {
                const kept = input.key ? list.filter((x) => x.key !== input.key) : list
                return [...kept.slice(-3), { ...input, id }]
            })
            arm(id, input.duration ?? 5000)
            return id
        },
        [arm],
    )

    const update = useCallback(
        (id: number, patch: Partial<ToastInput>) => {
            setItems((list) => list.map((x) => (x.id === id ? { ...x, ...patch } : x)))
            if (patch.duration !== undefined) arm(id, patch.duration)
        },
        [arm],
    )

    const api = useMemo(() => ({ show, dismiss, update }), [show, dismiss, update])

    return (
        <ToastContext.Provider value={api}>
            {children}
            <div className="wm-toasts" role="status" aria-live="polite">
                {items.map((item) => (
                    <div key={item.id} className={`wm-toast wm-toast--${item.variant ?? 'info'}`}>
                        <span className="wm-toast__text">{item.message}</span>
                        {item.action ? (
                            <tc-button
                                size="sm"
                                variant="light"
                                onClick={() => {
                                    item.action?.onClick()
                                    dismiss(item.id)
                                }}
                            >
                                {item.action.label}
                            </tc-button>
                        ) : null}
                        <tc-icon-button
                            icon="X"
                            size="small"
                            label={t('common.close')}
                            ontc-click={() => dismiss(item.id)}
                        ></tc-icon-button>
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    )
}
