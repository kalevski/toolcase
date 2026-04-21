import React, { useId, useRef, useState } from 'react'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface RatingProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange'> {
	value?: number
	onChange?: (value: number) => void
	count?: number
	/** Allow half-star values */
	allowHalf?: boolean
	/** Read-only display mode */
	readOnly?: boolean
	size?: 'small' | 'default' | 'large'
	/** Custom icon name (Bootstrap Icons). Defaults to 'star-fill' */
	icon?: string
	/** Custom empty icon. Defaults to 'star' */
	emptyIcon?: string
	label?: string
	className?: string
}

// ── Component ──────────────────────────────────────────────────────────────────

export const Rating: React.FC<RatingProps> = ({
	value = 0,
	onChange,
	count = 5,
	allowHalf = false,
	readOnly = false,
	size = 'default',
	icon = 'star-fill',
	emptyIcon = 'star',
	label,
	className = '',
	...rest
}) => {
	const genId = useId()
	const groupId = `rating-${genId.replace(/[^a-zA-Z0-9_-]/g, '')}`
	const [hoverValue, setHoverValue] = useState<number | null>(null)
	const starRefs = useRef<(HTMLSpanElement | null)[]>([])

	const displayValue = hoverValue !== null ? hoverValue : value

	const getStarValue = (starIndex: number, isHalf: boolean): number => {
		return isHalf ? starIndex - 0.5 : starIndex
	}

	const handleMouseMove = (e: React.MouseEvent<HTMLSpanElement>, starIndex: number) => {
		if (readOnly) return
		if (allowHalf) {
			const rect = e.currentTarget.getBoundingClientRect()
			const isHalf = e.clientX - rect.left < rect.width / 2
			setHoverValue(getStarValue(starIndex, isHalf))
		} else {
			setHoverValue(starIndex)
		}
	}

	const handleClick = (e: React.MouseEvent<HTMLSpanElement>, starIndex: number) => {
		if (readOnly) return
		let newValue: number
		if (allowHalf) {
			const rect = e.currentTarget.getBoundingClientRect()
			const isHalf = e.clientX - rect.left < rect.width / 2
			newValue = getStarValue(starIndex, isHalf)
		} else {
			newValue = starIndex
		}
		onChange?.(newValue)
	}

	const getFill = (starIndex: number): 'full' | 'half' | 'empty' => {
		if (displayValue >= starIndex) return 'full'
		if (allowHalf && displayValue >= starIndex - 0.5) return 'half'
		return 'empty'
	}

	const rootClass = [
		'component component-rating',
		`component-rating--${size}`,
		readOnly ? 'component-rating--readonly' : '',
		className,
	].filter(Boolean).join(' ')

	return (
		<div className={rootClass} {...rest}>
			{label && (
				<label className="component-rating__label">{label}</label>
			)}
			<div
				className="component-rating__stars"
				role="radiogroup"
				aria-label={label ?? 'Rating'}
				onMouseLeave={() => setHoverValue(null)}
			>
				{Array.from({ length: count }, (_, i) => {
					const starIndex = i + 1
					const fill = getFill(starIndex)
					return (
						<span
							key={starIndex}
							ref={(el) => { starRefs.current[i] = el }}
							className={[
								'component-rating__star',
								`component-rating__star--${fill}`,
							].join(' ')}
							role={readOnly ? undefined : 'radio'}
							aria-checked={value === starIndex}
							aria-label={`${starIndex} star${starIndex !== 1 ? 's' : ''}`}
							tabIndex={readOnly ? -1 : (starIndex === Math.max(1, Math.round(value)) ? 0 : -1)}
							onMouseMove={(e) => handleMouseMove(e, starIndex)}
							onClick={(e) => handleClick(e, starIndex)}
							onKeyDown={(e) => {
								if (readOnly) return
								if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
									e.preventDefault()
									const next = Math.min(starIndex + 1, count)
									onChange?.(next)
									starRefs.current[next - 1]?.focus()
								} else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
									e.preventDefault()
									const next = Math.max(starIndex - 1, 1)
									onChange?.(next)
									starRefs.current[next - 1]?.focus()
								} else if (e.key === 'Enter' || e.key === ' ') {
									e.preventDefault()
									onChange?.(starIndex)
								}
							}}
						>
							{fill === 'half' ? (
								<span className="component-rating__star-inner component-rating__star-inner--half" aria-hidden="true">
									<i className={`bi bi-star-half`} />
								</span>
							) : (
								<i className={`bi bi-${fill === 'full' ? icon : emptyIcon}`} aria-hidden="true" />
							)}
						</span>
					)
				})}
			</div>
			{!readOnly && (
				<span className="component-rating__value" aria-live="polite">
					{value > 0 ? `${value} of ${count}` : ''}
				</span>
			)}
		</div>
	)
}
