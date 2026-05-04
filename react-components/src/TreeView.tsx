import React, { useState } from 'react'
import { Icon } from './Icon'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface TreeNode {
	key: string
	label: string
	icon?: string
	disabled?: boolean
	children?: TreeNode[]
	/** Async loader: return children nodes */
	loadChildren?: () => Promise<TreeNode[]>
}

export interface TreeViewProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onSelect'> {
	nodes: TreeNode[]
	/** Keys of selected nodes */
	selected?: string[]
	onSelect?: (keys: string[]) => void
	/** Keys of expanded nodes (controlled) */
	expanded?: string[]
	onExpandChange?: (keys: string[]) => void
	/** Allow multi-select with checkbox */
	checkboxMode?: boolean
	className?: string
}

// ── TreeNode component ────────────────────────────────────────────────────────

interface TreeNodeItemProps {
	node: TreeNode
	depth: number
	selected: string[]
	expanded: string[]
	onSelect: (keys: string[]) => void
	onToggle: (key: string) => void
	checkboxMode: boolean
	allSelected: string[]
}

const TreeNodeItem: React.FC<TreeNodeItemProps> = ({
	node, depth, selected, expanded, onSelect, onToggle, checkboxMode, allSelected
}) => {
	const [asyncChildren, setAsyncChildren] = useState<TreeNode[] | null>(null)
	const [loading, setLoading] = useState(false)
	const isExpanded = expanded.includes(node.key)
	const isSelected = selected.includes(node.key)
	const hasChildren = (node.children && node.children.length > 0) || !!node.loadChildren

	const handleToggle = async (e: React.MouseEvent | React.KeyboardEvent) => {
		e.stopPropagation()
		if (node.loadChildren && !asyncChildren && !isExpanded) {
			setLoading(true)
			try {
				const kids = await node.loadChildren()
				setAsyncChildren(kids)
			} finally {
				setLoading(false)
			}
		}
		onToggle(node.key)
	}

	const handleSelect = (e: React.MouseEvent | React.KeyboardEvent) => {
		e.stopPropagation()
		if (node.disabled) return
		if (checkboxMode) {
			if (isSelected) {
				onSelect(allSelected.filter((k) => k !== node.key))
			} else {
				onSelect([...allSelected, node.key])
			}
		} else {
			onSelect([node.key])
		}
	}

	const children = node.children ?? asyncChildren ?? []

	return (
		<li
			className={[
				'component-tree-view__item',
				node.disabled ? 'component-tree-view__item--disabled' : '',
			].filter(Boolean).join(' ')}
			role="treeitem"
			aria-selected={isSelected}
			aria-expanded={hasChildren ? isExpanded : undefined}
			aria-disabled={node.disabled || undefined}
		>
			<div
				className={[
					'component-tree-view__row',
					isSelected ? 'component-tree-view__row--selected' : '',
				].filter(Boolean).join(' ')}
				style={{ paddingLeft: `${depth * 1.25 + 0.5}rem` }}
				tabIndex={node.disabled ? -1 : 0}
				onClick={handleSelect}
				onKeyDown={(e) => {
					if (e.key === 'Enter' || e.key === ' ') handleSelect(e)
					if (e.key === 'ArrowRight' && hasChildren && !isExpanded) handleToggle(e)
					if (e.key === 'ArrowLeft'  && hasChildren && isExpanded)  handleToggle(e)
				}}
			>
				{/* Expand toggle */}
				<span
					className={[
						'component-tree-view__toggle',
						!hasChildren ? 'component-tree-view__toggle--leaf' : '',
					].filter(Boolean).join(' ')}
					onClick={hasChildren ? handleToggle : undefined}
					onKeyDown={hasChildren ? (e) => { if (e.key === 'Enter') handleToggle(e) } : undefined}
					tabIndex={hasChildren ? 0 : -1}
					aria-hidden="true"
				>
					{hasChildren ? (
						loading
							? <span className="component-tree-view__spinner" />
							: <Icon name={isExpanded ? 'chevron-down' : 'chevron-right'} />
					) : null}
				</span>

				{/* Checkbox */}
				{checkboxMode && (
					<input
						type="checkbox"
						className="component-tree-view__checkbox"
						checked={isSelected}
						disabled={node.disabled}
						onChange={() => {}}
						tabIndex={-1}
						aria-hidden="true"
					/>
				)}

				{/* Icon */}
				{node.icon && <Icon name={node.icon} className="component-tree-view__icon" />}

				{/* Label */}
				<span className="component-tree-view__label">{node.label}</span>
			</div>

			{/* Children */}
			{hasChildren && isExpanded && children.length > 0 && (
				<ul className="component-tree-view__children" role="group">
					{children.map((child) => (
						<TreeNodeItem
							key={child.key}
							node={child}
							depth={depth + 1}
							selected={selected}
							expanded={expanded}
							onSelect={onSelect}
							onToggle={onToggle}
							checkboxMode={checkboxMode}
							allSelected={allSelected}
						/>
					))}
				</ul>
			)}
		</li>
	)
}

// ── TreeView ──────────────────────────────────────────────────────────────────

export const TreeView: React.FC<TreeViewProps> = ({
	nodes,
	selected: selectedProp,
	onSelect,
	expanded: expandedProp,
	onExpandChange,
	checkboxMode = false,
	className = '',
	...rest
}) => {
	const [internalSelected, setInternalSelected] = useState<string[]>([])
	const [internalExpanded, setInternalExpanded] = useState<string[]>([])

	const selected = selectedProp ?? internalSelected
	const expanded = expandedProp ?? internalExpanded

	const handleSelect = (keys: string[]) => {
		if (selectedProp === undefined) setInternalSelected(keys)
		onSelect?.(keys)
	}

	const handleToggle = (key: string) => {
		const next = expanded.includes(key)
			? expanded.filter((k) => k !== key)
			: [...expanded, key]
		if (expandedProp === undefined) setInternalExpanded(next)
		onExpandChange?.(next)
	}

	const rootClass = [
		'component component-tree-view',
		className,
	].filter(Boolean).join(' ')

	return (
		<div className={rootClass} {...rest}>
			<ul className="component-tree-view__root" role="tree">
				{nodes.map((node) => (
					<TreeNodeItem
						key={node.key}
						node={node}
						depth={0}
						selected={selected}
						expanded={expanded}
						onSelect={handleSelect}
						onToggle={handleToggle}
						checkboxMode={checkboxMode}
						allSelected={selected}
					/>
				))}
			</ul>
		</div>
	)
}
