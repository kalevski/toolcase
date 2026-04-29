import React from 'react'

export interface MarqueeProps extends React.HTMLAttributes<HTMLDivElement> {
	items: React.ReactNode[]
	separator?: React.ReactNode
	speed?: number
	direction?: 'left' | 'right'
	pauseOnHover?: boolean
}

export const Marquee: React.FC<MarqueeProps> = ({
	items,
	separator = '↻',
	speed = 50,
	direction = 'left',
	pauseOnHover = false,
	className = '',
	style,
	...rest
}) => {
	const rootClass = [
		'component component-marquee',
		`component-marquee--${direction}`,
		pauseOnHover ? 'component-marquee--pause-hover' : '',
		className,
	].filter(Boolean).join(' ')

	const trackStyle: React.CSSProperties = {
		animationDuration: `${speed}s`,
		...style,
	}

	const renderRun = (key: string) => (
		<div className="component-marquee__run" key={key} aria-hidden={key !== 'a'}>
			{items.map((item, i) => (
				<React.Fragment key={i}>
					<span className="component-marquee__item">{item}</span>
					<span className="component-marquee__sep" aria-hidden={true}>{separator}</span>
				</React.Fragment>
			))}
		</div>
	)

	return (
		<div className={rootClass} role="marquee" aria-label="scrolling banner" {...rest}>
			<div className="component-marquee__track" style={trackStyle}>
				{renderRun('a')}
				{renderRun('b')}
			</div>
		</div>
	)
}
