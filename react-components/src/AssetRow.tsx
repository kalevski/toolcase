import type { FC, HTMLAttributes, ReactNode } from 'react'

export interface AssetRowProps extends HTMLAttributes<HTMLDivElement> {
	icon?: ReactNode
	name: ReactNode
	tags?: string[]
	size?: ReactNode
}

export const AssetRow: FC<AssetRowProps> = ({ icon, name, tags, size, className, ...rest }) => {
	const rootClassName = ['component', 'component-asset-row', className].filter(Boolean).join(' ')
	return (
		<div className={rootClassName} {...rest}>
			{icon && <span className="component-asset-row__icon" aria-hidden="true">{icon}</span>}
			<span className="component-asset-row__name">{name}</span>
			{tags && tags.length > 0 && (
				<span className="component-asset-row__tags">
					{tags.map((tag) => (
						<span key={tag} className="component-asset-row__tag">
							{tag}
						</span>
					))}
				</span>
			)}
			{size !== undefined && <span className="component-asset-row__size">{size}</span>}
		</div>
	)
}

AssetRow.displayName = 'AssetRow'

export interface AssetRowListProps extends HTMLAttributes<HTMLDivElement> {
	children: ReactNode
}

export const AssetRowList: FC<AssetRowListProps> = ({ children, className, ...rest }) => {
	const rootClassName = ['component', 'component-asset-row-list', className].filter(Boolean).join(' ')
	return (
		<div className={rootClassName} {...rest}>
			{children}
		</div>
	)
}

AssetRowList.displayName = 'AssetRowList'
