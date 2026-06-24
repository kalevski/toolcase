'use client'

// Stacked-modal registry + hooks (unchanged from the old components/ui/modal),
// with the visual layer swapped to the `<tc-modal>` custom element.
//
// `ModalControl`, `ModalContext`, and the `useModal*` hooks are the same React
// orchestration as before. Only `Window`/`ModalRender` changed: tc-modal now
// owns the dialog chrome, backdrop, focus-trap, scroll-lock and Escape handling
// (Bootstrap's Modal plugin), so all of that hand-rolled code is gone.

import React, { createContext, useContext, useEffect, useRef, useState, Children, isValidElement } from 'react'

// ── ModalControl ───────────────────────────────────────────────────────────────

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

// taskforge size → tc-modal `size` attribute (medium = Bootstrap default, no attr).
const SIZE_ATTR: Record<WindowProps['size'], string | undefined> = {
    small: 'sm',
    medium: undefined,
    large: 'lg',
    xlarge: 'xl',
    full: undefined,
}

export function Window({ children, size = 'medium', className, title }: WindowProps) {
    const close = useModalClose()
    const ref = useRef<HTMLElement>(null)
    const closingRef = useRef(false)

    // Open on mount; route the element's own dismiss (Escape / backdrop / X) back
    // through the registry so React state stays the source of truth.
    useEffect(() => {
        const el = ref.current
        if (!el) return
        ;(el as any).open = true
        const onHide = () => {
            if (closingRef.current) return
            closingRef.current = true
            close()
        }
        el.addEventListener('tc-hide', onHide)
        return () => el.removeEventListener('tc-hide', onHide)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const sizeAttr = SIZE_ATTR[size]

    return (
        // tc-modal captures its light-DOM children ONCE on connect and moves them
        // into .modal-body. We pass a SINGLE wrapper element so React only ever
        // mutates inside it — never inserts siblings onto the host (which would
        // land outside .modal-body). Set structural attrs (title/size) once here.
        // @ts-ignore — tc-modal is a registered custom element
        <tc-modal
            ref={ref}
            title={title ?? ''}
            size={sizeAttr}
            fullscreen={size === 'full' ? 'true' : undefined}
        >
            <div className={className}>{children}</div>
        </tc-modal>
    )
}

// ── ModalRender ──────────────────────────────────────────────────────────────

export interface ModalRenderProps {
    children: React.ReactNode
    className?: string
}

export function ModalRender({ children }: ModalRenderProps) {
    const buildMap = () =>
        new Map(
            Children.toArray(children)
                .filter((child): child is React.ReactElement => isValidElement(child) && child.key != null)
                // React prefixes element keys with ".$" — strip it back to the modal key.
                .map((child) => [String(child.key).substring(2), child] as [string, React.ReactElement]),
        )

    const [windows, setWindows] = useState<Map<string, React.ReactElement>>(buildMap)
    useEffect(() => {
        setWindows(buildMap())
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [children])

    const control = useModalControl()
    const [currentModal, setCurrentModal] = useState<string | null>(null)

    useEffect(() => {
        const handleChange = () => {
            const current = control.current
            setCurrentModal(current ? current.key : null)
        }
        handleChange()
        control.on(CHANGE_EVENT, handleChange)
        return () => control.off(CHANGE_EVENT, handleChange)
    }, [control])

    // Render only the top-of-stack modal body; it renders its own <Window>, which
    // mounts a fresh tc-modal that handles backdrop/focus/scroll/Escape itself.
    return <>{windows.get(currentModal ?? '') ?? null}</>
}

// Namespace export so existing `Modal.Window` / `Modal.useModalInput` call sites
// keep working after changing the import path to `@/lib/modal`.
export const Modal = {
    ModalContext,
    ModalRender,
    Window,
    useModalOpen,
    useModalClose,
    useCurrentModal,
    useModalInput,
    useModalCloseAll,
}
