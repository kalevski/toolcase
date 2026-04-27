import React from 'react'
import { Icon } from './Icon'

export interface CalloutQuoteProps extends React.HTMLAttributes<HTMLElement> {
	quote: React.ReactNode
	attribution?: string
	source?: string
	sourceHref?: string
}

export const CalloutQuote: React.FC<CalloutQuoteProps> = ({
	quote,
	attribution,
	source,
	sourceHref,
	className = '',
	...rest
}) => {
	const rootClass = `component component-callout-quote ${className}`.trim()

	return (
		<figure className={rootClass} {...rest}>
			<Icon name="quote" className="component-callout-quote__mark" aria-hidden={true} />
			<blockquote className="component-callout-quote__text">{quote}</blockquote>
			{(attribution || source) && (
				<figcaption className="component-callout-quote__caption">
					{attribution ? <cite className="component-callout-quote__author">{attribution}</cite> : null}
					{source ? (
						sourceHref ? (
							<a
								href={sourceHref}
								target="_blank"
								rel="noopener noreferrer"
								className="component-callout-quote__source"
							>
								{source}
							</a>
						) : (
							<span className="component-callout-quote__source">{source}</span>
						)
					) : null}
				</figcaption>
			)}
		</figure>
	)
}

export default CalloutQuote
