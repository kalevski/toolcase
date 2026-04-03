import type { FC, HTMLAttributes, ReactNode } from 'react'

export interface TableColumn<T = any> {
	key: string
	header: ReactNode
	render: (row: T, rowIndex: number) => ReactNode
	width?: string
	align?: 'left' | 'center' | 'right'
	headerAlign?: 'left' | 'center' | 'right'
}

export interface TableProps<T = any> extends HTMLAttributes<HTMLDivElement> {
	columns: TableColumn<T>[]
	data: T[]
	rowKey: (row: T, index: number) => string | number
	emptyMessage?: ReactNode
	striped?: boolean
	hoverable?: boolean
	compact?: boolean
	borderless?: boolean
	stickyHeader?: boolean
	onRowClick?: (row: T, index: number) => void
}

export const Table: FC<TableProps> = ({
	columns,
	data,
	rowKey,
	emptyMessage,
	striped = false,
	hoverable = true,
	compact = false,
	borderless = false,
	stickyHeader = false,
	onRowClick,
	className,
	...rest
}) => {
	const rootClass = [
		'component component-table',
		striped && 'component-table--striped',
		hoverable && 'component-table--hoverable',
		compact && 'component-table--compact',
		borderless && 'component-table--borderless',
		stickyHeader && 'component-table--sticky-header',
		onRowClick && 'component-table--clickable',
		className,
	]
		.filter(Boolean)
		.join(' ')

	return (
		<div className={rootClass} {...rest}>
			<table className="component-table__table">
				<thead className="component-table__head">
					<tr>
						{columns.map((col) => (
							<th
								key={col.key}
								className="component-table__th"
								style={{
									width: col.width,
									textAlign: col.headerAlign ?? col.align ?? 'left',
								}}
							>
								{col.header}
							</th>
						))}
					</tr>
				</thead>
				<tbody className="component-table__body">
					{data.length === 0 && emptyMessage !== undefined ? (
						<tr>
							<td className="component-table__empty" colSpan={columns.length}>
								{emptyMessage}
							</td>
						</tr>
					) : (
						data.map((row, index) => (
							<tr
								key={rowKey(row, index)}
								className="component-table__row"
								onClick={onRowClick ? () => onRowClick(row, index) : undefined}
							>
								{columns.map((col) => (
									<td
										key={col.key}
										className="component-table__td"
										style={{
											width: col.width,
											textAlign: col.align ?? 'left',
										}}
									>
										{col.render(row, index)}
									</td>
								))}
							</tr>
						))
					)}
				</tbody>
			</table>
		</div>
	)
}
