import React from 'react'
import { CodeSnippet, type CodeSnippetLanguage } from './CodeSnippet'

export interface Recipe {
	id?: string
	title: string
	description: React.ReactNode
	code: string
	language?: CodeSnippetLanguage
	tags?: string[]
	href?: string
}

export interface CookbookGridProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
	recipes: Recipe[]
	columns?: 2 | 3
	title?: React.ReactNode
}

export const CookbookGrid: React.FC<CookbookGridProps> = ({
	recipes,
	columns = 2,
	title,
	className = '',
	...rest
}) => {
	const rootClass = `component component-cookbook-grid component-cookbook-grid--cols-${columns} ${className}`.trim()

	return (
		<section className={rootClass} {...rest}>
			{title ? <h3 className="component-cookbook-grid__title">{title}</h3> : null}
			<div className="component-cookbook-grid__grid">
				{recipes.map((r, i) => (
					<article key={r.id ?? `${r.title}-${i}`} className="component-cookbook-grid__card">
						<header className="component-cookbook-grid__head">
							<h4 className="component-cookbook-grid__name">{r.title}</h4>
							{r.tags && r.tags.length > 0 ? (
								<div className="component-cookbook-grid__tags">
									{r.tags.map((t) => (
										<span key={t} className="component-cookbook-grid__tag">{t}</span>
									))}
								</div>
							) : null}
						</header>
						<p className="component-cookbook-grid__description">{r.description}</p>
						<div className="component-cookbook-grid__code">
							<CodeSnippet code={r.code} language={r.language ?? 'javascript'} />
						</div>
						{r.href ? (
							<a className="component-cookbook-grid__more" href={r.href}>
								Open recipe →
							</a>
						) : null}
					</article>
				))}
			</div>
		</section>
	)
}

export default CookbookGrid
