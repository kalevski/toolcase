import React, { useCallback, useState } from 'react'
import { Icon } from './Icon'

export type InstallManager = 'npm' | 'yarn' | 'pnpm' | 'bun'

export interface InstallTabsProps extends React.HTMLAttributes<HTMLDivElement> {
	package: string
	dev?: boolean
	global?: boolean
	managers?: InstallManager[]
	defaultManager?: InstallManager
}

const buildCommand = (manager: InstallManager, pkg: string, dev: boolean, global: boolean): string => {
	if (manager === 'npm') {
		const flag = global ? ' -g' : dev ? ' -D' : ''
		return `npm install${flag} ${pkg}`
	}
	if (manager === 'yarn') {
		if (global) return `yarn global add ${pkg}`
		return `yarn add${dev ? ' --dev' : ''} ${pkg}`
	}
	if (manager === 'pnpm') {
		const flag = global ? ' -g' : dev ? ' -D' : ''
		return `pnpm add${flag} ${pkg}`
	}
	const flag = global ? ' -g' : dev ? ' -d' : ''
	return `bun add${flag} ${pkg}`
}

export const InstallTabs: React.FC<InstallTabsProps> = ({
	package: pkg,
	dev = false,
	global = false,
	managers = ['npm', 'yarn', 'pnpm', 'bun'],
	defaultManager,
	className = '',
	...rest
}) => {
	const [active, setActive] = useState<InstallManager>(defaultManager ?? managers[0])
	const [copied, setCopied] = useState(false)
	const command = buildCommand(active, pkg, dev, global)

	const handleCopy = useCallback(() => {
		if (typeof navigator !== 'undefined' && navigator.clipboard) {
			navigator.clipboard.writeText(command).catch(() => {})
		}
		setCopied(true)
		const id = window.setTimeout(() => setCopied(false), 1800)
		return () => window.clearTimeout(id)
	}, [command])

	const rootClass = `component component-install-tabs ${className}`.trim()

	return (
		<div className={rootClass} {...rest}>
			<div className="component-install-tabs__tabs" role="tablist">
				{managers.map((m) => (
					<button
						key={m}
						type="button"
						role="tab"
						aria-selected={m === active}
						className={`component-install-tabs__tab ${m === active ? 'component-install-tabs__tab--active' : ''}`}
						onClick={() => setActive(m)}
					>
						{m}
					</button>
				))}
			</div>
			<div className="component-install-tabs__body">
				<code className="component-install-tabs__command">{command}</code>
				<button
					type="button"
					className="component-install-tabs__copy"
					onClick={handleCopy}
					aria-label="Copy install command"
				>
					<Icon name={copied ? 'check-lg' : 'clipboard'} aria-hidden={true} />
				</button>
			</div>
		</div>
	)
}

export default InstallTabs
