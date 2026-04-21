import React, { useCallback, useEffect, useId, useRef, useState } from 'react'
import { Icon } from './Icon'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface CarouselProps extends React.HTMLAttributes<HTMLDivElement> {
	children: React.ReactNode
	autoPlay?: boolean
	interval?: number
	showDots?: boolean
	showArrows?: boolean
	loop?: boolean
	className?: string
}

// ── Component ──────────────────────────────────────────────────────────────────

export const Carousel: React.FC<CarouselProps> = ({
	children,
	autoPlay = false,
	interval = 4000,
	showDots = true,
	showArrows = true,
	loop = true,
	className = '',
	...rest
}) => {
	const genId = useId()
	const carouselId = `carousel-${genId.replace(/[^a-zA-Z0-9_-]/g, '')}`

	const slides = React.Children.toArray(children)
	const count  = slides.length
	const [current, setCurrent] = useState(0)
	const [paused, setPaused]   = useState(false)
	const autoRef = useRef<ReturnType<typeof setInterval> | null>(null)

	// Pointer-drag swipe
	const startX = useRef(0)
	const isDragging = useRef(false)

	const goTo = useCallback((idx: number) => {
		setCurrent((loop
			? ((idx % count) + count) % count
			: Math.max(0, Math.min(count - 1, idx))
		))
	}, [count, loop])

	const prev = () => goTo(current - 1)
	const next = () => goTo(current + 1)

	// Auto-play
	useEffect(() => {
		if (!autoPlay || paused || count <= 1) return
		autoRef.current = setInterval(next, interval)
		return () => { if (autoRef.current) clearInterval(autoRef.current) }
	}, [autoPlay, paused, interval, current, count])

	// Keyboard
	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === 'ArrowLeft')  prev()
		if (e.key === 'ArrowRight') next()
	}

	// Touch / pointer swipe
	const handlePointerDown = (e: React.PointerEvent) => {
		isDragging.current = true
		startX.current = e.clientX
	}
	const handlePointerUp = (e: React.PointerEvent) => {
		if (!isDragging.current) return
		isDragging.current = false
		const diff = e.clientX - startX.current
		if (Math.abs(diff) > 40) {
			if (diff < 0) next(); else prev()
		}
	}

	const rootClass = [
		'component component-carousel',
		className,
	].filter(Boolean).join(' ')

	return (
		<div
			className={rootClass}
			aria-roledescription="carousel"
			onMouseEnter={() => setPaused(true)}
			onMouseLeave={() => setPaused(false)}
			onKeyDown={handleKeyDown}
			tabIndex={0}
			{...rest}
		>
			{/* Slides */}
			<div
				className="component-carousel__track"
				onPointerDown={handlePointerDown}
				onPointerUp={handlePointerUp}
			>
				{slides.map((slide, idx) => (
					<div
						key={idx}
						id={`${carouselId}-slide-${idx}`}
						className={[
							'component-carousel__slide',
							idx === current ? 'component-carousel__slide--active' : '',
						].filter(Boolean).join(' ')}
						aria-roledescription="slide"
						aria-label={`Slide ${idx + 1} of ${count}`}
						aria-hidden={idx !== current}
						role="group"
					>
						{slide}
					</div>
				))}
			</div>

			{/* Arrows */}
			{showArrows && count > 1 && (
				<>
					<button
						type="button"
						className="component-carousel__arrow component-carousel__arrow--prev"
						aria-label="Previous slide"
						onClick={prev}
						disabled={!loop && current === 0}
					>
						<Icon name="chevron-left" />
					</button>
					<button
						type="button"
						className="component-carousel__arrow component-carousel__arrow--next"
						aria-label="Next slide"
						onClick={next}
						disabled={!loop && current === count - 1}
					>
						<Icon name="chevron-right" />
					</button>
				</>
			)}

			{/* Dots */}
			{showDots && count > 1 && (
				<div className="component-carousel__dots" role="tablist" aria-label="Slides">
					{slides.map((_, idx) => (
						<button
							key={idx}
							type="button"
							className={[
								'component-carousel__dot',
								idx === current ? 'component-carousel__dot--active' : '',
							].filter(Boolean).join(' ')}
							role="tab"
							aria-selected={idx === current}
							aria-label={`Go to slide ${idx + 1}`}
							aria-controls={`${carouselId}-slide-${idx}`}
							onClick={() => goTo(idx)}
						/>
					))}
				</div>
			)}
		</div>
	)
}
