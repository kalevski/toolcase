'use client'

import React, { useEffect, useState } from 'react'
import { Modal } from '@/lib/modal'
import { ConfirmModal, PromptModal } from './ConfirmModal'
import { NewProjectModal } from './NewProjectModal'
import { NewTaskModal } from './NewTaskModal'
import { ImportIssuesModal } from './ImportIssuesModal'
import { FeedbackModal } from './FeedbackModal'

/**
 * `tc-*` custom elements register via `customElements.define` (browser-only) and
 * upgrade client-side, so the whole UI is deferred to the client. The library is
 * imported DYNAMICALLY inside the effect: a static import would evaluate its
 * `class … extends HTMLElement` definitions during SSR/prerender, where
 * `HTMLElement` is undefined. `register()` is idempotent. Toasts are spawned
 * imperatively (see `@/lib/toast`) — no provider needed.
 *
 * This does NOT weaken auth: page server components still execute server-side
 * (running `requireRole`/`requireSession`, redirects, and data fetching) to
 * produce the RSC tree — only the UI rendering is deferred to the client. The
 * first client render returns the same `null` the server did, so there is no
 * hydration mismatch.
 */
export function Providers({ children }: { children: React.ReactNode }) {
    const [mounted, setMounted] = useState(false)
    useEffect(() => {
        let active = true
        void import('@toolcase/web-components').then((m) => {
            if (!active) return
            m.register()
            setMounted(true)
        })
        return () => {
            active = false
        }
    }, [])

    if (!mounted) return null

    return (
        <Modal.ModalContext>
            {children}
            <Modal.ModalRender>
                <ConfirmModal key="confirm" />
                <PromptModal key="prompt" />
                <NewProjectModal key="newProject" />
                <NewTaskModal key="newTask" />
                <ImportIssuesModal key="importIssues" />
                <FeedbackModal key="taskFeedback" />
            </Modal.ModalRender>
        </Modal.ModalContext>
    )
}
