import { useMemo } from 'react'
import type { ButtonHTMLAttributes, CSSProperties, ElementType, FC, HTMLAttributes, ReactNode } from 'react'
import { Button } from './Button'

export interface HeroAction extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
	label: string
	outline?: boolean
	size?: 'small' | 'default' | 'large'
	variant?: 'primary' | 'secondary' | 'info' | 'success' | 'warning' | 'danger'
}

export interface HeroStatCard {
	label: string
	value: string
	helper?: string
}

// Metrics share the stat shape; alias keeps both public names stable.
export type HeroMetric = HeroStatCard

export interface HeroProps extends HTMLAttributes<HTMLElement> {
	eyebrow?: string
	title: string
	/** Heading tag for the title. Use `h2` when the page already has an `h1`. */
	titleAs?: ElementType
	description: string
	primaryAction: HeroAction
	secondaryAction?: HeroAction
	statCards?: HeroStatCard[]
	metrics?: HeroMetric[]
	backgroundPatternSrc?: string
	backgroundPatternAlt?: string
	backgroundPattern?: ReactNode
	bgIcons?: string[]
}

type HeroBgIconStyle = CSSProperties & {
	'--hero-bg-icon-shift-x'?: string
	'--hero-bg-icon-shift-y'?: string
	'--hero-bg-icon-rotate'?: string
	'--hero-bg-icon-scale'?: string
}

interface HeroBgIconConfig {
	key: string
	src: string
	style: HeroBgIconStyle
}

const heroBgIconAnchors = [
	{ top: 22, left: 28, spread: 4 },
	{ top: 18, left: 52, spread: 4 },
	{ top: 26, left: 74, spread: 4 },
	{ top: 44, left: 84, spread: 4 },
	{ top: 64, left: 76, spread: 5 },
	{ top: 54, left: 50, spread: 5 },
	{ top: 66, left: 28, spread: 5 },
	{ top: 44, left: 16, spread: 4 },
] as const

const clampPercent = (value: number) => Math.min(92, Math.max(8, value))

const renderHeroButton = (action: HeroAction, extraClass?: string) => {
	const { label, className: actionClassName, size, ...buttonProps } = action
	const mergedClass = ['component-hero__button', extraClass, actionClassName].filter(Boolean).join(' ')
	return <Button {...buttonProps} className={mergedClass} size={size ?? 'large'} label={label} />
}

export const Hero: FC<HeroProps> = ({
	eyebrow,
	title,
	titleAs: TitleTag = 'h1',
	description,
	primaryAction,
	secondaryAction,
	statCards,
	metrics,
	backgroundPatternSrc,
	backgroundPatternAlt,
	backgroundPattern,
	bgIcons,
	className,
	...rest
}) => {
	const cards = statCards ?? []
	const metricList = metrics ?? []
	const rootClassName = ['component component-hero', className].filter(Boolean).join(' ')
	const patternAlt = backgroundPatternAlt ?? ''
	const shouldHidePatternFromA11y = !backgroundPattern && (!patternAlt || patternAlt.length === 0)

	const patternElement =
		backgroundPattern ??
		(backgroundPatternSrc ? (
			<img
				src={backgroundPatternSrc}
				alt={patternAlt}
				className="component-hero__background-pattern"
				loading="lazy"
				aria-hidden={shouldHidePatternFromA11y ? true : undefined}
			/>
		) : null)

	const bgIconConfigs = useMemo<HeroBgIconConfig[]>(() => {
		if (!bgIcons || bgIcons.length === 0) {
			return []
		}

		return bgIcons.map((src, index) => {
			const anchor = heroBgIconAnchors[index % heroBgIconAnchors.length]
			const seedBase = (index + 1) * 997
			const seededRandom = (offset: number) => {
				const x = Math.sin(seedBase + offset * 101) * 10000
				return x - Math.floor(x)
			}

			const top = clampPercent(anchor.top + (seededRandom(1) - 0.5) * anchor.spread * 2)
			const left = clampPercent(anchor.left + (seededRandom(2) - 0.5) * anchor.spread * 2)
			const size = 64 + seededRandom(3) * 16
			const delay = -seededRandom(4) * 18
			const duration = 18 + seededRandom(5) * 12
			const shiftRange = Math.max(anchor.spread * 2.5, 10)
			const shiftX = (seededRandom(6) - 0.5) * shiftRange
			const shiftY = (seededRandom(7) - 0.5) * shiftRange
			const rotate = (seededRandom(8) - 0.5) * 18
			const scale = 0.85 + seededRandom(9) * 0.4

			const style: HeroBgIconStyle = {
				top: `${top}%`,
				left: `${left}%`,
				width: `${size}px`,
				animationDelay: `${delay}s`,
				animationDuration: `${duration}s`,
				'--hero-bg-icon-shift-x': `${shiftX}px`,
				'--hero-bg-icon-shift-y': `${shiftY}px`,
				'--hero-bg-icon-rotate': `${rotate}deg`,
				'--hero-bg-icon-scale': `${scale}`,
			}

			return {
				key: `${index}-${src}`,
				src,
				style,
			}
		})
	}, [bgIcons])

	return (
		<section className={rootClassName} {...rest}>
			{patternElement && (
				<div className="component-hero__background" aria-hidden={shouldHidePatternFromA11y ? true : undefined}>
					{patternElement}
				</div>
			)}
			{bgIconConfigs.length > 0 && (
				<div className="component-hero__background-icons" aria-hidden="true">
					{bgIconConfigs.map(({ key, src, style }) => (
						<img
							key={key}
							src={src}
							alt=""
							role="presentation"
							className="component-hero__bg-icon"
							style={style}
							loading="lazy"
						/>
					))}
				</div>
			)}
			{cards.length > 0 && (
				<div className="component-hero__stat-cards" aria-hidden="true">
					{cards.map((card, index) => (
						<div className="component-hero__stat-card" key={`${card.label}-${index}`}>
							<span className="component-hero__stat-value">{card.value}</span>
							<span className="component-hero__stat-label">{card.label}</span>
							{card.helper && <span className="component-hero__stat-helper">{card.helper}</span>}
						</div>
					))}
				</div>
			)}
			<div className="component-hero__main">
				<div className="component-hero__grid">
					<div className="component-hero__text component-hero__text--centered">
						{eyebrow && <p className="component-hero__eyebrow">{eyebrow}</p>}
						<TitleTag className="component-hero__title component-hero__title--centered">{title}</TitleTag>
						<p className="component-hero__description component-hero__description--centered">{description}</p>
						<div className="component-hero__actions component-hero__actions--centered">
							{renderHeroButton(primaryAction, 'component-hero__button--primary')}
							{secondaryAction &&
								renderHeroButton(
									{
										...secondaryAction,
										outline: secondaryAction.outline ?? true,
									},
									'component-hero__button--secondary',
								)}
						</div>
					</div>
				</div>
			</div>

			{metricList.length > 0 && (
				<>
					<div className="component-hero__separator" aria-hidden="true"></div>

					<div className="component-hero__bottom">
						<div className="component-hero__bottom-inner">
							<ul className="component-hero__metrics component-hero__metrics--centered">
								{metricList.map((metric, index) => (
									<li className="component-hero__metric" key={`${metric.label}-${index}`}>
										<span className="component-hero__metric-value">{metric.value}</span>
										<span className="component-hero__metric-label">{metric.label}</span>
										{metric.helper && (
											<span className="component-hero__metric-helper">{metric.helper}</span>
										)}
									</li>
								))}
							</ul>
						</div>
					</div>
				</>
			)}
		</section>
	)
}
