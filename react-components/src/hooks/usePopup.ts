import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Shared dismissable-popup behavior (improvements/04): one implementation of
 * open/close + outside-click + Escape + focus restore + optional arrow-key
 * navigation, so every dropdown-ish component behaves identically.
 *
 * Usage:
 *   const popup = usePopup({ arrowNav: true })
 *   <div ref={popup.rootRef}>
 *       <button {...popup.triggerProps}>open</button>
 *       {popup.open && <div {...popup.popupProps}>…items…</div>}
 *   </div>
 */

const DEFAULT_ITEM_SELECTOR =
	'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

export interface UsePopupOptions {
	/** Called whenever the popup closes, regardless of the reason. */
	onClose?: () => void
	/** ArrowUp/Down + Home/End roving focus across the popup's items. */
	arrowNav?: boolean
	/** Which elements inside the popup count as items for arrowNav. */
	itemSelector?: string
}

export interface UsePopupResult<R extends HTMLElement, T extends HTMLElement, P extends HTMLElement> {
	open: boolean
	/** Open/close programmatically (no focus management). */
	setOpen: (open: boolean) => void
	/** Close and restore focus to the trigger (pass false to skip the refocus). */
	close: (restoreFocus?: boolean) => void
	toggle: () => void
	/** Outside-click boundary — put it on the wrapper that contains trigger + popup. */
	rootRef: React.RefObject<R | null>
	/** Spread onto the trigger element. */
	triggerProps: {
		ref: React.RefObject<T | null>
		'aria-haspopup': true
		'aria-expanded': boolean
		onClick: () => void
		onKeyDown: (e: React.KeyboardEvent) => void
	}
	/** Spread onto the popup element (rendered only while open). */
	popupProps: {
		ref: React.RefObject<P | null>
		onKeyDown: (e: React.KeyboardEvent) => void
	}
}

export function usePopup<
	R extends HTMLElement = HTMLDivElement,
	T extends HTMLElement = HTMLElement,
	P extends HTMLElement = HTMLDivElement,
>(options: UsePopupOptions = {}): UsePopupResult<R, T, P> {
	const { onClose, arrowNav = false, itemSelector = DEFAULT_ITEM_SELECTOR } = options
	const [open, setOpenState] = useState(false)
	const rootRef = useRef<R | null>(null)
	const triggerRef = useRef<T | null>(null)
	const popupRef = useRef<P | null>(null)

	const onCloseRef = useRef(onClose)
	onCloseRef.current = onClose

	const setOpen = useCallback((next: boolean) => {
		setOpenState((prev) => {
			if (prev && !next) onCloseRef.current?.()
			return next
		})
	}, [])

	const close = useCallback(
		(restoreFocus = true) => {
			setOpen(false)
			if (restoreFocus) triggerRef.current?.focus()
		},
		[setOpen],
	)

	const toggle = useCallback(() => setOpen(!open), [open, setOpen])

	// Outside click — mousedown so it fires before any click handler swallows it.
	useEffect(() => {
		if (!open) return
		const handler = (event: MouseEvent) => {
			if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
				close(false) // the user clicked elsewhere — don't steal focus back
			}
		}
		document.addEventListener('mousedown', handler)
		return () => document.removeEventListener('mousedown', handler)
	}, [open, close])

	// Escape anywhere while open — close and put focus back on the trigger.
	useEffect(() => {
		if (!open) return
		const handler = (event: KeyboardEvent) => {
			if (event.key !== 'Escape') return
			event.stopPropagation() // don't also dismiss an enclosing modal/drawer
			close()
		}
		document.addEventListener('keydown', handler, true)
		return () => document.removeEventListener('keydown', handler, true)
	}, [open, close])

	const focusableItems = useCallback((): HTMLElement[] => {
		const popup = popupRef.current
		if (!popup) return []
		return Array.from(popup.querySelectorAll<HTMLElement>(itemSelector))
	}, [itemSelector])

	const moveFocus = useCallback(
		(delta: number | 'first' | 'last') => {
			const items = focusableItems()
			if (items.length === 0) return
			if (delta === 'first') { items[0].focus(); return }
			if (delta === 'last') { items[items.length - 1].focus(); return }
			const current = items.indexOf(document.activeElement as HTMLElement)
			const next = current === -1 ? (delta > 0 ? 0 : items.length - 1) : (current + delta + items.length) % items.length
			items[next].focus()
		},
		[focusableItems],
	)

	const onTriggerKeyDown = useCallback(
		(e: React.KeyboardEvent) => {
			if (arrowNav && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
				e.preventDefault()
				if (!open) {
					setOpen(true)
					// focus lands on the first item once the popup has rendered
					requestAnimationFrame(() => moveFocus(e.key === 'ArrowDown' ? 'first' : 'last'))
				} else {
					moveFocus(e.key === 'ArrowDown' ? 'first' : 'last')
				}
			}
		},
		[arrowNav, open, setOpen, moveFocus],
	)

	const onPopupKeyDown = useCallback(
		(e: React.KeyboardEvent) => {
			if (!arrowNav) return
			switch (e.key) {
				case 'ArrowDown': e.preventDefault(); moveFocus(1); break
				case 'ArrowUp': e.preventDefault(); moveFocus(-1); break
				case 'Home': e.preventDefault(); moveFocus('first'); break
				case 'End': e.preventDefault(); moveFocus('last'); break
			}
		},
		[arrowNav, moveFocus],
	)

	return {
		open,
		setOpen,
		close,
		toggle,
		rootRef,
		triggerProps: {
			ref: triggerRef,
			'aria-haspopup': true,
			'aria-expanded': open,
			onClick: toggle,
			onKeyDown: onTriggerKeyDown,
		},
		popupProps: {
			ref: popupRef,
			onKeyDown: onPopupKeyDown,
		},
	}
}
