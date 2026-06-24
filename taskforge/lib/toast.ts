'use client'

// Imperative toast manager built on the `<tc-toast>` custom element.
//
// Replaces the old React-context ToastProvider. The public `toast` API is
// unchanged (`toast.success/error/warning/info(msg, opts)`, `toast(msg, opts)`,
// `toast.dismiss`, `toast.dismissAll`) so call sites only change the import path.
//
// Each toast is a `<tc-toast>` node appended to a fixed-position container. The
// element captures its child nodes on connect, so we set its attributes and body
// BEFORE appending it to the DOM, then it renders + shows itself (open attr).

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
    /** ms before auto-dismiss; `0` keeps it open until dismissed. */
    duration?: number
    position?: ToastPosition
}

const DEFAULT_DURATION = 4000
const DEFAULT_POSITION: ToastPosition = 'bottom-right'
const MAX_PER_POSITION = 5

// tc-toast variant → Bootstrap `text-bg-*` colour.
const VARIANT_BS: Record<ToastVariant, string> = {
    success: 'success',
    error: 'danger',
    warning: 'warning',
    info: 'info',
}

const containers = new Map<ToastPosition, HTMLElement>()
const active = new Map<string, { el: HTMLElement; position: ToastPosition }>()
let seq = 0

function cornerStyle(position: ToastPosition): Partial<CSSStyleDeclaration> {
    const [v, h] = position.split('-') as ['top' | 'bottom', 'left' | 'right' | 'center']
    const style: Partial<CSSStyleDeclaration> = { [v]: '1rem' } as Partial<CSSStyleDeclaration>
    if (h === 'center') {
        style.left = '50%'
        style.transform = 'translateX(-50%)'
    } else {
        style[h] = '1rem'
    }
    return style
}

function getContainer(position: ToastPosition): HTMLElement {
    let container = containers.get(position)
    if (!container) {
        container = document.createElement('div')
        container.setAttribute('data-tc-toast-container', position)
        Object.assign(container.style, {
            position: 'fixed',
            zIndex: '1090', // above modal (1055) and tooltip (1070)
            display: 'flex',
            // newest toast nearest the screen edge
            flexDirection: position.startsWith('bottom') ? 'column-reverse' : 'column',
            gap: '0.5rem',
            maxWidth: 'min(420px, 90vw)',
            pointerEvents: 'none',
            ...cornerStyle(position),
        })
        document.body.appendChild(container)
        containers.set(position, container)
    }
    return container
}

function add(message: string, variant: ToastVariant, options: ToastOptions = {}): string {
    if (typeof document === 'undefined') return '' // SSR guard

    const id = options.id ?? `toast-${++seq}`
    const position = options.position ?? DEFAULT_POSITION
    const duration = options.duration ?? DEFAULT_DURATION
    const container = getContainer(position)

    // Cap per-position: drop the oldest still-showing toast at this position.
    const here = [...active.entries()].filter(([, t]) => t.position === position)
    if (here.length >= MAX_PER_POSITION) dismiss(here[0][0])

    const el = document.createElement('tc-toast')
    el.setAttribute('variant', VARIANT_BS[variant])
    if (options.title) el.setAttribute('title', options.title)
    if (duration === 0) {
        el.setAttribute('autohide', 'false')
    } else {
        el.setAttribute('autohide', 'true')
        el.setAttribute('delay', String(duration))
    }
    el.style.pointerEvents = 'auto'

    const body = document.createElement('div')
    body.style.cssText = 'display:flex;align-items:flex-start;gap:.5rem;'
    const text = document.createElement('span')
    text.style.flex = '1'
    text.textContent = message // textContent → no HTML injection
    body.appendChild(text)

    // tc-toast only renders its own close button when it has a title (header).
    // Add a manual one otherwise so every toast is dismissable.
    if (!options.title) {
        const closeBtn = document.createElement('button')
        closeBtn.type = 'button'
        closeBtn.setAttribute('aria-label', 'Dismiss notification')
        closeBtn.style.cssText =
            'background:none;border:0;cursor:pointer;color:inherit;opacity:.7;font-size:1.1rem;line-height:1;padding:0 .15rem;'
        closeBtn.textContent = '×' // ×
        closeBtn.addEventListener('click', () => (el as any).hide?.())
        body.appendChild(closeBtn)
    }

    el.appendChild(body) // children must exist before connect
    el.setAttribute('open', '')
    el.addEventListener('tc-hidden', () => {
        el.remove()
        active.delete(id)
    })

    container.appendChild(el) // connect → capture children, render, show
    active.set(id, { el, position })
    return id
}

function dismiss(id: string): void {
    const t = active.get(id)
    if (!t) return
    if (typeof (t.el as any).hide === 'function') {
        ;(t.el as any).hide() // animates out, then tc-hidden removes it
    } else {
        t.el.remove()
        active.delete(id)
    }
}

function dismissAll(): void {
    for (const id of [...active.keys()]) dismiss(id)
}

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
        return add(message, variant, rest)
    },
    {
        success: (message: string, options?: ToastOptions) => add(message, 'success', options),
        error: (message: string, options?: ToastOptions) => add(message, 'error', options),
        warning: (message: string, options?: ToastOptions) => add(message, 'warning', options),
        info: (message: string, options?: ToastOptions) => add(message, 'info', options),
        dismiss,
        dismissAll,
    },
)
