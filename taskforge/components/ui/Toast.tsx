'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import ReactDOM from 'react-dom'
import { Icon } from './Icon'

export type ToastVariant = 'success' | 'error' | 'warning' | 'info'

export type ToastPosition =
    | 'top-right'
    | 'top-left'
    | 'top-center'
    | 'bottom-right'
    | 'bottom-left'
    | 'bottom-center'

export interface ToastOptions {
    id?: string
    title?: string
    duration?: number
    position?: ToastPosition
}

export interface ToastItem {
    id: string
    message: string
    title?: string
    variant: ToastVariant
    duration: number
    position: ToastPosition
}

export interface ToastProviderProps {
    defaultDuration?: number
    defaultPosition?: ToastPosition
    maxToasts?: number
    children?: React.ReactNode
}

type StoreListener = (toasts: ToastItem[]) => void

class ToastStore {
    private items: ToastItem[] = []
    private listeners = new Set<StoreListener>()
    defaultDuration = 4000
    defaultPosition: ToastPosition = 'top-right'
    maxToasts = 5

    subscribe(listener: StoreListener): () => void {
        this.listeners.add(listener)
        return () => {
            this.listeners.delete(listener)
        }
    }

    private notify(): void {
        this.listeners.forEach((l) => l([...this.items]))
    }

    add(message: string, variant: ToastVariant, options: ToastOptions = {}): string {
        const id = options.id ?? `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
        const position = options.position ?? this.defaultPosition
        const duration = options.duration ?? this.defaultDuration

        const grouped = this.items.filter((t) => t.position === position)
        if (grouped.length >= this.maxToasts) {
            this.items = this.items.filter((t) => t.id !== grouped[0].id)
        }

        this.items = [...this.items, { id, message, variant, duration, position, title: options.title }]
        this.notify()
        return id
    }

    dismiss(id: string): void {
        this.items = this.items.filter((t) => t.id !== id)
        this.notify()
    }

    dismissAll(): void {
        this.items = []
        this.notify()
    }
}

const _store = new ToastStore()

export type ToastFn = {
    (message: string, options?: ToastOptions & { variant?: ToastVariant }): string
    success: (message: string, options?: ToastOptions) => string
    error: (message: string, options?: ToastOptions) => string
    warning: (message: string, options?: ToastOptions) => string
    info: (message: string, options?: ToastOptions) => string
    dismiss: (id: string) => void
    dismissAll: () => void
}

export const toast: ToastFn = Object.assign(
    (message: string, options: ToastOptions & { variant?: ToastVariant } = {}) => {
        const { variant = 'info', ...rest } = options
        return _store.add(message, variant, rest)
    },
    {
        success: (message: string, options?: ToastOptions) => _store.add(message, 'success', options),
        error: (message: string, options?: ToastOptions) => _store.add(message, 'error', options),
        warning: (message: string, options?: ToastOptions) => _store.add(message, 'warning', options),
        info: (message: string, options?: ToastOptions) => _store.add(message, 'info', options),
        dismiss: (id: string) => _store.dismiss(id),
        dismissAll: () => _store.dismissAll(),
    },
)

const VARIANT_ICON: Record<ToastVariant, string> = {
    success: 'check-circle-fill',
    error: 'x-circle-fill',
    warning: 'exclamation-triangle-fill',
    info: 'info-circle-fill',
}

interface ToastItemInternalProps {
    item: ToastItem
    fromBottom: boolean
    onDismiss: (id: string) => void
}

const ToastItemInternal: React.FC<ToastItemInternalProps> = ({ item, fromBottom, onDismiss }) => {
    const [exiting, setExiting] = useState(false)
    const [paused, setPaused] = useState(false)
    const remainingRef = useRef(item.duration)
    const startRef = useRef(0)
    const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

    const triggerDismiss = useCallback(() => {
        setExiting(true)
        setTimeout(() => onDismiss(item.id), 280)
    }, [item.id, onDismiss])

    const startTimer = useCallback(() => {
        if (item.duration === 0) return
        clearTimeout(timerRef.current)
        startRef.current = Date.now()
        timerRef.current = setTimeout(triggerDismiss, remainingRef.current)
    }, [item.duration, triggerDismiss])

    const pauseTimer = useCallback(() => {
        if (item.duration === 0) return
        clearTimeout(timerRef.current)
        remainingRef.current = Math.max(0, remainingRef.current - (Date.now() - startRef.current))
    }, [item.duration])

    useEffect(() => {
        startTimer()
        return () => clearTimeout(timerRef.current)
    }, []) // eslint-disable-line react-hooks/exhaustive-deps

    const handleMouseEnter = () => {
        setPaused(true)
        pauseTimer()
    }
    const handleMouseLeave = () => {
        setPaused(false)
        startTimer()
    }

    const rootClass = [
        'component-toast-item',
        `component-toast-item--${item.variant}`,
        fromBottom ? 'component-toast-item--from-bottom' : 'component-toast-item--from-top',
        exiting ? 'component-toast-item--exiting' : '',
    ]
        .filter(Boolean)
        .join(' ')

    return (
        <div
            className={rootClass}
            role="alert"
            aria-live="polite"
            aria-atomic="true"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
        >
            <span className="component-toast-item__icon" aria-hidden="true">
                <Icon name={VARIANT_ICON[item.variant]} />
            </span>
            <div className="component-toast-item__body">
                {item.title && <div className="component-toast-item__title">{item.title}</div>}
                <div className="component-toast-item__message">{item.message}</div>
            </div>
            <button
                type="button"
                className="component-toast-item__close"
                aria-label="Dismiss notification"
                onClick={triggerDismiss}
            >
                <Icon name="x" aria-hidden={true} />
            </button>
            {item.duration > 0 && (
                <div className="component-toast-item__progress" aria-hidden="true">
                    <div
                        className="component-toast-item__progress-bar"
                        style={{
                            animationDuration: `${item.duration}ms`,
                            animationPlayState: paused ? 'paused' : 'running',
                        }}
                    />
                </div>
            )}
        </div>
    )
}

const ALL_POSITIONS: ToastPosition[] = [
    'top-right',
    'top-left',
    'top-center',
    'bottom-right',
    'bottom-left',
    'bottom-center',
]

export const ToastProvider: React.FC<ToastProviderProps> = ({
    defaultDuration = 4000,
    defaultPosition = 'top-right',
    maxToasts = 5,
    children,
}) => {
    useEffect(() => {
        _store.defaultDuration = defaultDuration
        _store.defaultPosition = defaultPosition
        _store.maxToasts = maxToasts
    }, [defaultDuration, defaultPosition, maxToasts])

    const [toasts, setToasts] = useState<ToastItem[]>([])
    useEffect(() => _store.subscribe(setToasts), [])

    const handleDismiss = useCallback((id: string) => _store.dismiss(id), [])

    const byPosition = ALL_POSITIONS.reduce<Record<ToastPosition, ToastItem[]>>(
        (acc, pos) => {
            acc[pos] = toasts.filter((t) => t.position === pos)
            return acc
        },
        {} as Record<ToastPosition, ToastItem[]>,
    )

    return (
        <>
            {children}
            {typeof document !== 'undefined' &&
                ReactDOM.createPortal(
                    <>
                        {ALL_POSITIONS.map((pos) =>
                            byPosition[pos].length === 0 ? null : (
                                <div
                                    key={pos}
                                    className={`component component-toast-container component-toast-container--${pos}`}
                                    aria-label="Notifications"
                                >
                                    {byPosition[pos].map((item) => (
                                        <ToastItemInternal
                                            key={item.id}
                                            item={item}
                                            fromBottom={pos.startsWith('bottom')}
                                            onDismiss={handleDismiss}
                                        />
                                    ))}
                                </div>
                            ),
                        )}
                    </>,
                    document.body,
                )}
        </>
    )
}
