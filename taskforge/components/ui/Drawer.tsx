'use client'

import React, { useEffect, useRef, useId } from 'react'
import ReactDOM from 'react-dom'

const FOCUSABLE = [
    'a[href]',
    'button:not([disabled])',
    'textarea:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
].join(', ')

export interface DrawerProps {
    open: boolean
    onClose: () => void
    side?: 'left' | 'right' | 'top' | 'bottom'
    size?: 'small' | 'default' | 'large'
    title?: string
    pinned?: boolean
    children?: React.ReactNode
    className?: string
}

export const Drawer: React.FC<DrawerProps> = ({
    open,
    onClose,
    side = 'right',
    size = 'default',
    title,
    pinned = false,
    children,
    className = '',
}) => {
    const panelRef = useRef<HTMLDivElement>(null)
    const previousFocusRef = useRef<HTMLElement | null>(null)
    const titleId = useId()

    useEffect(() => {
        if (!open) return

        previousFocusRef.current = document.activeElement as HTMLElement
        if (!pinned) document.body.style.overflow = 'hidden'

        requestAnimationFrame(() => {
            if (!panelRef.current) return
            const firstFocusable = panelRef.current.querySelector<HTMLElement>(FOCUSABLE)
            if (firstFocusable) firstFocusable.focus()
            else panelRef.current.focus()
        })

        return () => {
            document.body.style.overflow = ''
            previousFocusRef.current?.focus()
            previousFocusRef.current = null
        }
    }, [open, pinned])

    useEffect(() => {
        if (!open) return

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose()
                return
            }

            if (e.key === 'Tab' && panelRef.current) {
                const focusable = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE))
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

        document.addEventListener('keydown', handleKeyDown)
        return () => document.removeEventListener('keydown', handleKeyDown)
    }, [open, onClose])

    const backdropClass = [
        'component-drawer',
        open ? 'component-drawer--open' : '',
        pinned ? 'component-drawer--pinned' : '',
    ]
        .filter(Boolean)
        .join(' ')

    const panelClass = [
        'component component-drawer__panel',
        `component-drawer__panel--${side}`,
        `component-drawer__panel--${size}`,
        open ? 'component-drawer__panel--open' : '',
        className,
    ]
        .filter(Boolean)
        .join(' ')

    const drawer = (
        <div
            className={backdropClass}
            aria-hidden={!open}
            onClick={
                pinned
                    ? undefined
                    : (e) => {
                          if (e.target === e.currentTarget) onClose()
                      }
            }
        >
            <div
                ref={panelRef}
                className={panelClass}
                role="dialog"
                aria-modal={!pinned}
                aria-labelledby={title ? titleId : undefined}
                tabIndex={-1}
            >
                {title != null && (
                    <div className="component-drawer__header">
                        <span id={titleId} className="component-drawer__title">
                            {title}
                        </span>
                        <button
                            type="button"
                            className="component-drawer__close"
                            aria-label="Close drawer"
                            onClick={onClose}
                        >
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                                <path
                                    d="M12 4L4 12M4 4l8 8"
                                    stroke="currentColor"
                                    strokeWidth="1.75"
                                    strokeLinecap="round"
                                />
                            </svg>
                        </button>
                    </div>
                )}
                <div className="component-drawer__body">{children}</div>
            </div>
        </div>
    )

    if (typeof document === 'undefined') return null
    return ReactDOM.createPortal(drawer, document.body)
}
