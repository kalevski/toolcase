import React, { useCallback, useEffect, useRef, useState } from 'react'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface ResizablePanelProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'children'> {
	children: [React.ReactNode, React.ReactNode]
	direction?: 'horizontal' | 'vertical'
	defaultSizes?: [number, number]
	minSize?: number
	/** localStorage key to persist panel sizes */
	storageKey?: string
	className?: string
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function readSizes(storageKey: string | undefined, defaultSizes: [number, number]): [number, number] {
	if (!storageKey) return defaultSizes
	try {
		const raw = localStorage.getItem(storageKey)
		if (raw) {
			const parsed = JSON.parse(raw)
			if (
				Array.isArray(parsed) &&
				parsed.length === 2 &&
				typeof parsed[0] === 'number' &&
				typeof parsed[1] === 'number'
			) {
				return parsed as [number, number]
			}
		}
	} catch {
		// ignore
	}
	return defaultSizes
}

// ── Component ──────────────────────────────────────────────────────────────────

export const ResizablePanel: React.FC<ResizablePanelProps> = ({
	children,
	direction = 'horizontal',
	defaultSizes = [50, 50],
	minSize = 10,
	storageKey,
	className = '',
	...rest
}) => {
	const [sizes, setSizes] = useState<[number, number]>(() =>
		readSizes(storageKey, defaultSizes)
	)

	const containerRef = useRef<HTMLDivElement>(null)
	const isDragging = useRef(false)
	const startPos = useRef(0)
	const startSizes = useRef<[number, number]>([50, 50])

	const isHorizontal = direction === 'horizontal'

	const updateSizes = useCallback((next: [number, number]) => {
		setSizes(next)
		if (storageKey) {
			try { localStorage.setItem(storageKey, JSON.stringify(next)) } catch { /* ignore */ }
		}
	}, [storageKey])

	const handlePointerDown = (e: React.PointerEvent) => {
		e.preventDefault()
		;(e.target as HTMLElement).setPointerCapture(e.pointerId)
		isDragging.current = true
		startPos.current   = isHorizontal ? e.clientX : e.clientY
		startSizes.current = sizes
	}

	const handlePointerMove = useCallback((e: PointerEvent) => {
		if (!isDragging.current || !containerRef.current) return
		const { width, height } = containerRef.current.getBoundingClientRect()
		const total = isHorizontal ? width : height
		const delta = (isHorizontal ? e.clientX : e.clientY) - startPos.current
		const deltaPct = (delta / total) * 100

		const a = Math.max(minSize, Math.min(100 - minSize, startSizes.current[0] + deltaPct))
		const b = 100 - a
		updateSizes([a, b])
	}, [isHorizontal, minSize, updateSizes])

	const handlePointerUp = useCallback(() => {
		isDragging.current = false
	}, [])

	useEffect(() => {
		window.addEventListener('pointermove', handlePointerMove)
		window.addEventListener('pointerup', handlePointerUp)
		return () => {
			window.removeEventListener('pointermove', handlePointerMove)
			window.removeEventListener('pointerup', handlePointerUp)
		}
	}, [handlePointerMove, handlePointerUp])

	const rootClass = [
		'component component-resizable-panel',
		`component-resizable-panel--${direction}`,
		className,
	].filter(Boolean).join(' ')

	return (
		<div ref={containerRef} className={rootClass} {...rest}>
			<div
				className="component-resizable-panel__pane component-resizable-panel__pane--first"
				style={{ [isHorizontal ? 'width' : 'height']: `${sizes[0]}%` }}
			>
				{children[0]}
			</div>

			<div
				className="component-resizable-panel__divider"
				onPointerDown={handlePointerDown}
				onDoubleClick={() => updateSizes(defaultSizes)}
				role="separator"
				aria-orientation={isHorizontal ? 'vertical' : 'horizontal'}
				tabIndex={0}
				onKeyDown={(e) => {
					const step = 5
					if (e.key === (isHorizontal ? 'ArrowRight' : 'ArrowDown')) {
						e.preventDefault()
						updateSizes([Math.min(100 - minSize, sizes[0] + step), Math.max(minSize, sizes[1] - step)])
					}
					if (e.key === (isHorizontal ? 'ArrowLeft' : 'ArrowUp')) {
						e.preventDefault()
						updateSizes([Math.max(minSize, sizes[0] - step), Math.min(100 - minSize, sizes[1] + step)])
					}
				}}
				aria-label={`Resize panels. Double-click to reset.`}
			>
				<div className="component-resizable-panel__handle" aria-hidden="true" />
			</div>

			<div
				className="component-resizable-panel__pane component-resizable-panel__pane--second"
				style={{ [isHorizontal ? 'width' : 'height']: `${sizes[1]}%` }}
			>
				{children[1]}
			</div>
		</div>
	)
}
