'use client'

import React, { useEffect, useState } from 'react'
import { ToastProvider, Modal } from '@/components/ui'
import { ConfirmModal, PromptModal } from './ConfirmModal'
import { NewProjectModal } from './NewProjectModal'
import { NewTaskModal } from './NewTaskModal'
import { ImportIssuesModal } from './ImportIssuesModal'
import { FeedbackModal } from './FeedbackModal'

/**
 * The local `components/ui` kit is client-only — several components (Toast,
 * Modal, Drawer) call `createPortal(…, document.body)` during render, which
 * throws under SSR. We therefore render the entire UI on the client only.
 *
 * This does NOT weaken auth: page server components still execute server-side
 * (running `requireRole`/`requireSession`, redirects, and data fetching) to
 * produce the RSC tree — only the UI-kit rendering is deferred to the client.
 * The first client render returns the same `null` the server did, so there is
 * no hydration mismatch.
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
                    <NewProjectModal key="newProject" />
                    <NewTaskModal key="newTask" />
                    <ImportIssuesModal key="importIssues" />
                    <FeedbackModal key="taskFeedback" />
                </Modal.ModalRender>
            </Modal.ModalContext>
        </ToastProvider>
    )
}
