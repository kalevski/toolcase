'use client'

import React, { useCallback, useRef, useState } from 'react'
import { Modal } from '@/lib/modal'
import { useTcEvents } from '@/lib/tc'

export interface ConfirmInput {
    title: string
    body?: string
    confirmLabel?: string
    cancelLabel?: string
    confirmVariant?: 'primary' | 'danger' | 'warning'
}

const KEY = 'confirm'

/** Rendered once inside the global ModalRender (see Providers). */
export function ConfirmModal() {
    const input = Modal.useModalInput<ConfirmInput>()
    const close = Modal.useModalClose<boolean>()

    if (!input) return null

    return (
        <Modal.Window size="small" title={input.title}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {input.body && <tc-text>{input.body}</tc-text>}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                    <tc-button variant="secondary" outline onClick={() => close(false)}>
                        {input.cancelLabel ?? 'Cancel'}
                    </tc-button>
                    <tc-button variant={input.confirmVariant ?? 'primary'} onClick={() => close(true)}>
                        {input.confirmLabel ?? 'Confirm'}
                    </tc-button>
                </div>
            </div>
        </Modal.Window>
    )
}

/** Promise-based confirm: `if (await confirm({title})) { … }`. */
export function useConfirm() {
    const resolverRef = useRef<((v: boolean) => void) | null>(null)
    const open = Modal.useModalOpen<boolean, ConfirmInput>(KEY, (payload) => {
        resolverRef.current?.(payload === true)
        resolverRef.current = null
    })
    return useCallback(
        (input: ConfirmInput) =>
            new Promise<boolean>((resolve) => {
                resolverRef.current = resolve
                open(input)
            }),
        [open],
    )
}

// ── text-prompt modal (e.g. "New branch") ───────────────────────────────────

export interface PromptInput {
    title: string
    label?: string
    placeholder?: string
    defaultValue?: string
    confirmLabel?: string
}

const PROMPT_KEY = 'prompt'

export function PromptModal() {
    const input = Modal.useModalInput<PromptInput>()
    const close = Modal.useModalClose<string | null>()
    // Stamp the edited text with the prompt it belongs to, so the field derives
    // its own reset: when a new prompt opens, `value` falls back to that prompt's
    // default automatically — no reset effect needed.
    const [edited, setEdited] = useState<{ for: PromptInput; value: string } | null>(null)
    const value = edited && edited.for === input ? edited.value : (input?.defaultValue ?? '')
    const setValue = (v: string) => {
        if (input) setEdited({ for: input, value: v })
    }
    const submit = () => close(value.trim() ? value.trim() : null)

    const fieldRef = useTcEvents<HTMLElement>({
        input: (e) => setValue((e.target as HTMLInputElement).value),
        keydown: (e) => {
            if ((e as KeyboardEvent).key === 'Enter') submit()
        },
    })

    if (!input) return null

    return (
        <Modal.Window size="small" title={input.title}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <tc-input ref={fieldRef} label={input.label} placeholder={input.placeholder} value={value} />
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                    <tc-button variant="secondary" outline onClick={() => close(null)}>
                        Cancel
                    </tc-button>
                    <tc-button variant="primary" onClick={submit}>
                        {input.confirmLabel ?? 'OK'}
                    </tc-button>
                </div>
            </div>
        </Modal.Window>
    )
}

export function usePrompt() {
    const resolverRef = useRef<((v: string | null) => void) | null>(null)
    const open = Modal.useModalOpen<string | null, PromptInput>(PROMPT_KEY, (payload) => {
        resolverRef.current?.(payload ?? null)
        resolverRef.current = null
    })
    return useCallback(
        (input: PromptInput) =>
            new Promise<string | null>((resolve) => {
                resolverRef.current = resolve
                open(input)
            }),
        [open],
    )
}
