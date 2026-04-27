import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Icon } from './Icon'

export interface Testimonial {
	quote: React.ReactNode
	author: string
	role?: string
	avatar?: string
	sourceHref?: string
}

export interface TestimonialCarouselProps extends React.HTMLAttributes<HTMLDivElement> {
	items: Testimonial[]
	autoplay?: boolean
	interval?: number
}

export const TestimonialCarousel: React.FC<TestimonialCarouselProps> = ({
	items,
	autoplay = false,
	interval = 6000,
	className = '',
	...rest
}) => {
	const [active, setActive] = useState(0)
	const timer = useRef<number | null>(null)

	const next = useCallback(() => setActive((i) => (i + 1) % items.length), [items.length])
	const prev = useCallback(() => setActive((i) => (i - 1 + items.length) % items.length), [items.length])

	useEffect(() => {
		if (!autoplay || items.length < 2) return
		timer.current = window.setInterval(next, interval)
		return () => {
			if (timer.current) window.clearInterval(timer.current)
		}
	}, [autoplay, interval, items.length, next])

	if (items.length === 0) return null
	const current = items[active]
	const rootClass = `component component-testimonial-carousel ${className}`.trim()

	return (
		<div className={rootClass} {...rest} aria-roledescription="carousel">
			<blockquote className="component-testimonial-carousel__card" key={active}>
				<Icon name="quote" className="component-testimonial-carousel__quote-icon" aria-hidden={true} />
				<p className="component-testimonial-carousel__quote">{current.quote}</p>
				<footer className="component-testimonial-carousel__author">
					{current.avatar ? (
						<img
							src={current.avatar}
							alt=""
							className="component-testimonial-carousel__avatar"
							loading="lazy"
						/>
					) : null}
					<div className="component-testimonial-carousel__meta">
						<span className="component-testimonial-carousel__name">{current.author}</span>
						{current.role ? (
							<span className="component-testimonial-carousel__role">{current.role}</span>
						) : null}
					</div>
					{current.sourceHref ? (
						<a
							className="component-testimonial-carousel__source"
							href={current.sourceHref}
							target="_blank"
							rel="noopener noreferrer"
						>
							Source
						</a>
					) : null}
				</footer>
			</blockquote>
			{items.length > 1 && (
				<div className="component-testimonial-carousel__controls">
					<button
						type="button"
						className="component-testimonial-carousel__control"
						onClick={prev}
						aria-label="Previous testimonial"
					>
						<Icon name="chevron-left" aria-hidden={true} />
					</button>
					<div className="component-testimonial-carousel__dots" role="tablist">
						{items.map((_, i) => (
							<button
								key={i}
								type="button"
								role="tab"
								aria-selected={i === active}
								aria-label={`Testimonial ${i + 1}`}
								className={`component-testimonial-carousel__dot ${i === active ? 'component-testimonial-carousel__dot--active' : ''}`}
								onClick={() => setActive(i)}
							/>
						))}
					</div>
					<button
						type="button"
						className="component-testimonial-carousel__control"
						onClick={next}
						aria-label="Next testimonial"
					>
						<Icon name="chevron-right" aria-hidden={true} />
					</button>
				</div>
			)}
		</div>
	)
}

export default TestimonialCarousel
