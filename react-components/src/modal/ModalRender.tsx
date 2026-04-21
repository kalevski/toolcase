import React, { ReactNode, MouseEvent, useEffect, useRef, useState, Children, isValidElement, cloneElement } from 'react'
import { useModalControl } from './ModalContext'
import { CHANGE_EVENT } from './ModalControl'

export interface ModalRenderProps {
	children: ReactNode
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

	const modalControl = useModalControl()
	const [currentModal, setCurrentModal] = useState<string | null>(null)
	const backdropRef = useRef<HTMLDivElement>(null)
	const previousFocusRef = useRef<HTMLElement | null>(null)

	useEffect(() => {
		const handleChange = () => {
			const current = modalControl.current
			setCurrentModal(current ? current.key : null)
		}

		handleChange()

		modalControl.on(CHANGE_EVENT, handleChange)

		return () => {
			modalControl.off(CHANGE_EVENT, handleChange)
		}
	}, [modalControl])

	const handleBackdropClick = (e: MouseEvent) => {
		if (e.target === e.currentTarget) {
			modalControl.close()
		}
	}

	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (!backdropRef.current) return

			if (e.key === 'Escape' && currentModal) {
				modalControl.close()
				return
			}

			// Focus trap: keep Tab/Shift+Tab inside the modal
			if (e.key === 'Tab') {
				const focusable = Array.from(
					backdropRef.current.querySelectorAll<HTMLElement>(FOCUSABLE),
				)
				if (focusable.length === 0) { e.preventDefault(); return }
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
			// Save where focus was before modal opened so we can restore it.
			previousFocusRef.current = document.activeElement as HTMLElement
			document.addEventListener('keydown', handleKeyDown)
			document.body.style.overflow = 'hidden'

			// Move focus into the modal on next frame.
			requestAnimationFrame(() => {
				if (!backdropRef.current) return
				const focusable = backdropRef.current.querySelector<HTMLElement>(FOCUSABLE)
				focusable?.focus()
			})
		} else {
			document.body.style.overflow = ''
			// Restore focus to the element that triggered the modal.
			previousFocusRef.current?.focus()
			previousFocusRef.current = null
		}

		return () => {
			document.removeEventListener('keydown', handleKeyDown)
			document.body.style.overflow = ''
		}
	}, [currentModal, modalControl])

	const modalToRender = windows.get(currentModal || '') || null

	const isModalOpen = currentModal !== null
	const renderClassName = `component-modals__render${className ? ` ${className}` : ''}${!isModalOpen ? ' component-modals__render--closed' : ''}`

	return (
		<div
			ref={backdropRef}
			className={renderClassName}
			onClick={handleBackdropClick}
			style={{
				display: isModalOpen ? 'flex' : 'none',
			}}
		>
			{modalToRender}
		</div>
	)
}
