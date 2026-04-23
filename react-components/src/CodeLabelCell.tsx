import React from 'react'

export interface CodeLabelCellProps {
	code: string
	name: string
	className?: string
}

export const CodeLabelCell: React.FC<CodeLabelCellProps> = ({ code, name, className }) => (
	<div className={`component component-code-label-cell ${className || ''}`.trim()}>
		<span className="component-code-label-cell__code">{code}</span>
		<span className="component-code-label-cell__name" title={name}>
			{name}
		</span>
	</div>
)
