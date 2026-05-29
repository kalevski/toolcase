import { useEffect, useRef, useState } from 'react'
import type { FC, HTMLAttributes, ReactNode } from 'react'

export interface PinnedFeatureShowcaseItem {
	title: string
	description: string
	icon?: ReactNode
	eyebrow?: string
}

export interface PinnedFeatureShowcaseProps extends HTMLAttributes<HTMLDivElement> {
	title: string
	description: string
	items: PinnedFeatureShowcaseItem[]
	eyebrow?: string
	media?: ReactNode
	imageSrc?: string
	imageAlt?: string
	ctas?: ReactNode
}

export const PinnedFeatureShowcase: FC<PinnedFeatureShowcaseProps> = ({
	title,
	description,
	items,
	eyebrow,
	media,
	imageSrc,
	imageAlt,
	ctas,
	className,
	...rest
}) => {
	const classes = ['component component-pinned-feature-showcase', className].filter(Boolean).join(' ')
	const leftRef = useRef<HTMLDivElement>(null)
	const [isCentered, setIsCentered] = useState(false)

	useEffect(() => {
		// Sticky/centering only applies on the desktop layout (>=769px). On
		// mobile the left panel is static, so skip the scroll listener entirely
		// to avoid layout-shift jank against the mobile address-bar resize.
		const stickyQuery = window.matchMedia('(min-width: 769px)')

		const handleScroll = () => {
			if (!leftRef.current) {
				return
			}

			const { top } = leftRef.current.getBoundingClientRect()
			const contentHeight = leftRef.current.scrollHeight
			const viewportHeight = window.innerHeight
			const offsetTrigger = 56
			const canCenter = contentHeight + offsetTrigger * 2 <= viewportHeight
			const shouldCenter = top <= offsetTrigger && canCenter

			setIsCentered((prev) => (prev !== shouldCenter ? shouldCenter : prev))
		}

		const handleEvent = () => {
			window.requestAnimationFrame(handleScroll)
		}

		let attached = false
		const sync = () => {
			if (stickyQuery.matches && !attached) {
				window.addEventListener('scroll', handleEvent, { passive: true })
				attached = true
				handleScroll()
			} else if (!stickyQuery.matches && attached) {
				window.removeEventListener('scroll', handleEvent)
				attached = false
				setIsCentered(false)
			}
		}

		sync()
		stickyQuery.addEventListener('change', sync)
		window.addEventListener('resize', handleEvent)

		return () => {
			window.removeEventListener('scroll', handleEvent)
			window.removeEventListener('resize', handleEvent)
			stickyQuery.removeEventListener('change', sync)
		}
	}, [])

	const leftClasses = ['component-pinned-feature-showcase__left']
	if (isCentered) {
		leftClasses.push('component-pinned-feature-showcase__left--centered')
	}

	const renderMedia = () => {
		if (media) {
			return <div className="component-pinned-feature-showcase__media">{media}</div>
		}

		if (imageSrc) {
			return (
				<figure className="component-pinned-feature-showcase__media">
					<img
						src={imageSrc}
						alt={imageAlt ?? ''}
						loading="lazy"
						className="component-pinned-feature-showcase__image"
					/>
				</figure>
			)
		}

		return null
	}

	return (
		<section className={classes} {...rest}>
			<div className="component-pinned-feature-showcase__inner">
				<aside ref={leftRef} className={leftClasses.join(' ')}>
					<div className="component-pinned-feature-showcase__lead">
						{eyebrow ? <span className="component-pinned-feature-showcase__eyebrow">{eyebrow}</span> : null}
						<h2 className="component-pinned-feature-showcase__title">{title}</h2>
						<p className="component-pinned-feature-showcase__description">{description}</p>
						{ctas ? <div className="component-pinned-feature-showcase__actions">{ctas}</div> : null}
					</div>
					{renderMedia()}
				</aside>
				<div className="component-pinned-feature-showcase__right">
					{items.map((item, index) => (
						<article key={`${item.title}-${index}`} className="component-pinned-feature-showcase__item">
							{item.icon ? (
								<span className="component-pinned-feature-showcase__item-icon" aria-hidden="true">
									{item.icon}
								</span>
							) : null}
							<div className="component-pinned-feature-showcase__item-content">
								{item.eyebrow ? (
									<span className="component-pinned-feature-showcase__item-eyebrow">{item.eyebrow}</span>
								) : null}
								<h3 className="component-pinned-feature-showcase__item-title">{item.title}</h3>
								<p className="component-pinned-feature-showcase__item-description">{item.description}</p>
							</div>
						</article>
					))}
				</div>
			</div>
		</section>
	)
}

export default PinnedFeatureShowcase
