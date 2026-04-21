import { useEffect, type RefObject } from 'react'

/**
 * Fires `callback` when a mousedown event occurs outside the element
 * referenced by `ref`. Safe to use in multiple components simultaneously.
 */
export function useClickOutside<T extends HTMLElement>(
	ref: RefObject<T | null>,
	callback: () => void,
): void {
	useEffect(() => {
		const handler = (event: MouseEvent) => {
			if (ref.current && !ref.current.contains(event.target as Node)) {
				callback()
			}
		}
		document.addEventListener('mousedown', handler)
		return () => document.removeEventListener('mousedown', handler)
	}, [ref, callback])
}
