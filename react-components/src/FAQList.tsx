import React, { useState } from 'react'
import { Icon } from './Icon'

export interface FAQItem {
	question: string
	answer: React.ReactNode
}

export interface FAQListProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
	items: FAQItem[]
	defaultOpen?: number[]
	schema?: boolean
	title?: React.ReactNode
}

const buildSchema = (items: FAQItem[]) => ({
	'@context': 'https://schema.org',
	'@type': 'FAQPage',
	mainEntity: items.map((it) => ({
		'@type': 'Question',
		name: it.question,
		acceptedAnswer: {
			'@type': 'Answer',
			text: typeof it.answer === 'string' ? it.answer : '',
		},
	})),
})

export const FAQList: React.FC<FAQListProps> = ({
	items,
	defaultOpen = [],
	schema = false,
	title,
	className = '',
	...rest
}) => {
	const [open, setOpen] = useState<Set<number>>(new Set(defaultOpen))

	const toggle = (i: number) => {
		setOpen((prev) => {
			const next = new Set(prev)
			if (next.has(i)) next.delete(i)
			else next.add(i)
			return next
		})
	}

	const rootClass = `component component-faq-list ${className}`.trim()

	return (
		<section className={rootClass} {...rest}>
			{title ? <h3 className="component-faq-list__title">{title}</h3> : null}
			<dl className="component-faq-list__list">
				{items.map((item, i) => {
					const isOpen = open.has(i)
					return (
						<div
							key={i}
							className={`component-faq-list__item ${isOpen ? 'component-faq-list__item--open' : ''}`}
						>
							<dt>
								<button
									type="button"
									className="component-faq-list__question"
									onClick={() => toggle(i)}
									aria-expanded={isOpen}
								>
									<span>{item.question}</span>
									<Icon
										name="chevron-down"
										className="component-faq-list__caret"
										aria-hidden={true}
									/>
								</button>
							</dt>
							{isOpen ? (
								<dd className="component-faq-list__answer">{item.answer}</dd>
							) : null}
						</div>
					)
				})}
			</dl>
			{schema ? (
				<script
					type="application/ld+json"
					dangerouslySetInnerHTML={{ __html: JSON.stringify(buildSchema(items)) }}
				/>
			) : null}
		</section>
	)
}

export default FAQList
