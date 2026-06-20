'use client'

import React, {
    createContext,
    useContext,
    MouseEvent,
    useEffect,
    useId,
    useRef,
    useState,
    Children,
    isValidElement,
} from 'react'

// ── ModalControl ───────────────────────────────────────────────────────────────
// Self-contained stacked-modal registry with a minimal change-event emitter.

export type ModalDef = {
    key: string
    input: any
    handlePayload?: (payload: any) => void
}

const CHANGE_EVENT = 'change'

class ModalControl {
    private defs: ModalDef[] = []
    private listeners = new Set<() => void>()

    on(_event: string, fn: () => void): void {
        this.listeners.add(fn)
    }

    off(_event: string, fn: () => void): void {
        this.listeners.delete(fn)
    }

    private emit(): void {
        this.listeners.forEach((fn) => fn())
    }

    get current(): ModalDef | null {
        return this.defs.length > 0 ? this.defs[this.defs.length - 1] : null
    }

    open(key: string, input?: any, handlePayload?: (payload: any) => void): boolean {
        if (this.defs.some((def) => def.key === key)) {
            return false
        }
        this.defs.push({ key, input, handlePayload })
        this.emit()
        return true
    }

    close(key?: string, payload?: any): boolean {
        if (key) {
            const index = this.defs.findIndex((def) => def.key === key)
            if (index === -1) return false
            const def = this.defs[index]
            this.defs.splice(index, 1)
            if (def.handlePayload) def.handlePayload(payload ?? null)
            this.emit()
            return true
        }
        if (this.defs.length === 0) return false
        const def = this.defs.pop()!
        if (def.handlePayload) def.handlePayload(payload ?? null)
        this.emit()
        return true
    }

    getAll(): ModalDef[] {
        return [...this.defs]
    }

    isOpen(key: string): boolean {
        return this.defs.some((def) => def.key === key)
    }

    closeAll(): void {
        const modalsToClose = [...this.defs]
        this.defs = []
        modalsToClose.forEach((def) => {
            if (def.handlePayload) def.handlePayload(null)
        })
        this.emit()
    }
}

// ── ModalContext ───────────────────────────────────────────────────────────────

const modalControl = new ModalControl()

const ModalContextValue = createContext<ModalControl | null>(null)

export interface ModalContextProps {
    children: React.ReactNode
}

export function ModalContext({ children }: ModalContextProps) {
    return <ModalContextValue.Provider value={modalControl}>{children}</ModalContextValue.Provider>
}

function useModalControl(): ModalControl {
    const context = useContext(ModalContextValue)
    if (!context) {
        throw new Error('useModalControl must be used within a ModalContext')
    }
    return context
}

// ── hooks ──────────────────────────────────────────────────────────────────────

export function useModalOpen<Payload = any, Input = any>(
    key: string,
    handlePayload?: (payload: Payload | null) => void,
): (input?: Input) => boolean {
    const control = useModalControl()
    return (input?: Input) => control.open(key, input, handlePayload)
}

export function useModalClose<Payload = any>(key?: string): (payload?: Payload) => boolean {
    const control = useModalControl()
    return (payload?: Payload) => {
        if (key) {
            return control.close(key, payload)
        }
        const current = control.current
        if (!current) {
            throw new Error(
                'useModalClose: No current modal to close. Either provide a key or call from within a modal.',
            )
        }
        return control.close(undefined, payload)
    }
}

export function useCurrentModal(): string | null {
    const control = useModalControl()
    const current = control.current
    return current ? current.key : null
}

export function useModalInput<Input = any>(): Input | null {
    const control = useModalControl()
    const current = control.current
    return current ? current.input : null
}

export function useModalCloseAll(): () => void {
    const control = useModalControl()
    return () => control.closeAll()
}

// ── Window ─────────────────────────────────────────────────────────────────────

export interface WindowProps {
    children: React.ReactNode
    size: 'small' | 'medium' | 'large' | 'xlarge' | 'full'
    className?: string
    title?: string
}

export function Window({ children, size = 'medium', className = '', title }: WindowProps) {
    const handleClick = (e: MouseEvent) => {
        e.stopPropagation()
    }

    const titleId = useId()

    return (
        <div
            className={`component-modals__window component-modals__window--${size}${className ? ` ${className}` : ''}`}
            onClick={handleClick}
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? titleId : undefined}
            tabIndex={-1}
        >
            {title && (
                <span id={titleId} className="visually-hidden">
                    {title}
                </span>
            )}
            {children}
        </div>
    )
}

// ── ModalRender ──────────────────────────────────────────────────────────────

export interface ModalRenderProps {
    children: React.ReactNode
    className?: string
}

const FOCUSABLE = [
    'a[href]',
    'button:not([disabled])',
    'textarea:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
].join(', ')

export function ModalRender({ children, className = '' }: ModalRenderProps) {
    const [windows, setWindows] = useState<Map<string, React.ReactElement>>(
        () =>
            new Map(
                Children.toArray(children)
                    .filter((child): child is React.ReactElement => isValidElement(child) && child.key != null)
                    .map((child) => [String(child.key).substring(2), child] as [string, React.ReactElement]),
            ),
    )

    useEffect(() => {
        setWindows(
            new Map(
                Children.toArray(children)
                    .filter((child): child is React.ReactElement => isValidElement(child) && child.key != null)
                    .map((child) => [String(child.key).substring(2), child] as [string, React.ReactElement]),
            ),
        )
    }, [children])

    const control = useModalControl()
    const [currentModal, setCurrentModal] = useState<string | null>(null)
    const backdropRef = useRef<HTMLDivElement>(null)
    const previousFocusRef = useRef<HTMLElement | null>(null)

    useEffect(() => {
        const handleChange = () => {
            const current = control.current
            setCurrentModal(current ? current.key : null)
        }

        handleChange()
        control.on(CHANGE_EVENT, handleChange)

        return () => {
            control.off(CHANGE_EVENT, handleChange)
        }
    }, [control])

    const handleBackdropClick = (e: MouseEvent) => {
        if (e.target === e.currentTarget) {
            control.close()
        }
    }

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!backdropRef.current) return

            if (e.key === 'Escape' && currentModal) {
                control.close()
                return
            }

            if (e.key === 'Tab') {
                const focusable = Array.from(backdropRef.current.querySelectorAll<HTMLElement>(FOCUSABLE))
                if (focusable.length === 0) {
                    e.preventDefault()
                    return
                }
                const first = focusable[0]
                const last = focusable[focusable.length - 1]
                if (e.shiftKey) {
                    if (document.activeElement === first) {
                        e.preventDefault()
                        last.focus()
                    }
                } else {
                    if (document.activeElement === last) {
                        e.preventDefault()
                        first.focus()
                    }
                }
            }
        }

        if (currentModal) {
            previousFocusRef.current = document.activeElement as HTMLElement
            document.addEventListener('keydown', handleKeyDown)
            document.body.style.overflow = 'hidden'

            requestAnimationFrame(() => {
                if (!backdropRef.current) return
                const focusable = backdropRef.current.querySelector<HTMLElement>(FOCUSABLE)
                focusable?.focus()
            })
        } else {
            document.body.style.overflow = ''
            previousFocusRef.current?.focus()
            previousFocusRef.current = null
        }

        return () => {
            document.removeEventListener('keydown', handleKeyDown)
            document.body.style.overflow = ''
        }
    }, [currentModal, control])

    const modalToRender = windows.get(currentModal || '') || null

    const isModalOpen = currentModal !== null
    const renderClassName = `component-modals__render${className ? ` ${className}` : ''}${
        !isModalOpen ? ' component-modals__render--closed' : ''
    }`

    return (
        <div
            ref={backdropRef}
            className={renderClassName}
            onClick={handleBackdropClick}
            style={{ display: isModalOpen ? 'flex' : 'none' }}
        >
            {modalToRender}
        </div>
    )
}
