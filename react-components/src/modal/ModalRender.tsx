import React, { ReactNode, MouseEvent, useEffect, useState, Children, isValidElement, cloneElement } from 'react'
import { useModalControl } from './ModalContext'
import { CHANGE_EVENT } from './ModalControl'

export interface ModalRenderProps {
	children: ReactNode
	className?: string
}

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
			if (e.key === 'Escape' && currentModal) {
				modalControl.close()
			}
		}

		if (currentModal) {
			document.addEventListener('keydown', handleKeyDown)
			document.body.style.overflow = 'hidden'
		} else {
			document.body.style.overflow = ''
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
