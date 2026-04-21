import { Table } from './Table'
import type { TableProps, TableColumn } from './Table'
import { Pagination } from './Pagination'
import { FormInput } from './FormInput'
import type { FormInputType, FormInputProps } from './FormInput'
import { Spinner } from './Spinner'
import { Icon } from './Icon'

export interface AdvancedTableFilter extends Omit<FormInputProps, 'onChange'> {
	key: string
	type: FormInputType
}

export interface AdvancedTableSort {
	key: string
	direction: 'asc' | 'desc'
}

export interface AdvancedTableProps<T = any> extends Omit<TableProps<T>, 'className'> {
	filters?: AdvancedTableFilter[]
	filterValues?: Record<string, any>
	onFilterChange?: (key: string, value: any) => void

	sortableColumns?: string[]
	sort?: AdvancedTableSort | null
	onSortChange?: (sort: AdvancedTableSort | null) => void

	limit?: number
	offset?: number
	total?: number
	onOffsetChange?: (offset: number) => void

	loading?: boolean

	className?: string
}

export function AdvancedTable<T = any>({
	filters = [],
	filterValues = {},
	onFilterChange,

	sortableColumns = [],
	sort,
	onSortChange,

	limit,
	offset,
	total,
	onOffsetChange,

	loading = false,

	columns,
	className = '',
	...tableProps
}: AdvancedTableProps<T>) {
	const rootClass = [
		'component component-advanced-table',
		loading ? 'component-advanced-table--loading' : '',
		className,
	].filter(Boolean).join(' ')

	const enrichedColumns: TableColumn[] = columns.map((col) => {
		if (!sortableColumns.includes(col.key)) return col

		const isActive = sort?.key === col.key
		const direction = isActive ? sort!.direction : null

		const handleSort = () => {
			if (loading || !onSortChange) return
			if (!isActive) return onSortChange({ key: col.key, direction: 'asc' })
			if (direction === 'asc') return onSortChange({ key: col.key, direction: 'desc' })
			onSortChange(null)
		}

		return {
			...col,
			header: (
				<button type="button" className="component-advanced-table__sort-btn" onClick={handleSort}>
					{col.header}
					<span className={`component-advanced-table__sort-icon${isActive ? ' component-advanced-table__sort-icon--active' : ''}`}>
						{direction === 'desc' ? (
							<Icon name="sort-down" />
						) : (
							<Icon name="sort-up" />
						)}
					</span>
				</button>
			),
		}
	})

	const hasPagination = limit !== undefined && offset !== undefined && total !== undefined && total > 0

	return (
		<div className={rootClass}>
			{filters.length > 0 && (
				<div className="component-advanced-table__filters">
					{filters.map(({ key, ...filterProps }) => (
						<div key={key} className="component-advanced-table__filter">
							<FormInput
								{...filterProps}
								value={filterValues[key] ?? ''}
								onChange={(v) => onFilterChange?.(key, v)}
							/>
						</div>
					))}
					{onFilterChange && Object.values(filterValues).some((v) => v !== '' && v !== null && v !== undefined) && (
						<div className="component-advanced-table__filter-reset">
							<button
								type="button"
								className="btn btn-sm btn-link component-advanced-table__clear-btn"
								onClick={() => filters.forEach(({ key }) => onFilterChange(key, ''))}
							>
								Clear filters
							</button>
						</div>
					)}
				</div>
			)}

			<div className="component-advanced-table__body">
				{loading && (
					<div className="component-advanced-table__overlay">
						<Spinner />
					</div>
				)}
				<Table {...tableProps} columns={enrichedColumns} />
			</div>

			{hasPagination && (
				<Pagination
					className="component-advanced-table__pagination"
					limit={limit!}
					offset={offset!}
					total={total!}
					onChange={onOffsetChange}
				/>
			)}
		</div>
	)
}
