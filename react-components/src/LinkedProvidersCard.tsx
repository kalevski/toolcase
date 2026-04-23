import React from 'react'
import { Icon } from './Icon'
import { SectionCard } from './SectionCard'

export interface LinkedProvider {
	id: string
	provider: string
	identifier: string
}

export interface LinkedProvidersCardProps {
	providers: LinkedProvider[]
	title?: string
	brandColors?: Record<string, string>
	iconForProvider?: (key: string) => string
	emptyLabel?: string
	className?: string
}

export const defaultProviderBrandColors: Record<string, string> = {
	google: '#4285f4',
	github: '#24292e',
	gitlab: '#fc6d26',
	discord: '#5865f2',
	slack: '#4a154b',
	twitter: '#1da1f2',
	x: '#000000',
	facebook: '#1877f2',
	apple: '#000000',
	microsoft: '#00a4ef',
	linkedin: '#0a66c2',
}

const defaultIconMap: Record<string, string> = {
	google: 'google',
	github: 'github',
	gitlab: 'gitlab',
	discord: 'discord',
	slack: 'slack',
	twitter: 'twitter',
	x: 'twitter-x',
	facebook: 'facebook',
	apple: 'apple',
	microsoft: 'microsoft',
	linkedin: 'linkedin',
}

export const LinkedProvidersCard: React.FC<LinkedProvidersCardProps> = ({
	providers,
	title = 'Providers',
	brandColors,
	iconForProvider,
	emptyLabel = 'No linked providers',
	className,
}) => {
	const colors = { ...defaultProviderBrandColors, ...(brandColors || {}) }
	const resolveIcon = (key: string) => {
		if (iconForProvider) return iconForProvider(key)
		return defaultIconMap[key.toLowerCase()] ?? 'box-arrow-up-right'
	}

	return (
		<SectionCard title={title} icon="link-45deg" className={className}>
			<div className="component component-linked-providers-card">
				{providers.length === 0 ? (
					<div className="component-linked-providers-card__empty">
						<Icon name="link-45deg" decorative />
						<span>{emptyLabel}</span>
					</div>
				) : (
					<ul className="component-linked-providers-card__list">
						{providers.map((p) => {
							const tint = colors[p.provider.toLowerCase()] ?? '#64748b'
							return (
								<li key={p.id} className="component-linked-providers-card__row">
									<span
										className="component-linked-providers-card__tile"
										style={{ background: tint }}
										aria-hidden="true"
									>
										<Icon name={resolveIcon(p.provider)} decorative />
									</span>
									<div className="component-linked-providers-card__meta">
										<div className="component-linked-providers-card__name">
											{p.provider}
										</div>
										<div className="component-linked-providers-card__identifier">
											{p.identifier}
										</div>
									</div>
								</li>
							)
						})}
					</ul>
				)}
			</div>
		</SectionCard>
	)
}
