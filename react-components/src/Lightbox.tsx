import React, { useCallback, useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from './Icon'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface LightboxImage {
	src: string
	alt?: string
	caption?: string
	thumbnail?: string
}

export interface LightboxProps {
	images: LightboxImage[]
	open: boolean
	initialIndex?: number
	onClose: () => void
}

// ── Component ──────────────────────────────────────────────────────────────────

export const Lightbox: React.FC<LightboxProps> = ({
	images,
	open,
	initialIndex = 0,
	onClose,
}) => {
	const genId = useId()
	const dialogId  = `lightbox-${genId.replace(/[^a-zA-Z0-9_-]/g, '')}`
	const titleId   = `${dialogId}-title`

	const [current, setCurrent] = useState(initialIndex)
	const dialogRef = useRef<HTMLDivElement>(null)
	const triggerRef = useRef<Element | null>(null)

	// Pointer-swipe state
	const swipeStartX = useRef(0)
	const isDragging  = useRef(false)

	const count = images.length
	const prev  = useCallback(() => setCurrent((c) => ((c - 1 + count) % count)), [count])
	const next  = useCallback(() => setCurrent((c) => (c + 1) % count), [count])

	// Sync index when open changes
	useEffect(() => {
		if (open) {
			triggerRef.current = document.activeElement
			setCurrent(initialIndex)
			setTimeout(() => dialogRef.current?.focus(), 0)
		} else {
			// Return focus to trigger
			;(triggerRef.current as HTMLElement)?.focus?.()
		}
	}, [open, initialIndex])

	// Keyboard navigation + focus trap
	const handleKeyDown = useCallback((e: KeyboardEvent) => {
		if (!open) return
		switch (e.key) {
			case 'Escape':    e.preventDefault(); onClose();  break
			case 'ArrowLeft': e.preventDefault(); prev();     break
			case 'ArrowRight':e.preventDefault(); next();     break
			case 'Tab': {
				// Focus trap
				const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
					'button, [href], [tabindex]:not([tabindex="-1"])'
				) ?? []
				const arr = Array.from(focusable)
				if (arr.length === 0) return
				const first = arr[0]
				const last  = arr[arr.length - 1]
				if (e.shiftKey) {
					if (document.activeElement === first) { e.preventDefault(); last.focus() }
				} else {
					if (document.activeElement === last)  { e.preventDefault(); first.focus() }
				}
				break
			}
		}
	}, [open, onClose, prev, next])

	useEffect(() => {
		document.addEventListener('keydown', handleKeyDown)
		return () => document.removeEventListener('keydown', handleKeyDown)
	}, [handleKeyDown])

	// Prevent body scroll
	useEffect(() => {
		if (open) {
			document.body.style.overflow = 'hidden'
		} else {
			document.body.style.overflow = ''
		}
		return () => { document.body.style.overflow = '' }
	}, [open])

	if (!open || images.length === 0) return null

	const img = images[current]

	const content = (
		<div className="component component-lightbox">
			{/* Backdrop */}
			<div className="component-lightbox__backdrop" onClick={onClose} aria-hidden="true" />

			{/* Dialog */}
			<div
				ref={dialogRef}
				className="component-lightbox__dialog"
				role="dialog"
				aria-modal="true"
				aria-labelledby={titleId}
				tabIndex={-1}
			>
				{/* Close */}
				<button
					type="button"
					className="component-lightbox__close"
					aria-label="Close lightbox"
					onClick={onClose}
				>
					<Icon name="x-lg" />
				</button>

				{/* Counter */}
				<div className="component-lightbox__counter" aria-live="polite">
					{current + 1} / {count}
				</div>

				{/* Main image */}
				<div className="component-lightbox__stage"
					onPointerDown={(e) => { isDragging.current = true; swipeStartX.current = e.clientX }}
					onPointerUp={(e) => {
						if (!isDragging.current) return
						isDragging.current = false
						const diff = e.clientX - swipeStartX.current
						if (Math.abs(diff) > 40) { if (diff < 0) next(); else prev() }
					}}
				>
					{count > 1 && (
						<button type="button" className="component-lightbox__arrow component-lightbox__arrow--prev" aria-label="Previous image" onClick={prev}>
							<Icon name="chevron-left" />
						</button>
					)}

					<figure className="component-lightbox__figure">
						<img
							className="component-lightbox__image"
							src={img.src}
							alt={img.alt ?? `Image ${current + 1} of ${count}`}
							id={titleId}
						/>
						{img.caption && (
							<figcaption className="component-lightbox__caption">{img.caption}</figcaption>
						)}
					</figure>

					{count > 1 && (
						<button type="button" className="component-lightbox__arrow component-lightbox__arrow--next" aria-label="Next image" onClick={next}>
							<Icon name="chevron-right" />
						</button>
					)}
				</div>

				{/* Thumbnails */}
				{count > 1 && (
					<div className="component-lightbox__thumbnails" aria-label="Image thumbnails">
						{images.map((image, idx) => (
							<button
								key={idx}
								type="button"
								className={[
									'component-lightbox__thumbnail',
									idx === current ? 'component-lightbox__thumbnail--active' : '',
								].filter(Boolean).join(' ')}
								aria-label={`View image ${idx + 1}: ${image.alt ?? ''}`}
								aria-current={idx === current}
								onClick={() => setCurrent(idx)}
							>
								<img
									src={image.thumbnail ?? image.src}
									alt=""
									aria-hidden="true"
									loading="lazy"
								/>
							</button>
						))}
					</div>
				)}
			</div>
		</div>
	)

	return createPortal(content, document.body)
}
