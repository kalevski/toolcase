import React, { useId, useRef, useState, useEffect, useCallback } from 'react'
import ReactDOM from 'react-dom'
import { Icon } from './Icon'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface ContextMenuItem {
	key: string
	label: React.ReactNode
	icon?: string
	disabled?: boolean
	danger?: boolean
	/** Render as a visual divider. Other fields are ignored. */
	divider?: boolean
	/** Nested submenu items. */
	items?: ContextMenuItem[]
	onClick?: (key: string) => void
}

export interface ContextMenuProps {
	/** Items to render in the context menu. */
	items: ContextMenuItem[]
	/** The element that listens for `contextmenu` / long-press. */
	children: React.ReactElement<React.HTMLAttributes<HTMLElement>>
	/** Called when a leaf item is clicked. Receives the item key. */
	onSelect?: (key: string) => void
}

// ── Position math ──────────────────────────────────────────────────────────────

function constrainToViewport(x: number, y: number, menuEl: HTMLElement): { x: number; y: number } {
	const { width, height } = menuEl.getBoundingClientRect()
	const vw = document.documentElement.clientWidth
	const vh = document.documentElement.clientHeight
	return {
		x: Math.min(x, vw - width - 8),
		y: Math.min(y, vh - height - 8),
	}
}

// ── Sub-component: ContextMenuList ─────────────────────────────────────────────

interface ContextMenuListProps {
	items: ContextMenuItem[]
	onSelect: (key: string) => void
	menuId: string
	depth?: number
}

const ContextMenuList: React.FC<ContextMenuListProps> = ({ items, onSelect, menuId, depth = 0 }) => {
	const [openSub, setOpenSub] = useState<string | null>(null)

	const handleItemKeyDown = (e: React.KeyboardEvent, item: ContextMenuItem) => {
		if (item.disabled) return
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault()
			if (item.items?.length) setOpenSub(item.key)
			else { item.onClick?.(item.key); onSelect(item.key) }
		}
		if (e.key === 'ArrowRight' && item.items?.length) {
			e.preventDefault()
			setOpenSub(item.key)
		}
		if (e.key === 'Escape') {
			e.preventDefault()
			setOpenSub(null)
		}
	}

	return (
		<ul role="menu" className="component-context-menu__list" id={menuId}>
			{items.map((item, idx) => {
				if (item.divider) {
					return <li key={idx} role="separator" className="component-context-menu__divider" />
				}
				const hasSub = !!item.items?.length
				const isSubOpen = openSub === item.key
				return (
					<li
						key={item.key}
						role="menuitem"
						aria-disabled={item.disabled || undefined}
						aria-haspopup={hasSub ? 'menu' : undefined}
						aria-expanded={hasSub ? isSubOpen : undefined}
						tabIndex={item.disabled ? -1 : 0}
						className={[
							'component-context-menu__item',
							item.disabled  ? 'component-context-menu__item--disabled' : '',
							item.danger    ? 'component-context-menu__item--danger'    : '',
							hasSub         ? 'component-context-menu__item--has-sub'   : '',
						].filter(Boolean).join(' ')}
						onClick={() => {
							if (item.disabled) return
							if (hasSub) { setOpenSub(isSubOpen ? null : item.key); return }
							item.onClick?.(item.key)
							onSelect(item.key)
						}}
						onMouseEnter={() => hasSub && setOpenSub(item.key)}
						onMouseLeave={() => hasSub && setOpenSub(null)}
						onKeyDown={(e) => handleItemKeyDown(e, item)}
					>
						{item.icon && (
							<span className="component-context-menu__item-icon" aria-hidden="true">
								<Icon name={item.icon} />
							</span>
						)}
						<span className="component-context-menu__item-label">{item.label}</span>
						{hasSub && (
							<span className="component-context-menu__item-arrow" aria-hidden="true">
								<Icon name="chevron-right" />
							</span>
						)}
						{hasSub && isSubOpen && (
							<div className="component-context-menu__submenu">
								<ContextMenuList
									items={item.items!}
									onSelect={onSelect}
									menuId={`${menuId}-sub-${item.key}`}
									depth={depth + 1}
								/>
							</div>
						)}
					</li>
				)
			})}
		</ul>
	)
}

// ── Main component ─────────────────────────────────────────────────────────────

export const ContextMenu: React.FC<ContextMenuProps> = ({ items, children, onSelect }) => {
	const [coords, setCoords] = useState<{ x: number; y: number } | null>(null)
	const menuRef = useRef<HTMLDivElement>(null)
	const id = useId()
	const menuId = `ctx-menu-${id.replace(/[^a-zA-Z0-9_-]/g, '')}`

	const close = useCallback(() => setCoords(null), [])

	const handleContextMenu = useCallback((e: React.MouseEvent) => {
		e.preventDefault()
		setCoords({ x: e.clientX, y: e.clientY })
	}, [])

	// Close on outside click / Escape / scroll
	useEffect(() => {
		if (!coords) return
		const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
		const onMouse = (e: MouseEvent) => {
			if (menuRef.current && !menuRef.current.contains(e.target as Node)) close()
		}
		document.addEventListener('keydown', onKey)
		document.addEventListener('mousedown', onMouse)
		document.addEventListener('scroll', close, { passive: true })
		return () => {
			document.removeEventListener('keydown', onKey)
			document.removeEventListener('mousedown', onMouse)
			document.removeEventListener('scroll', close)
		}
	}, [coords, close])

	// Reposition after render to stay in viewport
	useEffect(() => {
		if (!coords || !menuRef.current) return
		const { x, y } = constrainToViewport(coords.x, coords.y, menuRef.current)
		if (x !== coords.x || y !== coords.y) setCoords({ x, y })
	}, [coords])

	// Focus first item on open
	useEffect(() => {
		if (!coords || !menuRef.current) return
		const first = menuRef.current.querySelector<HTMLElement>('[role="menuitem"]:not([aria-disabled])')
		first?.focus()
	}, [coords])

	const handleSelect = useCallback((key: string) => {
		onSelect?.(key)
		close()
	}, [onSelect, close])

	return (
		<>
			{React.cloneElement(children, { onContextMenu: handleContextMenu })}
			{coords && ReactDOM.createPortal(
				<div
					ref={menuRef}
					className="component component-context-menu"
					style={{ position: 'fixed', top: coords.y, left: coords.x }}
					onContextMenu={(e) => e.preventDefault()}
				>
					<ContextMenuList items={items} onSelect={handleSelect} menuId={menuId} />
				</div>,
				document.body,
			)}
		</>
	)
}
