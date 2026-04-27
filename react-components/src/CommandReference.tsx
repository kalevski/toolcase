import React, { useMemo, useState } from 'react'
import { Icon } from './Icon'

export interface CommandFlag {
	name: string
	description: string
	default?: string
}

export interface CommandItem {
	name: string
	usage: string
	description: string
	flags?: CommandFlag[]
	aliases?: string[]
}

export interface CommandReferenceProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
	commands: CommandItem[]
	searchable?: boolean
	searchPlaceholder?: string
	title?: React.ReactNode
}

export const CommandReference: React.FC<CommandReferenceProps> = ({
	commands,
	searchable = true,
	searchPlaceholder = 'Search commands…',
	title,
	className = '',
	...rest
}) => {
	const [query, setQuery] = useState('')

	const filtered = useMemo(() => {
		const q = query.trim().toLowerCase()
		if (!q) return commands
		return commands.filter(
			(c) =>
				c.name.toLowerCase().includes(q) ||
				c.usage.toLowerCase().includes(q) ||
				c.description.toLowerCase().includes(q) ||
				(c.aliases ?? []).some((a) => a.toLowerCase().includes(q))
		)
	}, [commands, query])

	const rootClass = `component component-command-reference ${className}`.trim()

	return (
		<div className={rootClass} {...rest}>
			{title ? <h3 className="component-command-reference__title">{title}</h3> : null}
			{searchable ? (
				<div className="component-command-reference__search">
					<Icon name="search" aria-hidden={true} />
					<input
						type="search"
						className="component-command-reference__input"
						placeholder={searchPlaceholder}
						value={query}
						onChange={(e) => setQuery(e.target.value)}
						aria-label="Search commands"
					/>
				</div>
			) : null}
			{filtered.length === 0 ? (
				<p className="component-command-reference__empty">No commands match "{query}"</p>
			) : (
				<ul className="component-command-reference__list">
					{filtered.map((cmd) => (
						<li key={cmd.name} className="component-command-reference__item">
							<div className="component-command-reference__head">
								<code className="component-command-reference__name">{cmd.name}</code>
								{cmd.aliases && cmd.aliases.length > 0 ? (
									<span className="component-command-reference__aliases">
										aliases: {cmd.aliases.map((a) => <code key={a}>{a}</code>)}
									</span>
								) : null}
							</div>
							<code className="component-command-reference__usage">{cmd.usage}</code>
							<p className="component-command-reference__description">{cmd.description}</p>
							{cmd.flags && cmd.flags.length > 0 ? (
								<dl className="component-command-reference__flags">
									{cmd.flags.map((f) => (
										<React.Fragment key={f.name}>
											<dt>
												<code>{f.name}</code>
												{f.default !== undefined ? (
													<span className="component-command-reference__default">
														(default: {f.default})
													</span>
												) : null}
											</dt>
											<dd>{f.description}</dd>
										</React.Fragment>
									))}
								</dl>
							) : null}
						</li>
					))}
				</ul>
			)}
		</div>
	)
}

export default CommandReference
