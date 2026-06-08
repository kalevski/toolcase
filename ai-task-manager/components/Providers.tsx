'use client'

import React, { useEffect, useState } from 'react'
import { ToastProvider, Modal } from '@toolcase/react-components'
import { ConfirmModal, PromptModal } from './ConfirmModal'

/**
 * `@toolcase/react-components` is a client-only library — several components
 * (Toast, Modal, Drawer, Tooltip) call `createPortal(…, document.body)` during
 * render, which throws under SSR. We therefore render the entire UI on the
 * client only.
 *
 * This does NOT weaken auth: page server components still execute server-side
 * (running `requireRole`/`requireSession`, redirects, and data fetching) to
 * produce the RSC tree — only the react-components rendering is deferred to the
 * client. The first client render returns the same `null` the server did, so
 * there is no hydration mismatch.
 */
export function Providers({ children }: { children: React.ReactNode }) {
    const [mounted, setMounted] = useState(false)
    useEffect(() => setMounted(true), [])

    if (!mounted) return null

    return (
        <ToastProvider defaultPosition="bottom-right">
            <Modal.ModalContext>
                {children}
                <Modal.ModalRender>
                    <ConfirmModal key="confirm" />
                    <PromptModal key="prompt" />
                </Modal.ModalRender>
            </Modal.ModalContext>
        </ToastProvider>
    )
}
