import React, { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from './Icon'

export interface ActionItem {
	key: string
	icon?: string
	label: string
}

export interface ActionItemsProps {
	items: ActionItem[]
	onActionClick?: (key: string) => void
	/** Accessible name for the trigger button. */
	label?: string
}

export const ActionItems: React.FC<ActionItemsProps> = ({
	items,
	onActionClick,
	label = 'Actions',
}) => {
	const [open, setOpen] = useState(false)
	const [activeIndex, setActiveIndex] = useState(-1)
	const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
	const triggerRef = useRef<HTMLButtonElement>(null)
	const menuRef = useRef<HTMLUListElement>(null)
	const itemRefs = useRef<Array<HTMLButtonElement | null>>([])

	// Anchor the fixed-position menu to the trigger's bottom-right.
	const updatePosition = useCallback(() => {
		const t = triggerRef.current
		if (!t) return
		const r = t.getBoundingClientRect()
		setPos({ top: r.bottom + 4, left: r.right })
	}, [])

	// Reposition while open (scroll on any ancestor, or resize).
	useEffect(() => {
		if (!open) return
		updatePosition()
		const handler = () => updatePosition()
		window.addEventListener('scroll', handler, true)
		window.addEventListener('resize', handler)
		return () => {
			window.removeEventListener('scroll', handler, true)
			window.removeEventListener('resize', handler)
		}
	}, [open, updatePosition])

	// Close on outside click — the menu lives in a portal, so check both nodes.
	useEffect(() => {
		if (!open) return
		const handler = (e: MouseEvent) => {
			const node = e.target as Node
			if (triggerRef.current?.contains(node)) return
			if (menuRef.current?.contains(node)) return
			setOpen(false)
			setActiveIndex(-1)
		}
		document.addEventListener('mousedown', handler)
		return () => document.removeEventListener('mousedown', handler)
	}, [open])

	// Move DOM focus to the active menu item (roving tabindex).
	useEffect(() => {
		if (open && activeIndex >= 0) {
			itemRefs.current[activeIndex]?.focus()
		}
	}, [open, activeIndex])

	if (items.length === 0) return null

	const openMenu = (index: number) => {
		updatePosition()
		setOpen(true)
		setActiveIndex(index)
	}

	const closeMenu = (refocus = true) => {
		setOpen(false)
		setActiveIndex(-1)
		if (refocus) triggerRef.current?.focus()
	}

	const handleSelect = (key: string) => {
		onActionClick?.(key)
		closeMenu()
	}

	const handleTriggerKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
		if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
			e.preventDefault()
			openMenu(0)
		} else if (e.key === 'ArrowUp') {
			e.preventDefault()
			openMenu(items.length - 1)
		}
	}

	const handleItemKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
		if (e.key === 'ArrowDown') {
			e.preventDefault()
			setActiveIndex((i) => (i + 1) % items.length)
		} else if (e.key === 'ArrowUp') {
			e.preventDefault()
			setActiveIndex((i) => (i - 1 + items.length) % items.length)
		} else if (e.key === 'Home') {
			e.preventDefault()
			setActiveIndex(0)
		} else if (e.key === 'End') {
			e.preventDefault()
			setActiveIndex(items.length - 1)
		} else if (e.key === 'Escape') {
			e.preventDefault()
			closeMenu()
		} else if (e.key === 'Tab') {
			closeMenu(false)
		}
	}

	const menu = open && pos && (
		<ul
			ref={menuRef}
			className="dropdown-menu component-action-items__dropdown show"
			role="menu"
			aria-label={label}
			style={{
				position: 'fixed',
				top: pos.top,
				left: pos.left,
				// Right-align the menu under the trigger.
				transform: 'translateX(-100%)',
				zIndex: 1060, // dropdown layer — above modal content
			}}
		>
			{items.map((item, index) => (
				<li key={item.key} role="none">
					<button
						ref={(el) => { itemRefs.current[index] = el }}
						type="button"
						role="menuitem"
						tabIndex={activeIndex === index ? 0 : -1}
						className="dropdown-item"
						onClick={(e) => {
							e.stopPropagation()
							handleSelect(item.key)
						}}
						onKeyDown={handleItemKeyDown}
					>
						{item.icon && <Icon name={item.icon} decorative />}
						<span>{item.label}</span>
					</button>
				</li>
			))}
		</ul>
	)

	return (
		<div className="component component-action-items">
			<button
				ref={triggerRef}
				type="button"
				className="component-action-items__trigger"
				aria-label={label}
				aria-haspopup="menu"
				aria-expanded={open}
				onClick={() => (open ? closeMenu(false) : openMenu(0))}
				onKeyDown={handleTriggerKeyDown}
			>
				<Icon name="three-dots-vertical" decorative />
			</button>
			{typeof document !== 'undefined' && menu ? createPortal(menu, document.body) : null}
		</div>
	)
}
