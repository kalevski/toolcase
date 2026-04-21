import React, { useId, useRef, useState, useEffect, useCallback } from 'react'
import ReactDOM from 'react-dom'
import { useClickOutside } from './hooks/useClickOutside'

// ── Types ──────────────────────────────────────────────────────────────────────

export type PopoverPlacement =
	| 'top' | 'top-start' | 'top-end'
	| 'bottom' | 'bottom-start' | 'bottom-end'
	| 'left' | 'left-start' | 'left-end'
	| 'right' | 'right-start' | 'right-end'

export interface PopoverProps {
	/** The element that triggers the popover. Must be a single element child. */
	children: React.ReactElement
	/** The content rendered inside the popover panel. */
	content: React.ReactNode
	placement?: PopoverPlacement
	/** Open/close the popover on click (default) or hover. */
	trigger?: 'click' | 'hover'
	/** Controlled open state. Requires `onOpenChange`. */
	open?: boolean
	onOpenChange?: (open: boolean) => void
	className?: string
}

// ── Position math ──────────────────────────────────────────────────────────────

interface Position { top: number; left: number }

function computePosition(
	trigger: HTMLElement,
	popover: HTMLElement,
	placement: PopoverPlacement,
): Position {
	const tr = trigger.getBoundingClientRect()
	const pr = popover.getBoundingClientRect()
	const scrollX = window.scrollX
	const scrollY = window.scrollY
	const GAP = 8

	let top = 0
	let left = 0

	const [side, align] = placement.split('-') as [string, string | undefined]

	if (side === 'top')    top = tr.top + scrollY - pr.height - GAP
	if (side === 'bottom') top = tr.bottom + scrollY + GAP
	if (side === 'left')   left = tr.left + scrollX - pr.width - GAP
	if (side === 'right')  left = tr.right + scrollX + GAP

	if (side === 'top' || side === 'bottom') {
		if (align === 'start')    left = tr.left + scrollX
		else if (align === 'end') left = tr.right + scrollX - pr.width
		else                      left = tr.left + scrollX + tr.width / 2 - pr.width / 2
	}
	if (side === 'left' || side === 'right') {
		if (align === 'start')    top = tr.top + scrollY
		else if (align === 'end') top = tr.bottom + scrollY - pr.height
		else                      top = tr.top + scrollY + tr.height / 2 - pr.height / 2
	}

	// Clamp to viewport
	const vw = document.documentElement.clientWidth
	const vh = document.documentElement.clientHeight
	left = Math.max(scrollX + 8, Math.min(left, scrollX + vw - pr.width - 8))
	top  = Math.max(scrollY + 8, Math.min(top,  scrollY + vh - pr.height - 8))

	return { top, left }
}

// ── Component ──────────────────────────────────────────────────────────────────

export const Popover: React.FC<PopoverProps> = ({
	children,
	content,
	placement = 'bottom',
	trigger = 'click',
	open: openProp,
	onOpenChange,
	className = '',
}) => {
	const isControlled = openProp !== undefined
	const [internalOpen, setInternalOpen] = useState(false)
	const open = isControlled ? openProp! : internalOpen
	const [pos, setPos] = useState<Position>({ top: 0, left: 0 })
	const [ready, setReady] = useState(false)

	const triggerRef = useRef<HTMLElement>(null)
	const panelRef   = useRef<HTMLDivElement>(null)
	const containerRef = useRef<HTMLDivElement>(null)
	const id = useId()
	const panelId = `popover-${id.replace(/[^a-zA-Z0-9_-]/g, '')}`

	const setOpen = useCallback((next: boolean) => {
		if (!isControlled) setInternalOpen(next)
		onOpenChange?.(next)
	}, [isControlled, onOpenChange])

	// Recompute position whenever open or placement changes
	useEffect(() => {
		if (!open || !triggerRef.current || !panelRef.current) return
		setReady(false)
		// measure on next frame after panel is rendered
		requestAnimationFrame(() => {
			if (!triggerRef.current || !panelRef.current) return
			setPos(computePosition(triggerRef.current, panelRef.current, placement))
			setReady(true)
		})
	}, [open, placement])

	useClickOutside(containerRef, () => {
		if (trigger === 'click') setOpen(false)
	})

	// Escape closes
	useEffect(() => {
		if (!open) return
		const handler = (e: KeyboardEvent) => {
			if (e.key === 'Escape') setOpen(false)
		}
		document.addEventListener('keydown', handler)
		return () => document.removeEventListener('keydown', handler)
	}, [open, setOpen])

	const triggerProps: React.HTMLAttributes<HTMLElement> & { ref: React.Ref<HTMLElement> } = {
		ref: triggerRef,
		'aria-expanded': open,
		'aria-controls': panelId,
	}
	if (trigger === 'click') {
		triggerProps.onClick = () => setOpen(!open)
	} else {
		triggerProps.onMouseEnter = () => setOpen(true)
		triggerProps.onMouseLeave = () => setOpen(false)
		triggerProps.onFocus = () => setOpen(true)
		triggerProps.onBlur = () => setOpen(false)
	}

	const panelClass = [
		'component-popover__panel',
		ready ? 'component-popover__panel--visible' : '',
	].filter(Boolean).join(' ')

	return (
		<div ref={containerRef} className="component-popover-host" style={{ display: 'contents' }}>
			{React.cloneElement(children, triggerProps)}
			{open && ReactDOM.createPortal(
				<div
					id={panelId}
					ref={panelRef}
					className={`component component-popover ${className}`.trim()}
					role="dialog"
					style={{ position: 'absolute', top: pos.top, left: pos.left }}
				>
					<div className={panelClass}>
						{content}
					</div>
				</div>,
				document.body,
			)}
		</div>
	)
}
